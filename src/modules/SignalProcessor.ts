
import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../types/signal';

/**
 * Implementación de Filtro Kalman para procesamiento de señal
 */
class KalmanFilter {
  private R: number = 0.01; // Varianza de la medición (ruido del sensor)
  private Q: number = 0.1;  // Varianza del proceso
  private P: number = 1;    // Covarianza del error estimado
  private X: number = 0;    // Estado estimado
  private K: number = 0;    // Ganancia de Kalman

  filter(measurement: number): number {
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

/**
 * Implementación de filtro Savitzky-Golay para suavizado 
 * preservando características de picos en la señal
 */
class SavitzkyGolayFilter {
  private readonly coefficients: number[];
  private readonly normFactor: number;
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 9) {
    // Coeficientes para ventana de 9 puntos (polinomio de grado 2)
    this.windowSize = windowSize;
    this.coefficients = [0.035, 0.105, 0.175, 0.245, 0.285, 0.245, 0.175, 0.105, 0.035];
    this.normFactor = 1.405;
    this.buffer = new Array(windowSize).fill(0);
  }

  filter(value: number): number {
    // Actualizar buffer
    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }
    
    if (this.buffer.length < this.windowSize) {
      return value; // No tenemos suficientes puntos
    }
    
    // Aplicar convolución con coeficientes S-G
    let filtered = 0;
    for (let i = 0; i < this.windowSize; i++) {
      filtered += this.buffer[i] * this.coefficients[i];
    }
    
    return filtered / this.normFactor;
  }

  reset(): void {
    this.buffer = new Array(this.windowSize).fill(0);
  }
}

/**
 * Clase para análisis de tendencias de la señal PPG
 * Implementa detección de patrones y estabilidad
 */
class SignalTrendAnalyzer {
  private readonly historyLength: number;
  private valueHistory: number[] = [];
  private diffHistory: number[] = [];
  private patternHistory: string[] = [];
  private trendScores: {
    stability: number;
    periodicity: number;
    consistency: number;
    physiological: number;
  } = { stability: 0, periodicity: 0, consistency: 0, physiological: 0 };

  constructor(historyLength: number = 30) {
    this.historyLength = historyLength;
  }

  addValue(value: number): void {
    // Actualizar historiales
    this.valueHistory.push(value);
    if (this.valueHistory.length > this.historyLength) {
      this.valueHistory.shift();
    }
    
    // Calcular diferencias
    if (this.valueHistory.length >= 2) {
      const diff = value - this.valueHistory[this.valueHistory.length - 2];
      this.diffHistory.push(diff);
      if (this.diffHistory.length > this.historyLength - 1) {
        this.diffHistory.shift();
      }
      
      // Detectar dirección (subiendo/bajando)
      const pattern = diff > 0 ? "+" : (diff < 0 ? "-" : "=");
      this.patternHistory.push(pattern);
      if (this.patternHistory.length > this.historyLength - 1) {
        this.patternHistory.shift();
      }
    }
    
    // Actualizar análisis
    this.updateAnalysis();
  }

  private updateAnalysis(): void {
    if (this.valueHistory.length < 10) return;
    
    // 1. Calcular estabilidad (basada en desviación estándar normalizada)
    const mean = this.valueHistory.reduce((sum, val) => sum + val, 0) / this.valueHistory.length;
    const variance = this.valueHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.valueHistory.length;
    const stdDev = Math.sqrt(variance);
    const normalizedStdDev = stdDev / Math.max(1, Math.abs(mean));
    this.trendScores.stability = Math.max(0, Math.min(1, 1 - normalizedStdDev * 5));
    
    // 2. Calcular periodicidad (basada en cruces por cero y cambios de dirección)
    let directionChanges = 0;
    for (let i = 1; i < this.patternHistory.length; i++) {
      if (this.patternHistory[i] !== this.patternHistory[i-1]) {
        directionChanges++;
      }
    }
    
    // Normalizar cambios de dirección a valor 0-1 (óptimo: entre 8-20 para ventana de 30)
    const normalizedChanges = directionChanges / this.patternHistory.length;
    this.trendScores.periodicity = normalizedChanges < 0.2 ? normalizedChanges * 5 : 
                                 normalizedChanges > 0.6 ? Math.max(0, 1 - (normalizedChanges - 0.6) * 2.5) :
                                 1;
    
    // 3. Calcular consistencia temporal (patrones repetitivos)
    let patternScore = 0;
    if (this.patternHistory.length >= 6) {
      // Buscar patrones tipo "+-+-+-" o "-+-+-+"
      const pattern = this.patternHistory.join('');
      const alternatingPattern1 = "+-".repeat(10);
      const alternatingPattern2 = "-+".repeat(10);
      
      if (pattern.includes("+-+-+") || pattern.includes("-+-+-")) {
        patternScore += 0.6;
      }
      
      // Verificar secuencia de longitud 4
      for (let i = 0; i < this.patternHistory.length - 4; i++) {
        const subPattern = this.patternHistory.slice(i, i + 4).join('');
        if (pattern.lastIndexOf(subPattern) > i + 3) {
          patternScore += 0.4;
          break;
        }
      }
    }
    this.trendScores.consistency = Math.min(1, patternScore);
    
    // 4. Verificar si el comportamiento es fisiológicamente plausible (frecuencias en rango de pulso)
    let physiologicalScore = 0;
    if (this.valueHistory.length >= 15 && directionChanges >= 4) {
      const peaksPerSecond = directionChanges / 2 / (this.valueHistory.length / 30); // Asumir 30fps
      const equivalentBPM = peaksPerSecond * 60;
      
      // Verificar si está en el rango fisiológico (40-180 BPM)
      if (equivalentBPM >= 40 && equivalentBPM <= 180) {
        physiologicalScore = 1;
      } else if (equivalentBPM > 30 && equivalentBPM < 200) {
        // Cerca del rango fisiológico
        physiologicalScore = 0.5;
      }
    }
    this.trendScores.physiological = physiologicalScore;
  }

  getScores(): { stability: number; periodicity: number; consistency: number; physiological: number } {
    return { ...this.trendScores };
  }

  getAnalysisResult(): 'highly_stable' | 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' | 'non_physiological' {
    const { stability, periodicity, consistency, physiological } = this.trendScores;
    const compositeScore = stability * 0.3 + periodicity * 0.3 + consistency * 0.2 + physiological * 0.2;
    
    // Reglas especiales
    if (physiological < 0.3 && this.valueHistory.length > 15) {
      return 'non_physiological';
    }
    
    if (compositeScore > 0.8) return 'highly_stable';
    if (compositeScore > 0.65) return 'stable';
    if (compositeScore > 0.45) return 'moderately_stable';
    if (compositeScore > 0.25) return 'unstable';
    return 'highly_unstable';
  }

  reset(): void {
    this.valueHistory = [];
    this.diffHistory = [];
    this.patternHistory = [];
    this.trendScores = { stability: 0, periodicity: 0, consistency: 0, physiological: 0 };
  }
}

/**
 * Sistema de detección multiespectral de tejido vivo
 * basado en características de la piel humana y patrones PPG
 */
class BiophysicalValidator {
  private readonly MIN_R_TO_G_RATIO = 1.15;
  private readonly MIN_R_TO_B_RATIO = 1.15;
  private readonly MIN_PULSATILITY = 0.8;
  private readonly MAX_PULSATILITY = 4.5;
  private readonly MIN_TEXTURE_SCORE = 0.45;
  private perfusionHistory: number[] = [];
  private colorRatioHistory: { rToG: number, rToB: number }[] = [];

  addSample(pixelData: { 
    r: number, 
    g: number, 
    b: number, 
    perfusionIdx?: number,
    textureScore?: number 
  }): { isValidTissue: boolean; confidence: number; metrics: Record<string, number> } {
    const { r, g, b, perfusionIdx = 0, textureScore: inputTextureScore = 0 } = pixelData;
    
    // 1. Validar dominancia de canal rojo (característica de hemoglobina)
    const rToGRatio = r / Math.max(1, g);
    const rToBRatio = r / Math.max(1, b);
    
    // Guardar historiales
    this.colorRatioHistory.push({ rToG: rToGRatio, rToB: rToBRatio });
    if (this.colorRatioHistory.length > 10) this.colorRatioHistory.shift();
    
    if (perfusionIdx > 0) {
      this.perfusionHistory.push(perfusionIdx);
      if (this.perfusionHistory.length > 10) this.perfusionHistory.shift();
    }
    
    // 2. Calcular métricas promediadas
    const avgRToG = this.colorRatioHistory.reduce((sum, item) => sum + item.rToG, 0) / 
                   this.colorRatioHistory.length;
    const avgRToB = this.colorRatioHistory.reduce((sum, item) => sum + item.rToB, 0) / 
                   this.colorRatioHistory.length;
    
    // 3. Calcular puntuaciones individuales
    const colorRatioScore = (
      (avgRToG > this.MIN_R_TO_G_RATIO ? avgRToG / this.MIN_R_TO_G_RATIO : 0) +
      (avgRToB > this.MIN_R_TO_B_RATIO ? avgRToB / this.MIN_R_TO_B_RATIO : 0)
    ) / 2;
    
    // Limitar a máximo 1.0
    const normalizedColorScore = Math.min(1.0, colorRatioScore);
    
    // 4. Evaluar perfusión (si está disponible)
    let perfusionScore = 0;
    if (this.perfusionHistory.length > 0) {
      const avgPerfusion = this.perfusionHistory.reduce((sum, val) => sum + val, 0) / 
                          this.perfusionHistory.length;
      
      perfusionScore = avgPerfusion > this.MIN_PULSATILITY && avgPerfusion < this.MAX_PULSATILITY ?
                      1.0 : 0;
    }
    
    // 5. Evaluar textura (si está disponible)
    const processedTextureScore = inputTextureScore > this.MIN_TEXTURE_SCORE ? 
                       inputTextureScore : 0;
    
    // 6. Combinar puntuaciones
    const availableMetrics = [
      normalizedColorScore > 0 ? 1 : 0,
      perfusionScore > 0 ? 1 : 0,
      processedTextureScore > 0 ? 1 : 0
    ].filter(Boolean).length;
    
    // Calcular confianza basada en métricas disponibles
    const totalScore = (normalizedColorScore + perfusionScore + processedTextureScore) / 
                      Math.max(1, availableMetrics);
    
    // Umbral para considerar tejido vivo
    const isValidTissue = totalScore > 0.6;
    
    return {
      isValidTissue,
      confidence: totalScore,
      metrics: {
        colorRatio: normalizedColorScore,
        perfusion: perfusionScore,
        texture: processedTextureScore
      }
    };
  }

  reset(): void {
    this.perfusionHistory = [];
    this.colorRatioHistory = [];
  }
}

/**
 * Procesador avanzado de señal PPG con detección robusta de dedo
 * e indicador de calidad de 20 puntos
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private sgFilter: SavitzkyGolayFilter;
  private trendAnalyzer: SignalTrendAnalyzer;
  private biophysicalValidator: BiophysicalValidator;
  private lastValues: number[] = [];
  
  // Configuración basada en nuestro plan
  private readonly CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 40, 
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 4, 
    HYSTERESIS: 3,
    MIN_CONSECUTIVE_DETECTIONS: 3,
    MAX_CONSECUTIVE_NO_DETECTIONS: 2,
    QUALITY_LEVELS: 20,
    QUALITY_HISTORY_SIZE: 10,
    CALIBRATION_SAMPLES: 30,
    TEXTURE_GRID_SIZE: 8,
    ROI_SIZE_FACTOR: 0.25
  };
  
  private calibrationValues = {
    baselineRed: 0,
    baselineVariance: 0,
    minRedThreshold: 0,
    maxRedThreshold: 0,
    isCalibrated: false
  };

  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private consecutiveNoDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 250;
  private qualityHistory: number[] = [];
  private detectorScores: Record<string, number> = {
    redChannel: 0,
    stability: 0,
    pulsatility: 0,
    biophysical: 0,
    periodicity: 0
  };
  private isCalibrating: boolean = false;
  private calibrationSamples: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.trendAnalyzer = new SignalTrendAnalyzer();
    this.biophysicalValidator = new BiophysicalValidator();
    console.log("PPGSignalProcessor: Instancia avanzada creada con nueva configuración", this.CONFIG);
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.consecutiveNoDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.qualityHistory = [];
      this.detectorScores = {
        redChannel: 0,
        stability: 0,
        pulsatility: 0,
        biophysical: 0,
        periodicity: 0
      };
      this.kalmanFilter.reset();
      this.sgFilter.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      
      if (!this.calibrationValues.isCalibrated) {
        // Usar valores predeterminados hasta calibración
        this.calibrationValues.minRedThreshold = this.CONFIG.MIN_RED_THRESHOLD;
        this.calibrationValues.maxRedThreshold = this.CONFIG.MAX_RED_THRESHOLD;
      }
      
      console.log("PPGSignalProcessor: Sistema inicializado con nueva arquitectura");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador avanzado");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Sistema avanzado iniciado");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.consecutiveDetections = 0;
    this.consecutiveNoDetections = 0;
    this.isCurrentlyDetected = false;
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    console.log("PPGSignalProcessor: Sistema avanzado detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración adaptativa");
      await this.initialize();
      
      // Marcar modo de calibración
      this.isCalibrating = true;
      this.calibrationSamples = [];
      
      // La recolección de muestras se hará en processFrame
      // y la calibración se completará automáticamente
      
      console.log("PPGSignalProcessor: Calibración adaptativa iniciada");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración adaptativa");
      this.isCalibrating = false;
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // 1. Extraer características del frame
      const extractionResult = this.extractFrameData(imageData);
      const { redValue, textureScore, rToGRatio, rToBRatio } = extractionResult;
      const roi = this.detectROI(redValue, imageData);
      
      // 2. Manejo de calibración si está activa
      if (this.isCalibrating) {
        this.handleCalibration(redValue);
        
        // Si estamos calibrando, generamos una señal provisional
        if (this.onSignalReady) {
          const provSignal: ProcessedSignal = {
            timestamp: Date.now(),
            rawValue: redValue,
            filteredValue: this.kalmanFilter.filter(redValue),
            quality: 40, // Calidad fija durante calibración
            fingerDetected: redValue > 10,
            roi: roi,
            perfusionIndex: 0.1
          };
          this.onSignalReady(provSignal);
        }
        
        return; // No continuamos el procesamiento normal
      }
      
      // 3. Aplicar filtrado avanzado
      const kalmanFiltered = this.kalmanFilter.filter(redValue);
      const sgFiltered = this.sgFilter.filter(kalmanFiltered);
      
      // 4. Actualizar analizador de tendencias
      this.trendAnalyzer.addValue(sgFiltered);
      const trendResult = this.trendAnalyzer.getAnalysisResult();
      const trendScores = this.trendAnalyzer.getScores();
      
      // 5. Estimar índice de perfusión
      const perfusionIndex = redValue > 0 ? 
        Math.abs(sgFiltered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      // 6. Validación biofísica
      const biophysicalResult = this.biophysicalValidator.addSample({
        r: extractionResult.avgRed || 0,
        g: extractionResult.avgGreen || 0,
        b: extractionResult.avgBlue || 0,
        perfusionIdx: perfusionIndex,
        textureScore: textureScore
      });
      
      // 7. Actualizar puntuaciones de detectores
      this.updateDetectorScores({
        redValue,
        redChannel: redValue > this.calibrationValues.minRedThreshold ? 
                   Math.min(1, (redValue - this.calibrationValues.minRedThreshold) / 
                          (this.calibrationValues.maxRedThreshold - this.calibrationValues.minRedThreshold)) : 0,
        stability: trendScores.stability,
        pulsatility: perfusionIndex > 0.08 && perfusionIndex < 2 ? 
                    Math.min(1, perfusionIndex * 2) : 0,
        biophysical: biophysicalResult.confidence,
        periodicity: trendScores.periodicity
      });
      
      // 8. Análisis avanzado con múltiples detectores
      const { isFingerDetected, quality, detectorDetails } = 
        this.analyzeSignalMultiDetector(sgFiltered, trendResult);
      
      // 9. Crear objeto de señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: sgFiltered,
        quality: quality, // This is now ensured to be a number
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
      };
      
      // 10. Reportar métricas de depuración
      if (isFingerDetected !== this.isCurrentlyDetected) {
        console.log(`PPGSignalProcessor: Cambio en detección: ${this.isCurrentlyDetected} → ${isFingerDetected}`, {
          rawRed: redValue,
          filtered: sgFiltered,
          quality,
          detectorScores: this.detectorScores,
          detectorDetails,
          trendResult,
          calibration: this.calibrationValues
        });
      }
      
      // 11. Almacenar último valor estable y enviar señal
      if (isFingerDetected) {
        this.lastStableValue = sgFiltered;
      }
      
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en el procesamiento avanzado de frame");
    }
  }

  private extractFrameData(imageData: ImageData): {
    redValue: number;
    avgRed?: number;
    avgGreen?: number;
    avgBlue?: number;
    textureScore: number;
    rToGRatio: number;
    rToBRatio: number;
  } {
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
        
        // Criterio de dominancia de rojo más adaptativo
        if (r > g * 1.05 && r > b * 1.05) {
          redSum += r;
          greenSum += g;
          blueSum += b;
          pixelCount++;
        }
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
          // Normalizar a rango 0-1 con curva óptima para piel
          const normalizedVar = avgVariation / 25; // 25 es un valor típico para textura de piel
          textureScore = Math.min(1, normalizedVar);
        }
      }
    }
    
    if (pixelCount < 10) {
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

  private handleCalibration(redValue: number): void {
    // Si el valor es muy bajo, ignoramos
    if (redValue < 10) return;
    
    this.calibrationSamples.push(redValue);
    
    // Si tenemos suficientes muestras, completar calibración
    if (this.calibrationSamples.length >= this.CONFIG.CALIBRATION_SAMPLES) {
      // Ordenar muestras para análisis
      const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
      
      // Eliminar valores extremos (10% superior e inferior)
      const trimmedSamples = sortedSamples.slice(
        Math.floor(sortedSamples.length * 0.1),
        Math.ceil(sortedSamples.length * 0.9)
      );
      
      // Calcular estadísticas
      const sum = trimmedSamples.reduce((acc, val) => acc + val, 0);
      const mean = sum / trimmedSamples.length;
      
      const variance = trimmedSamples.reduce(
        (acc, val) => acc + Math.pow(val - mean, 2), 0
      ) / trimmedSamples.length;
      
      // Establecer umbrales calibrados
      this.calibrationValues.baselineRed = mean;
      this.calibrationValues.baselineVariance = variance;
      this.calibrationValues.minRedThreshold = Math.max(
        30, 
        mean - Math.sqrt(variance) * 2
      );
      this.calibrationValues.maxRedThreshold = Math.min(
        250,
        mean + Math.sqrt(variance) * 5
      );
      this.calibrationValues.isCalibrated = true;
      
      console.log("PPGSignalProcessor: Calibración completada:", this.calibrationValues);
      
      // Salir de modo calibración
      this.isCalibrating = false;
      this.calibrationSamples = [];
    }
  }

  private updateDetectorScores(scores: {
    redValue: number;
    redChannel: number;
    stability: number;
    pulsatility: number;
    biophysical: number;
    periodicity: number;
  }): void {
    // Factor de suavizado para cambios
    const alpha = 0.2;
    
    // Actualizar cada puntuación con suavizado
    this.detectorScores.redChannel = 
      (1 - alpha) * this.detectorScores.redChannel + alpha * scores.redChannel;
    
    this.detectorScores.stability = 
      (1 - alpha) * this.detectorScores.stability + alpha * scores.stability;
    
    this.detectorScores.pulsatility = 
      (1 - alpha) * this.detectorScores.pulsatility + alpha * scores.pulsatility;
    
    this.detectorScores.biophysical = 
      (1 - alpha) * this.detectorScores.biophysical + alpha * scores.biophysical;
    
    this.detectorScores.periodicity = 
      (1 - alpha) * this.detectorScores.periodicity + alpha * scores.periodicity;
  }

  private analyzeSignalMultiDetector(
    filtered: number, 
    trendResult: 'highly_stable' | 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' | 'non_physiological'
  ): { isFingerDetected: boolean; quality: number; detectorDetails: Record<string, number> } {
    const currentTime = Date.now();
    
    // Aplicar ponderación a los detectores (total: 100)
    const detectorWeights = {
      redChannel: 20,    // 20% al valor de rojo
      stability: 20,     // 20% a estabilidad
      pulsatility: 25,   // 25% a pulsatilidad
      biophysical: 15,   // 15% a validación biofísica
      periodicity: 20    // 20% a periodicidad fisiológica
    };
    
    // Calcular puntuación ponderada
    let weightedScore = 0;
    
    for (const [detector, weight] of Object.entries(detectorWeights)) {
      weightedScore += (this.detectorScores[detector] || 0) * weight;
    }
    
    // Normalizar a 100
    const normalizedScore = weightedScore / 100;
    
    // Reglas de detección con histéresis
    let detectionChanged = false;
    
    if (normalizedScore > 0.68) {
      // Puntuación alta -> incrementar detecciones consecutivas
      this.consecutiveDetections++;
      this.consecutiveNoDetections = Math.max(0, this.consecutiveNoDetections - 1);
      
      if (this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS && !this.isCurrentlyDetected) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        detectionChanged = true;
      }
    } else if (normalizedScore < 0.45 || trendResult === 'non_physiological') {
      // Puntuación baja o señal no fisiológica -> decrementar detecciones
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.consecutiveNoDetections++;
      
      if (this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS && this.isCurrentlyDetected) {
        this.isCurrentlyDetected = false;
        detectionChanged = true;
      }
    }
    
    // Timeout de seguridad para señal perdida
    if (this.isCurrentlyDetected && currentTime - this.lastDetectionTime > 1000) {
      console.log("PPGSignalProcessor: Timeout de detección activado");
      this.isCurrentlyDetected = false;
      detectionChanged = true;
    }
    
    // Calcular calidad en escala 0-100 con niveles más granulares
    let qualityValue: number;
    
    if (!this.isCurrentlyDetected) {
      qualityValue = 0;
    } else {
      // Sistema de 20 niveles de calidad (multiplica por 5 para obtener 0-100)
      const baseQuality = normalizedScore * 20;
      
      // Ajustes basados en reglas
      let adjustments = 0;
      
      // Penalizar inestabilidad
      if (trendResult === 'unstable') adjustments -= 1;
      if (trendResult === 'highly_unstable') adjustments -= 3;
      
      // Premiar estabilidad
      if (trendResult === 'stable') adjustments += 1;
      if (trendResult === 'highly_stable') adjustments += 2;
      
      // Aplicar ajustes y limitar a rango 0-20
      const adjustedQuality = Math.max(0, Math.min(20, baseQuality + adjustments));
      
      // Convertir a escala 0-100
      qualityValue = Math.round(adjustedQuality * 5);
    }
    
    // Añadir a historial de calidad
    this.qualityHistory.push(qualityValue);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Calcular calidad promedio para estabilidad
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / 
                      Math.max(1, this.qualityHistory.length);
    
    // Si la calidad es baja pero no cero, aplicar un mínimo
    const finalQuality = avgQuality > 0 && avgQuality < 15 ? Math.max(15, avgQuality) : avgQuality;
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: Math.round(finalQuality), // Explicitly convert to number with Math.round()
      detectorDetails: {
        ...this.detectorScores,
        normalizedScore,
        trendType: trendResult
      }
    };
  }

  private detectROI(redValue: number, imageData: ImageData): ProcessedSignal['roi'] {
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

  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    this.onError?.(error);
  }
}
