
import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { KalmanFilter } from './KalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { SignalTrendAnalyzer } from './SignalTrendAnalyzer';
import { BiophysicalValidator } from './BiophysicalValidator';
import { FrameProcessor } from './FrameProcessor';
import { CalibrationHandler } from './CalibrationHandler';
import { SignalAnalyzer } from './SignalAnalyzer';
import { SignalProcessorConfig } from './types';

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
  private frameProcessor: FrameProcessor;
  private calibrationHandler: CalibrationHandler;
  private signalAnalyzer: SignalAnalyzer;
  private lastValues: number[] = [];
  private isCalibrating: boolean = false;
  private frameProcessedCount = 0;
  
  // Configuración basada en nuestro plan - ajustada para mejorar detección
  private readonly CONFIG: SignalProcessorConfig = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 30,   // Reducido de 40 a 30 para ser más sensible
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 3,  // Reducido de 4 a 3
    HYSTERESIS: 3,
    MIN_CONSECUTIVE_DETECTIONS: 2,  // Reducido de 3 a 2 para detección más rápida
    MAX_CONSECUTIVE_NO_DETECTIONS: 3,  // Aumentado de 2 a 3 para mantener la detección
    QUALITY_LEVELS: 20,
    QUALITY_HISTORY_SIZE: 10,
    CALIBRATION_SAMPLES: 30,
    TEXTURE_GRID_SIZE: 8,
    ROI_SIZE_FACTOR: 0.25
  };
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.trendAnalyzer = new SignalTrendAnalyzer();
    this.biophysicalValidator = new BiophysicalValidator();
    this.frameProcessor = new FrameProcessor({
      TEXTURE_GRID_SIZE: this.CONFIG.TEXTURE_GRID_SIZE,
      ROI_SIZE_FACTOR: this.CONFIG.ROI_SIZE_FACTOR
    });
    this.calibrationHandler = new CalibrationHandler({
      CALIBRATION_SAMPLES: this.CONFIG.CALIBRATION_SAMPLES,
      MIN_RED_THRESHOLD: this.CONFIG.MIN_RED_THRESHOLD,
      MAX_RED_THRESHOLD: this.CONFIG.MAX_RED_THRESHOLD
    });
    this.signalAnalyzer = new SignalAnalyzer({
      QUALITY_LEVELS: this.CONFIG.QUALITY_LEVELS,
      QUALITY_HISTORY_SIZE: this.CONFIG.QUALITY_HISTORY_SIZE,
      MIN_CONSECUTIVE_DETECTIONS: this.CONFIG.MIN_CONSECUTIVE_DETECTIONS,
      MAX_CONSECUTIVE_NO_DETECTIONS: this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS
    });
    
    console.log("PPGSignalProcessor: Instancia avanzada creada con nueva configuración", this.CONFIG);
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.kalmanFilter.reset();
      this.sgFilter.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      this.signalAnalyzer.reset();
      this.frameProcessedCount = 0;
      
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
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    this.signalAnalyzer.reset();
    console.log("PPGSignalProcessor: Sistema avanzado detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración adaptativa");
      await this.initialize();
      
      // Marcar modo de calibración
      this.isCalibrating = true;
      
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
      // Contador de frames procesados
      this.frameProcessedCount++;
      const shouldLog = this.frameProcessedCount % 30 === 0;  // Log cada 30 frames
      
      // 1. Extraer características del frame
      const extractionResult = this.frameProcessor.extractFrameData(imageData);
      const { redValue, textureScore, rToGRatio, rToBRatio } = extractionResult;
      const roi = this.frameProcessor.detectROI(redValue, imageData);
      
      if (shouldLog) {
        console.log("PPGSignalProcessor: Frame datos extraídos:", { 
          redValue, 
          textureScore, 
          rToGRatio, 
          rToBRatio,
          frameSize: `${imageData.width}x${imageData.height}`,
          frameCount: this.frameProcessedCount
        });
      }
      
      // 2. Manejo de calibración si está activa
      if (this.isCalibrating) {
        const isCalibrationComplete = this.calibrationHandler.handleCalibration(redValue);
        
        // Si la calibración se completó, salir del modo de calibración
        if (isCalibrationComplete) {
          this.isCalibrating = false;
          console.log("PPGSignalProcessor: Calibración completada");
        }
        
        // Si estamos calibrando, generamos una señal provisional
        if (this.onSignalReady) {
          const provSignal: ProcessedSignal = {
            timestamp: Date.now(),
            rawValue: redValue,
            filteredValue: this.kalmanFilter.filter(redValue),
            quality: 40, // Calidad fija durante calibración
            fingerDetected: redValue > 5, // Más permisivo durante calibración (antes era 10)
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
        Math.abs(sgFiltered - this.signalAnalyzer.getLastStableValue()) / Math.max(1, redValue) : 0;
      
      // 6. Validación biofísica
      const biophysicalResult = this.biophysicalValidator.addSample({
        r: extractionResult.avgRed || 0,
        g: extractionResult.avgGreen || 0,
        b: extractionResult.avgBlue || 0,
        perfusionIdx: perfusionIndex,
        textureScore: textureScore
      });
      
      // 7. Actualizar puntuaciones de detectores
      const calibrationValues = this.calibrationHandler.getCalibrationValues();
      
      // Aplicamos una lógica más permisiva para el detector de canal rojo
      let redChannelScore = 0;
      if (redValue > calibrationValues.minRedThreshold) {
        // Función más sensible para la puntuación de rojo
        redChannelScore = Math.min(1, (redValue - calibrationValues.minRedThreshold) / 
                           (calibrationValues.maxRedThreshold - calibrationValues.minRedThreshold));
      } else if (redValue > calibrationValues.minRedThreshold * 0.7) {
        // Puntuar valores cercanos al umbral para mejorar detección
        redChannelScore = 0.5 * (redValue / calibrationValues.minRedThreshold);
      }
      
      this.signalAnalyzer.updateDetectorScores({
        redValue,
        redChannel: redChannelScore,
        stability: trendScores.stability,
        pulsatility: perfusionIndex > 0.05 && perfusionIndex < 2 ? // Reducido de 0.08 a 0.05
                    Math.min(1, perfusionIndex * 2.5) : 0,  // Aumentado de 2 a 2.5
        biophysical: biophysicalResult.confidence,
        periodicity: trendScores.periodicity
      });
      
      // 8. Análisis avanzado con múltiples detectores
      const { isFingerDetected, quality, detectorDetails } = 
        this.signalAnalyzer.analyzeSignalMultiDetector(sgFiltered, trendResult);
      
      // 9. Crear objeto de señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: sgFiltered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
      };
      
      // Log periódico para diagnóstico
      if (shouldLog) {
        console.log("PPGSignalProcessor: Estado de detección de dedo:", {
          fingerDetected: isFingerDetected,
          quality,
          redValue,
          filteredValue: sgFiltered,
          perfusionIndex,
          trendResult,
          calibrationMin: calibrationValues.minRedThreshold,
          calibrationMax: calibrationValues.maxRedThreshold
        });
      }
      
      // 10. Almacenar último valor estable y enviar señal
      if (isFingerDetected) {
        this.signalAnalyzer.updateLastStableValue(sgFiltered);
      }
      
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error en el procesamiento avanzado de frame");
    }
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
