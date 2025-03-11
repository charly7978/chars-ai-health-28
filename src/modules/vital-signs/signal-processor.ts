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
  private readonly MAX_FRAME_TO_FRAME_VARIATION = 0.3;
  private baselineValue: number = 0;

  // Parámetros ÓPTIMOS: más fácil detectar dedos reales, eliminar falsos positivos
  private readonly MIN_RED_THRESHOLD = 35;       // Reducido para detección más fácil
  private readonly MAX_RED_THRESHOLD = 220;     // Mantener límite superior para evitar saturación
  private readonly RED_DOMINANCE_RATIO = 1.2;   // Reducido para facilitar detección
  private readonly MIN_SIGNAL_AMPLITUDE = 4;    // Reducido para facilitar detección
  private readonly MIN_VALID_PIXELS = 80;      // Reducido para facilitar detección
  private readonly ROI_SCALE = 0.5;            // ROI más grande para capturar más del dedo
  
  // Parámetros anti-falsos positivos DRÁSTICAMENTE mejorados
  private readonly MIN_RED_COVERAGE = 0.25;     // Mínimo porcentaje ROI que debe ser rojo
  private readonly MIN_FINGER_CONTRAST = 10;    // Contraste mínimo para un dedo real
  private readonly MAX_TEXTURE_VARIANCE = 400;  // Objetos con textura no son dedos
  private readonly MAX_EDGE_RATIO = 0.2;        // Objetos con bordes definidos no son dedos
  private readonly REQUIRED_CONSISTENCY = 3;    // Frames consistentes para confirmar dedo

  // Enhanced signal quality and stability parameters
  private readonly STABILITY_THRESHOLD = 0.6;   // Reducido para ser más permisivo
  private readonly MIN_PERFUSION_INDEX = 0.07;  // Reducido para ser más permisivo
  
  // Variables de seguimiento para mejorar la precisión
  private lastValidDetectionTime: number = 0;
  private consecutiveValidFrames: number = 0;
  private lastStableValue: number = 0;
  private stableSignalCount: number = 0;
  private signalBuffer: number[] = [];
  private fingerConsistencyCounter: number = 0;
  private nonFingerConsistencyCounter: number = 0;
  private lastRedValue: number = 0;
  private redPersistenceCounter: number = 0;
  private emptyFrameCount: number = 0;
  private lastRedCoverage: number = 0;
  private lastTextureVariance: number = 0;
  private lastEdgeRatio: number = 0;

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
    
    // Calculate ROI dimensions with larger center focus for mejor captura del dedo
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
    let textureVarianceSum = 0;
    
    // Crear matriz para análisis de textura (crucial para eliminar falsos positivos)
    const redMatrix: number[][] = [];
    for (let y = startY; y < endY; y++) {
      redMatrix[y] = [];
    }
    
    // Primera pasada: identificar píxeles rojos y llenar matriz
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        if (i >= 0 && i < data.length - 3) {
          totalPixels++;
          
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Criterio más permisivo para detección inicial
          if (r > g * this.RED_DOMINANCE_RATIO && 
              r > b * this.RED_DOMINANCE_RATIO && 
              r >= this.MIN_RED_THRESHOLD && 
              r <= this.MAX_RED_THRESHOLD) {
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            redMatrix[y][x] = r;
            
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
            
            // Validación regional
            if (this.lastStableValue > 0 && Math.abs(r - this.lastStableValue) < 20) {
              validRegionCount++;
            }
          }
          
          // Detectar bordes (útil para rechazar falsos positivos)
          if (x === startX || x === endX - 1 || y === startY || y === endY - 1) {
            const isEdgeRed = r > g * 1.1 && r > b * 1.1 && r > 30;
            if (isEdgeRed) {
              edgePixelCount++;
            }
          }
        }
      }
    }
    
    // Segunda pasada: análisis de textura (sólo si hay suficientes píxeles rojos)
    if (pixelCount > this.MIN_VALID_PIXELS) {
      let texturePointsAnalyzed = 0;
      
      for (let y = startY + 1; y < endY - 1; y++) {
        for (let x = startX + 1; x < endX - 1; x++) {
          if (!redMatrix[y] || !redMatrix[y][x]) continue;
          
          const center = redMatrix[y][x];
          const neighbors = [
            redMatrix[y-1]?.[x] || 0,
            redMatrix[y+1]?.[x] || 0,
            redMatrix[y]?.[x-1] || 0,
            redMatrix[y]?.[x+1] || 0
          ].filter(n => n > 0);
          
          if (neighbors.length >= 2) {
            // Calcular varianza local (textura)
            const localVariance = neighbors.reduce((sum, val) => {
              return sum + Math.pow(val - center, 2);
            }, 0) / neighbors.length;
            
            textureVarianceSum += localVariance;
            texturePointsAnalyzed++;
          }
        }
      }
      
      // Guardar métricas de textura para análisis
      this.lastTextureVariance = texturePointsAnalyzed > 0 ? 
                               textureVarianceSum / texturePointsAnalyzed : 0;
      this.lastEdgeRatio = totalPixels > 0 ? edgePixelCount / totalPixels : 0;
    }
    
    // Área total de la ROI
    const roiArea = (endX - startX) * (endY - startY);
    const redCoverage = pixelCount / roiArea;
    this.lastRedCoverage = redCoverage;
    
    // Validación con cobertura requerida - CLAVE para eliminar falsos positivos
    if (pixelCount < this.MIN_VALID_PIXELS || redCoverage < this.MIN_RED_COVERAGE) {
      // Resetear contadores cuando no hay suficiente cobertura roja
      this.redPersistenceCounter = 0;
      this.emptyFrameCount++;
      
      if (this.emptyFrameCount > 2) {
        this.consecutiveValidFrames = 0;
        this.stableSignalCount = 0;
        this.fingerConsistencyCounter = 0;
        this.nonFingerConsistencyCounter++;
      }
      return 0;
    }
    
    // Verificar contraste - característica esencial de un dedo real
    if ((maxRed - minRed) < this.MIN_FINGER_CONTRAST) {
      this.consecutiveValidFrames = 0;
      this.nonFingerConsistencyCounter++;
      this.fingerConsistencyCounter = 0;
      return 0;
    }
    
    // Verificar si la textura es característica de un dedo
    // Los dedos tienen textura suave y homogénea
    if (this.lastTextureVariance > this.MAX_TEXTURE_VARIANCE) {
      this.nonFingerConsistencyCounter++;
      this.fingerConsistencyCounter = 0;
      return 0;
    }
    
    // Verificar si la proporción de bordes es característica de un dedo
    // Los dedos tienen bordes suaves y difusos
    if (this.lastEdgeRatio > this.MAX_EDGE_RATIO) {
      this.nonFingerConsistencyCounter++;
      this.fingerConsistencyCounter = 0;
      return 0;
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Verificar cambio drástico respecto al valor anterior (indicador de falso positivo)
    if (this.lastRedValue > 0) {
      const change = Math.abs(avgRed - this.lastRedValue) / this.lastRedValue;
      if (change > 0.4) { // Cambio de más del 40% es sospechoso
        this.nonFingerConsistencyCounter++;
        this.fingerConsistencyCounter = 0;
        this.lastRedValue = avgRed;
        return 0;
      }
    }
    
    // Validación de señal con criterios balanceados
    const isValidSignal = 
      avgRed >= this.MIN_RED_THRESHOLD &&
      avgRed <= this.MAX_RED_THRESHOLD &&
      (maxRed - minRed) >= this.MIN_SIGNAL_AMPLITUDE &&
      avgRed > (avgGreen * this.RED_DOMINANCE_RATIO) && 
      avgRed > (avgBlue * this.RED_DOMINANCE_RATIO);
    
    // Actualizar contadores de consistencia
    if (isValidSignal) {
      this.fingerConsistencyCounter++;
      this.nonFingerConsistencyCounter = 0;
      this.emptyFrameCount = 0;
    } else {
      this.nonFingerConsistencyCounter++;
      this.fingerConsistencyCounter = 0;
    }
    
    // Aplicar criterio de consistencia - CRUCIAL para eliminar falsos positivos
    // Un dedo real debe tener varios frames consecutivos con buena señal
    if (this.fingerConsistencyCounter >= this.REQUIRED_CONSISTENCY) {
      // Señal considerada válida tras confirmación de consistencia
      this.lastRedValue = avgRed;
      return avgRed;
    } else if (this.nonFingerConsistencyCounter > 1) {
      // Posible falso positivo
      this.lastRedValue = avgRed;
      return 0;
    }
    
    // Fase de evaluación
    this.lastRedValue = avgRed;
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
