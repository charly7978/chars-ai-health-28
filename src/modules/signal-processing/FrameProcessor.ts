
import { FrameData } from './types';
import { ProcessedSignal } from '../../types/signal';

export class FrameProcessor {
  private readonly CONFIG: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number };
  
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
    const cells: Array<{ red: number, green: number, blue: number, count: number }> = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      cells.push({ red: 0, green: 0, blue: 0, count: 0 });
    }
    
    // DETECCIÓN EXTREMADAMENTE SENSIBLE
    // Contar cualquier pixel con mínima presencia de color
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
        
        cells[cellIdx].red += r;
        cells[cellIdx].green += g;
        cells[cellIdx].blue += b;
        cells[cellIdx].count++;
        
        // CAMBIO CRÍTICO: INCLUIR TODOS LOS PIXELS
        // No hay criterio de filtrado, todos los pixels se consideran
        redSum += r;
        greenSum += g;
        blueSum += b;
        pixelCount++;
      }
    }
    
    // Calcular textura (variación entre celdas)
    let textureScore = 0;
    if (cells.some(cell => cell.count > 0)) {
      // Normalizar celdas por conteo
      const normCells = cells
        .filter(cell => cell.count > 0)
        .map(cell => ({
          red: cell.red / cell.count,
          green: cell.green / cell.count,
          blue: cell.blue / cell.count
        }));
      
      if (normCells.length > 1) {
        // Calcular variaciones entre celdas adyacentes
        let totalVariation = 0;
        let comparisonCount = 0;
        
        for (let i = 0; i < normCells.length; i++) {
          for (let j = i + 1; j < normCells.length; j++) {
            const cell1 = normCells[i];
            const cell2 = normCells[j];
            
            // Calcula diferencia de color
            const redDiff = Math.abs(cell1.red - cell2.red);
            const greenDiff = Math.abs(cell1.green - cell2.green);
            const blueDiff = Math.abs(cell1.blue - cell2.blue);
            
            // Promedio de diferencias
            const avgDiff = (redDiff + greenDiff + blueDiff) / 3;
            totalVariation += avgDiff;
            comparisonCount++;
          }
        }
        
        if (comparisonCount > 0) {
          const avgVariation = totalVariation / comparisonCount;
          
          // Mayor variación indica más textura
          // EXTREMA SENSIBILIDAD: Cualquier variación es suficiente
          const normalizedVar = avgVariation / 5; // Reducido drásticamente
          textureScore = Math.min(1, normalizedVar);
        }
      }
    }
    
    // Si no hay pixels rojos, retornar valores por defecto
    if (pixelCount < 1) {
      console.log("FrameProcessor: No se detectaron pixels en este frame");
      return { 
        redValue: 0, 
        textureScore: 0, 
        rToGRatio: 0, 
        rToBRatio: 0 
      };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calcular índices de ratio de color
    const rToGRatio = avgRed / Math.max(1, avgGreen);
    const rToBRatio = avgRed / Math.max(1, avgBlue);
    
    console.log("FrameProcessor: Datos extraídos:", {
      avgRed, 
      avgGreen, 
      avgBlue,
      textureScore,
      rToGRatio, 
      rToBRatio
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
    // ROI centrado por defecto
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * this.CONFIG.ROI_SIZE_FACTOR;
    
    return {
      x: centerX - roiSize / 2,
      y: centerY - roiSize / 2,
      width: roiSize,
      height: roiSize
    };
  }
}
