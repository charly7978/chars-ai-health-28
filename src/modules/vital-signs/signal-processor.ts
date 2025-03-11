
import { calculateAC, calculateDC } from './utils';

/**
 * Enhanced Signal Processor based on advanced biomedical signal processing techniques
 */
export class SignalProcessor {
  private readonly SMA_WINDOW = 5;
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 300;
  private readonly SG_COEFFS = [0.2, 0.3, 0.5, 0.7, 1.0, 0.7, 0.5, 0.3, 0.2];
  private readonly SG_NORM = 4.4;
  private readonly WAVELET_THRESHOLD = 0.03;
  private readonly BASELINE_FACTOR = 0.92;
  private baselineValue: number = 0;

  // Parámetros más permisivos para la detección de dedos, pero estrictos contra falsos positivos
  private readonly MIN_RED_THRESHOLD = 50;      // Reducido para detección más fácil
  private readonly MAX_RED_THRESHOLD = 220;     // Mantener límite superior para evitar saturación
  private readonly RED_DOMINANCE_RATIO = 1.3;   // Reducido para facilitar detección
  private readonly MIN_SIGNAL_AMPLITUDE = 4;    // Reducido para facilitar detección
  private readonly MIN_VALID_PIXELS = 100;      // Reducido para facilitar detección
  private readonly ROI_SCALE = 0.35;            // ROI más grande para capturar más del dedo
  private readonly SIGNAL_MEMORY = 5;
  private readonly HYSTERESIS = 10;             // Reducido para más responsividad
  
  // Parámetros anti-falsos positivos
  private readonly MIN_RED_COVERAGE = 0.2;      // Mínimo porcentaje ROI que debe ser rojo
  private readonly MIN_FINGER_CONTRAST = 10;    // Contraste mínimo para un dedo real
  private readonly MIN_RED_PERSISTENCE = 3;     // Mínimo frames consistentes con señal fuerte

  // Enhanced signal quality and stability parameters
  private readonly STABILITY_THRESHOLD = 0.7;   // Reducido para ser más permisivo
  private readonly MIN_PERFUSION_INDEX = 0.08;  // Reducido para ser más permisivo
  private readonly MAX_FRAME_TO_FRAME_VARIATION = 15; // Incrementado para ser más permisivo
  private lastValidDetectionTime: number = 0;
  private consecutiveValidFrames: number = 0;
  private readonly MIN_CONSECUTIVE_FRAMES = 3;  // Reducido para detección más rápida
  private lastStableValue: number = 0;
  private stableSignalCount: number = 0;
  private readonly MIN_STABLE_SIGNAL_COUNT = 8; // Reducido para ser más permisivo
  private signalBuffer: number[] = [];
  private readonly SIGNAL_BUFFER_SIZE = 30;
  
  // Anti-falsos positivos cuando se quita el dedo
  private emptyFrameCount: number = 0;
  private readonly MAX_EMPTY_FRAMES = 3;
  private lastRedValue: number = 0;
  private redPersistenceCounter: number = 0;

  /**
   * Applies a wavelet-based noise reduction followed by Savitzky-Golay filtering
   */
  public applySMAFilter(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      console.warn('SignalProcessor: Invalid input value', value);
      return 0;
    }

    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    // Initialize baseline value if needed
    if (this.baselineValue === 0 && this.ppgValues.length > 0) {
      this.baselineValue = value;
    } else {
      // Adaptive baseline tracking
      this.baselineValue = this.baselineValue * this.BASELINE_FACTOR + 
                          value * (1 - this.BASELINE_FACTOR);
    }
    
    // Apply SMA filter
    const smaBuffer = this.ppgValues.slice(-this.SMA_WINDOW);
    const smaValue = smaBuffer.reduce((a, b) => a + b, 0) / smaBuffer.length;
    
    // Apply denoising and SG filter
    const denoised = this.waveletDenoise(smaValue);
    
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(denoised);
    }
    
    return denoised;
  }

  /**
   * Extracts red channel with improved finger detection and strong false positive rejection
   */
  private extractRedChannel(imageData: ImageData): number {
    if (!imageData || !imageData.data || imageData.data.length === 0) {
      console.warn('SignalProcessor: Invalid image data');
      return 0;
    }

    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let totalPixels = 0;
    
    // Calculate ROI dimensions with larger center focus
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * this.ROI_SCALE;
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    let maxRed = 0;
    let minRed = 255;
    let validRegionCount = 0;
    let edgePixelCount = 0;
    
    // Analizar primero el centro de la ROI (más importante para la detección)
    const innerStartX = Math.max(0, Math.floor(centerX - roiSize / 4));
    const innerEndX = Math.min(imageData.width, Math.floor(centerX + roiSize / 4));
    const innerStartY = Math.max(0, Math.floor(centerY - roiSize / 4));
    const innerEndY = Math.min(imageData.height, Math.floor(centerY + roiSize / 4));
    
    // Primero procesar el área central para verificar si hay un dedo
    for (let y = innerStartY; y < innerEndY; y++) {
      for (let x = innerStartX; x < innerEndX; x++) {
        const i = (y * imageData.width + x) * 4;
        if (i >= 0 && i < data.length - 3) {
          totalPixels++;
          
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Criterio más permisivo para la dominancia del rojo
          if (r > g * this.RED_DOMINANCE_RATIO && 
              r > b * this.RED_DOMINANCE_RATIO && 
              r >= this.MIN_RED_THRESHOLD && 
              r <= this.MAX_RED_THRESHOLD) {
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
            
            // Validación regional mejorada
            if (Math.abs(r - this.lastStableValue) < this.HYSTERESIS) {
              validRegionCount++;
            }
          }
        }
      }
    }
    
    // Si el centro de la ROI no tiene suficientes píxeles rojos, procesar el resto
    const centerCoverage = pixelCount / Math.max(1, totalPixels);
    if (centerCoverage < this.MIN_RED_COVERAGE) {
      // Procesar el resto de la ROI
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          // Saltar el centro que ya procesamos
          if (x >= innerStartX && x < innerEndX && y >= innerStartY && y < innerEndY) {
            continue;
          }
          
          const i = (y * imageData.width + x) * 4;
          if (i >= 0 && i < data.length - 3) {
            totalPixels++;
            
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Criterio más permisivo para la dominancia del rojo
            if (r > g * this.RED_DOMINANCE_RATIO && 
                r > b * this.RED_DOMINANCE_RATIO && 
                r >= this.MIN_RED_THRESHOLD && 
                r <= this.MAX_RED_THRESHOLD) {
              
              redSum += r;
              greenSum += g;
              blueSum += b;
              pixelCount++;
              
              maxRed = Math.max(maxRed, r);
              minRed = Math.min(minRed, r);
              
              // Validación regional mejorada
              if (Math.abs(r - this.lastStableValue) < this.HYSTERESIS) {
                validRegionCount++;
              }
            }
            
            // Detectar bordes (útil para rechazar falsos positivos)
            if (x === startX || x === endX - 1 || y === startY || y === endY - 1) {
              const isEdgeRed = r > g * 1.2 && r > b * 1.2 && r > 40;
              if (isEdgeRed) {
                edgePixelCount++;
              }
            }
          }
        }
      }
    }
    
    // Área total de la ROI
    const roiArea = (endX - startX) * (endY - startY);
    const redCoverage = pixelCount / roiArea;
    
    // Validación con cobertura requerida
    if (pixelCount < this.MIN_VALID_PIXELS || redCoverage < this.MIN_RED_COVERAGE) {
      // Resetear contadores cuando no hay suficiente cobertura roja
      this.emptyFrameCount++;
      this.redPersistenceCounter = 0;
      this.consecutiveValidFrames = 0;
      this.stableSignalCount = 0;
      return 0;
    }
    
    // También verificar contraste - característica esencial de un dedo real
    if ((maxRed - minRed) < this.MIN_FINGER_CONTRAST) {
      this.consecutiveValidFrames = 0;
      this.redPersistenceCounter = 0;
      return 0;
    }
    
    const currentTime = Date.now();
    const avgRed = redSum / pixelCount;
    const signalAmplitude = maxRed - minRed;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Detectar falsos positivos basados en el patrón de los bordes
    // Los objetos que no son dedos suelen tener bordes más definidos
    const edgeRatio = edgePixelCount / Math.max(1, (endX - startX) * 2 + (endY - startY) * 2);
    const hasStrongEdges = edgeRatio > 0.4 && edgePixelCount > 15;
    
    // Validar cambios abruptos de valor que indican falsos positivos
    const hasAbruptChange = this.lastRedValue > 0 && 
                          Math.abs(avgRed - this.lastRedValue) / this.lastRedValue > 0.5;
    
    // Detección de falsos positivos mejorada
    if (hasStrongEdges || hasAbruptChange) {
      this.redPersistenceCounter = 0;
      this.emptyFrameCount = 0;
      return 0;
    }
    
    // Validación de señal con criterios más permisivos
    const isValidSignal = 
      avgRed >= this.MIN_RED_THRESHOLD &&
      avgRed <= this.MAX_RED_THRESHOLD &&
      signalAmplitude >= this.MIN_SIGNAL_AMPLITUDE &&
      avgRed > (avgGreen * this.RED_DOMINANCE_RATIO * 0.9) && // Más permisivo
      avgRed > (avgBlue * this.RED_DOMINANCE_RATIO * 0.9) &&  // Más permisivo
      validRegionCount >= (pixelCount * 0.35); // Reducido para ser más permisivo
    
    // Buffer para análisis de estabilidad de señal
    this.signalBuffer.push(avgRed);
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Calcular estabilidad de la señal
    const isStableSignal = this.signalBuffer.length >= 4 && this.calculateSignalStability();
    
    // Actualizar el valor rojo previo para comparaciones futuras
    this.lastRedValue = avgRed;
    
    if (isValidSignal) {
      // Incrementar contador de persistencia para valores rojos válidos
      this.redPersistenceCounter++;
      this.emptyFrameCount = 0;
      
      // Sólo considerar la señal válida después de persistencia continua
      if (this.redPersistenceCounter >= this.MIN_RED_PERSISTENCE) {
        if (isStableSignal) {
          this.consecutiveValidFrames++;
          this.lastValidDetectionTime = currentTime;
          this.stableSignalCount++;
          
          // Sólo retornar señal después de detección estable consistente
          if (this.consecutiveValidFrames >= this.MIN_CONSECUTIVE_FRAMES && 
              this.stableSignalCount >= this.MIN_STABLE_SIGNAL_COUNT) {
            this.lastStableValue = avgRed;
            return avgRed;
          }
        }
      }
    } else {
      // Resetear contadores de persistencia
      this.redPersistenceCounter = 0;
      
      // Mantener brevemente la memoria de señal
      if (currentTime - this.lastValidDetectionTime < 400) {
        return this.lastStableValue;
      }
      
      this.consecutiveValidFrames = Math.max(0, this.consecutiveValidFrames - 1);
      this.stableSignalCount = Math.max(0, this.stableSignalCount - 1);
    }
    
    return 0;
  }

  private calculateStability(): number {
    if (this.ppgValues.length < 2) return 0;
    
    const variations = this.ppgValues.slice(1).map((val, i) => 
      Math.abs(val - this.ppgValues[i])
    );
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    const normalizedStability = Math.max(0, Math.min(1, 1 - (avgVariation / this.MAX_FRAME_TO_FRAME_VARIATION)));
    
    return normalizedStability > this.STABILITY_THRESHOLD ? normalizedStability : 0;
  }

  /**
   * Simplified wavelet denoising based on soft thresholding
   */
  private waveletDenoise(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return this.baselineValue;
    }

    const normalizedValue = value - this.baselineValue;
    
    if (Math.abs(normalizedValue) < this.WAVELET_THRESHOLD) {
      return this.baselineValue;
    }
    
    const sign = normalizedValue >= 0 ? 1 : -1;
    const denoisedValue = sign * (Math.abs(normalizedValue) - this.WAVELET_THRESHOLD);
    
    return this.baselineValue + denoisedValue;
  }

  /**
   * Implements Savitzky-Golay filtering
   */
  private applySavitzkyGolayFilter(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return 0;
    }

    const recentValues = this.ppgValues.slice(-this.SG_COEFFS.length);
    let filteredValue = 0;
    
    for (let i = 0; i < this.SG_COEFFS.length; i++) {
      if (i < recentValues.length) {
        filteredValue += recentValues[i] * this.SG_COEFFS[i];
      }
    }
    
    return filteredValue / this.SG_NORM;
  }

  public reset(): void {
    this.ppgValues = [];
    this.baselineValue = 0;
    this.emptyFrameCount = 0;
    this.redPersistenceCounter = 0;
    this.lastRedValue = 0;
    this.consecutiveValidFrames = 0;
    this.stableSignalCount = 0;
    this.lastStableValue = 0;
    this.lastValidDetectionTime = 0;
    this.signalBuffer = [];
  }

  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }

  /**
   * Enhanced signal stability calculation with reduced threshold
   */
  private calculateSignalStability(): boolean {
    if (this.signalBuffer.length < 4) return false; // Reducido de 5 a 4
    
    // Calculate moving statistics
    const recentValues = this.signalBuffer.slice(-4); // Reducido de 5 a 4
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calculate variance
    const variance = recentValues.reduce((acc, val) => {
      const diff = val - mean;
      return acc + (diff * diff);
    }, 0) / recentValues.length;
    
    // Check frame-to-frame variations
    const maxVariation = Math.max(...recentValues.slice(1).map((val, i) => 
      Math.abs(val - recentValues[i])
    ));
    
    // Combined stability check with criterios más permisivos
    return variance < (mean * 0.1) && // Incrementado de 0.08 a 0.1 - más permisivo
           maxVariation < this.MAX_FRAME_TO_FRAME_VARIATION;
  }
}
