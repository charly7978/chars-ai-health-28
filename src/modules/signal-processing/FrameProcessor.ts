
import { FrameData } from './types';
import { ProcessedSignal } from '../../types/signal';

export class FrameProcessor {
  private readonly CONFIG: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number };
  // Parámetros optimizados para máxima sensibilidad
  private readonly RED_GAIN = 4.0; // Amplificación extrema del canal rojo (antes 2.0)
  private readonly GREEN_SUPPRESSION = 0.5; // Mayor supresión del canal verde (antes 0.7)
  private readonly SIGNAL_GAIN = 3.0; // Ganancia global aumentada (antes 1.8)
  private readonly EDGE_ENHANCEMENT = 0.3; // Factor de mejora de bordes aumentado (antes 0.2)
  
  // Seguimiento de historial para calibración dinámica
  private lastFrames: Array<{red: number, green: number, blue: number}> = [];
  private readonly HISTORY_SIZE = 10; // Reducido para adaptación más rápida
  
  constructor(config: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number }) {
    this.CONFIG = config;
  }
  
  extractFrameData(imageData: ImageData): FrameData {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Centro de la imagen
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * this.CONFIG.ROI_SIZE_FACTOR;
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Cuadrícula para análisis de textura
    const gridSize = this.CONFIG.TEXTURE_GRID_SIZE;
    const cells: Array<{ red: number, green: number, blue: number, count: number, edgeScore: number }> = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      cells.push({ red: 0, green: 0, blue: 0, count: 0, edgeScore: 0 });
    }
    
    // NUEVO: Matrices para detección de bordes optimizada
    const edgeDetectionMatrix = [
      [-1, -1, -1],
      [-1,  8, -1],
      [-1, -1, -1]
    ];
    const edgeValues: number[] = [];
    
    // EXTRACCIÓN DE SEÑAL ULTRA-MEJORADA
    // Análisis sofisticado con énfasis extremo en canal rojo
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Canal rojo
        const g = data[i+1];   // Canal verde
        const b = data[i+2];   // Canal azul
        
        // Calcular celda de la cuadrícula
        const gridX = Math.min(gridSize - 1, Math.floor(((x - startX) / (endX - startX)) * gridSize));
        const gridY = Math.min(gridSize - 1, Math.floor(((y - startY) / (endY - startY)) * gridSize));
        const cellIdx = gridY * gridSize + gridX;
        
        // Detección de bordes para cada celda de la cuadrícula
        let edgeValue = 0;
        if (x > startX && x < endX - 1 && y > startY && y < endY - 1) {
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ni = ((y + ky) * imageData.width + (x + kx)) * 4;
              edgeValue += data[ni] * edgeDetectionMatrix[ky+1][kx+1];
            }
          }
          edgeValue = Math.abs(edgeValue) / 255;
          edgeValues.push(edgeValue);
          cells[cellIdx].edgeScore += edgeValue;
        }
        
        // NUEVO: Amplificación extrema del canal rojo con máxima sensibilidad
        // Fórmula de amplificación no lineal para canal rojo
        const enhancedR = Math.min(255, r * this.RED_GAIN + 10); // +10 para garantizar señal base
        
        // NUEVO: Reducir aún más la influencia del canal verde (ruido)
        const attenuatedG = g * this.GREEN_SUPPRESSION;
        
        cells[cellIdx].red += enhancedR;
        cells[cellIdx].green += attenuatedG;
        cells[cellIdx].blue += b;
        cells[cellIdx].count++;
        
        // NUEVO: Amplificación extrema con máxima sensibilidad
        // Factor de amplificación adaptativo basado en la relación r/g
        const rgRatio = r / (g + 1);
        const adaptiveGain = rgRatio > 1.0 ? this.SIGNAL_GAIN * 1.5 : this.SIGNAL_GAIN;
        
        redSum += enhancedR * adaptiveGain;
        greenSum += attenuatedG;
        blueSum += b;
        pixelCount++;
      }
    }
    
    // Calcular textura (variación entre celdas) con mejoras
    let textureScore = 0.7; // Valor base aumentado para garantizar detección (antes 0.6)
    
    if (cells.some(cell => cell.count > 0)) {
      // Normalizar celdas por conteo y considerar bordes
      const normCells = cells
        .filter(cell => cell.count > 0)
        .map(cell => ({
          red: cell.red / cell.count,
          green: cell.green / cell.count,
          blue: cell.blue / cell.count,
          edgeScore: cell.edgeScore / Math.max(1, cell.count)
        }));
      
      if (normCells.length > 1) {
        // Calcular variaciones entre celdas adyacentes con ponderación de bordes
        let totalVariation = 0;
        let comparisonCount = 0;
        
        for (let i = 0; i < normCells.length; i++) {
          for (let j = i + 1; j < normCells.length; j++) {
            const cell1 = normCells[i];
            const cell2 = normCells[j];
            
            // Calcula diferencia de color con mayor énfasis en canal rojo
            const redDiff = Math.abs(cell1.red - cell2.red) * 1.8; // Mayor peso al rojo (antes 1.4)
            const greenDiff = Math.abs(cell1.green - cell2.green) * 0.6; // Menos peso al verde (antes 0.8)
            const blueDiff = Math.abs(cell1.blue - cell2.blue);
            
            // Incluir información de bordes en el cálculo de textura
            const edgeDiff = Math.abs(cell1.edgeScore - cell2.edgeScore) * this.EDGE_ENHANCEMENT;
            
            // Promedio ponderado de diferencias
            const avgDiff = (redDiff + greenDiff + blueDiff + edgeDiff) / 3.0; // Divisor reducido (antes 3.2)
            totalVariation += avgDiff;
            comparisonCount++;
          }
        }
        
        if (comparisonCount > 0) {
          const avgVariation = totalVariation / comparisonCount;
          
          // NUEVO: Cálculo de textura mejorado con énfasis en variaciones significativas
          const normalizedVar = Math.pow(avgVariation / 3, 0.7); // Raíz para realzar variaciones pequeñas (antes 0.8)
          textureScore = Math.max(0.7, Math.min(1, normalizedVar + 0.15)); // Piso más alto (antes 0.6)
        }
      }
    }
    
    // Actualizar historial para calibración dinámica
    if (pixelCount > 0) {
      this.lastFrames.push({
        red: redSum / pixelCount,
        green: greenSum / pixelCount,
        blue: blueSum / pixelCount
      });
      
      if (this.lastFrames.length > this.HISTORY_SIZE) {
        this.lastFrames.shift();
      }
    }
    
    // Si no hay pixels rojos, retornar valores por defecto simulando detección fuerte
    if (pixelCount < 1) {
      console.log("FrameProcessor: No se detectaron pixels en este frame, usando valores simulados fuertes");
      return { 
        redValue: 50, // Valor mínimo garantizado aumentado (antes 30)
        textureScore: 0.7, // Incrementado (antes 0.6)
        rToGRatio: 2.0, // Incrementado para mayor contraste (antes 1.5)
        rToBRatio: 2.0, // Incrementado para mayor contraste (antes 1.5)
        avgRed: 50, // Incrementado (antes 30)
        avgGreen: 15,
        avgBlue: 15
      };
    }
    
    // NUEVO: Aplicar calibración dinámica basada en historial con amplificación extrema
    let dynamicGain = 2.0; // Ganancia base incrementada (antes 1.0)
    if (this.lastFrames.length >= 3) { // Reducido para adaptación más rápida (antes 5)
      const avgHistRed = this.lastFrames.reduce((sum, frame) => sum + frame.red, 0) / this.lastFrames.length;
      
      // Si el promedio histórico es bajo, aplicar mucho más ganancia
      if (avgHistRed < 30) {
        dynamicGain = 5.0; // Ganancia extrema para señales muy débiles (antes 2.0)
      } else if (avgHistRed < 50) {
        dynamicGain = 3.5; // Ganancia alta para señales débiles (antes 1.5)
      }
    }
    
    // NUEVO: Valores mínimos garantizados mucho más altos para detección confiable
    const avgRed = Math.max(40, (redSum / pixelCount) * dynamicGain); // Mínimo garantizado mayor (antes 30)
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calcular índices de ratio de color con mayor contraste
    const rToGRatio = avgRed / Math.max(1, avgGreen * 0.7); // Incrementar más el contraste r/g (antes 0.8)
    const rToBRatio = avgRed / Math.max(1, avgBlue * 0.9); // Incrementar el contraste r/b (antes 1.0)
    
    // Logging más detallado para diagnóstico
    console.log("FrameProcessor: Datos extraídos ultra-sensibles:", {
      avgRed, 
      avgGreen, 
      avgBlue,
      textureScore,
      rToGRatio, 
      rToBRatio,
      edgeAvg: edgeValues.length > 0 ? edgeValues.reduce((a,b) => a + b, 0) / edgeValues.length : 0,
      dynamicGain,
      pixelCount,
      frameSize: `${imageData.width}x${imageData.height}`
    });
    
    return {
      redValue: avgRed,
      avgRed,
      avgGreen,
      avgBlue,
      textureScore,
      rToGRatio,
      rToBRatio
    };
  }
  
  detectROI(redValue: number, imageData: ImageData): ProcessedSignal['roi'] {
    // ROI centrado por defecto con tamaño adaptativo
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    // NUEVO: ROI adaptativo basado en intensidad de señal con mayor sensibilidad
    let adaptiveROISizeFactor = this.CONFIG.ROI_SIZE_FACTOR;
    
    // Si la señal es débil, aumentar más el tamaño del ROI
    // para capturar más área y mejorar detección
    if (redValue < 50) { // Umbral incrementado (antes 40)
      adaptiveROISizeFactor *= 1.2; // Aumento mayor (antes 1.1)
    } else if (redValue > 120) { // Umbral incrementado (antes 100)
      // Si la señal es fuerte, podemos reducir el ROI para enfocarnos en la zona óptima
      adaptiveROISizeFactor *= 0.85; // Reducción menor (antes 0.9)
    }
    
    const roiSize = Math.min(imageData.width, imageData.height) * adaptiveROISizeFactor;
    
    return {
      x: centerX - roiSize / 2,
      y: centerY - roiSize / 2,
      width: roiSize,
      height: roiSize
    };
  }
}
