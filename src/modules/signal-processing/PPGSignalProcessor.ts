import { ProcessedSignal, ProcessingError, SignalProcessor as SignalProcessorInterface } from '../../types/signal';
import { KalmanFilter } from './KalmanFilter';
import { SavitzkyGolayFilter } from './SavitzkyGolayFilter';
import { SignalTrendAnalyzer, TrendResult } from './SignalTrendAnalyzer';
import { BiophysicalValidator } from './BiophysicalValidator';
import { FrameProcessor } from './FrameProcessor';
import { CalibrationHandler } from './CalibrationHandler';
import { SignalAnalyzer } from './SignalAnalyzer';
import { SignalProcessorConfig } from './types';

/**
 * Procesador de señal PPG con detección de dedo
 * e indicador de calidad
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
 */
export class PPGSignalProcessor implements SignalProcessorInterface {
  public isProcessing: boolean = false;
  public kalmanFilter: KalmanFilter;
  public sgFilter: SavitzkyGolayFilter;
  public trendAnalyzer: SignalTrendAnalyzer;
  public biophysicalValidator: BiophysicalValidator;
  public frameProcessor: FrameProcessor;
  public calibrationHandler: CalibrationHandler;
  public signalAnalyzer: SignalAnalyzer;
  public lastValues: number[] = [];
  public isCalibrating: boolean = false;
  public frameProcessedCount = 0;
  
  // Configuration with stricter medically appropriate thresholds
  public readonly CONFIG: SignalProcessorConfig = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 0,     // Umbral mínimo de rojo a 0 para aceptar señales débiles
    MAX_RED_THRESHOLD: 240,
    STABILITY_WINDOW: 10,      // Increased for more stability assessment
    MIN_STABILITY_COUNT: 5,   // Requires more stability for detection
    HYSTERESIS: 2.5,          // Increased hysteresis for stable detection
    MIN_CONSECUTIVE_DETECTIONS: 6,  // Requires more frames to confirm detection
    MAX_CONSECUTIVE_NO_DETECTIONS: 4,  // Quicker to lose detection when finger is removed
    QUALITY_LEVELS: 20,
    QUALITY_HISTORY_SIZE: 10,
    CALIBRATION_SAMPLES: 10,
    TEXTURE_GRID_SIZE: 8,
    ROI_SIZE_FACTOR: 0.6
  };
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("[DIAG] PPGSignalProcessor: Constructor", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError,
      stack: new Error().stack
    });
    
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
    
    console.log("PPGSignalProcessor: Instance created with medically appropriate configuration:", this.CONFIG);
  }

  async initialize(): Promise<void> {
    console.log("[DIAG] PPGSignalProcessor: initialize() called", {
      hasSignalReadyCallback: !!this.onSignalReady,
      hasErrorCallback: !!this.onError,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Reset all filters and analyzers
      this.lastValues = [];
      this.kalmanFilter.reset();
      this.sgFilter.reset();
      this.trendAnalyzer.reset();
      this.biophysicalValidator.reset();
      this.signalAnalyzer.reset();
      this.frameProcessedCount = 0;
      
      // Ensure callbacks are properly set
      if (!this.onSignalReady) {
        console.warn("PPGSignalProcessor: No onSignalReady callback provided, using fallback");
        this.onSignalReady = (signal) => {
          console.log("Fallback onSignalReady:", signal);
        };
      }
      
      if (!this.onError) {
        console.warn("PPGSignalProcessor: No onError callback provided, using fallback");
        this.onError = (error) => {
          console.error("PPG Error:", error);
        };
      }
      
      console.log("PPGSignalProcessor: System initialized with callbacks:", {
        hasSignalReadyCallback: !!this.onSignalReady,
        hasErrorCallback: !!this.onError,
        timestamp: new Date().toISOString()
      });
      
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error("PPGSignalProcessor: Initialization error", error);
      this.handleError("INIT_ERROR", `Error initializing advanced processor: ${errorMessage}`);
      return Promise.reject(error);
    }
  }

  start(): void {
    console.log("[DIAG] PPGSignalProcessor: start() called", { isProcessing: this.isProcessing });
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Advanced system started");
  }

  stop(): void {
    console.log("[DIAG] PPGSignalProcessor: stop() called", { isProcessing: this.isProcessing });
    this.isProcessing = false;
    this.lastValues = [];
    this.kalmanFilter.reset();
    this.sgFilter.reset();
    this.trendAnalyzer.reset();
    this.biophysicalValidator.reset();
    this.signalAnalyzer.reset();
    console.log("PPGSignalProcessor: Advanced system stopped");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Starting adaptive calibration");
      await this.initialize();
      
      // Mark calibration mode
      this.isCalibrating = true;
      
      // After a period of calibration, automatically finish
      setTimeout(() => {
        this.isCalibrating = false;
        console.log("PPGSignalProcessor: Adaptive calibration completed automatically");
      }, 3000);
      
      console.log("PPGSignalProcessor: Adaptive calibration initiated");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Calibration error", error);
      this.handleError("CALIBRATION_ERROR", "Error during adaptive calibration");
      this.isCalibrating = false;
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    // Validación temprana de parámetros
    if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
      console.error("PPGSignalProcessor: Invalid image data received");
      return;
    }
    
    const frameStartTime = performance.now();
    const frameNumber = this.frameProcessedCount + 1;
    const shouldLog = frameNumber % 30 === 0; // Log cada 30 frames
    
    if (shouldLog) {
      console.log("[DIAG] PPGSignalProcessor: Processing frame", {
        frameNumber,
        imageSize: `${imageData.width}x${imageData.height}`,
        timestamp: new Date().toISOString(),
        isProcessing: this.isProcessing,
        hasOnSignalReady: !!this.onSignalReady,
        memory: (performance as any).memory ? {
          usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB',
          totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + 'MB'
        } : 'Not available'
      });
    }
    
    if (!this.isProcessing) {
      if (shouldLog) {
        console.log("PPGSignalProcessor: Not processing, ignoring frame");
      }
      return;
    }

    try {
      // Incrementar contador de frames
      this.frameProcessedCount++;
      
      // Verificar y asegurar callbacks
      if (!this.onSignalReady) {
        console.error("PPGSignalProcessor: onSignalReady callback is missing in processFrame");
        this.onSignalReady = this.createFallbackCallback();
        this.handleError("CALLBACK_ERROR", "Fallback callback created in processFrame");
      }

      // 1. Extraer características del frame con validación mejorada
      let extractionResult;
      try {
        extractionResult = this.frameProcessor.extractFrameData(imageData);
      } catch (error) {
        console.error("Error extracting frame data:", error);
        this.handleError("FRAME_EXTRACTION_ERROR", `Error extracting frame data: ${error.message}`);
        return;
      }
      
      const { redValue, textureScore, rToGRatio, rToBRatio } = extractionResult;
      
      // Validar valores extraídos
      if (isNaN(redValue) || !isFinite(redValue)) {
        console.error("Invalid redValue:", redValue);
        this.handleError("INVALID_SIGNAL", "Invalid signal value detected");
        return;
      }
      
      // Detección de ROI con manejo de errores
      let roi;
      try {
        roi = this.frameProcessor.detectROI(redValue, imageData);
      } catch (error) {
        console.error("Error detecting ROI:", error);
        roi = { x: 0, y: 0, width: imageData.width, height: imageData.height };
      }

      // DEBUGGING: Log extracted redValue and ROI
      if (shouldLog) {
        console.log("PPGSignalProcessor DEBUG:", {
          step: "FrameExtraction",
          redValue: redValue,
          roiX: roi.x,
          roiY: roi.y,
          roiWidth: roi.width,
          roiHeight: roi.height,
          textureScore,
          rToGRatio,
          rToBRatio
        });
      }

      // Early rejection of invalid frames - stricter thresholds
      if (redValue < this.CONFIG.MIN_RED_THRESHOLD * 0.9) {
        if (shouldLog) {
          console.log("PPGSignalProcessor: Signal too weak, skipping processing:", redValue);
        }

        const minimalSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: redValue,
          quality: 0,
          fingerDetected: false,
          roi: roi,
          perfusionIndex: 0
        };

        this.onSignalReady(minimalSignal);
        if (shouldLog) {
          console.log("PPGSignalProcessor DEBUG: Sent onSignalReady (Early Reject - Weak Signal):", minimalSignal);
        }
        return;
      }

      // 2. Aplicar filtrado en cascada a la señal
      let filteredValue;
      try {
        // Filtro Kalman para reducir ruido
        filteredValue = this.kalmanFilter.filter(redValue);
        
        // Filtro Savitzky-Golay para suavizado preservando características
        filteredValue = this.sgFilter.filter(filteredValue);
        
        // Validar resultado del filtrado
        if (isNaN(filteredValue) || !isFinite(filteredValue)) {
          console.error("Invalid filtered value:", filteredValue, "from redValue:", redValue);
          filteredValue = redValue; // Usar valor sin filtrar como respaldo
        }
      } catch (error) {
        console.error("Error filtering signal:", error);
        filteredValue = redValue; // Usar valor sin filtrar en caso de error
        this.handleError("FILTER_ERROR", `Error filtering signal: ${error.message}`);
      }

      // 3. Análisis de tendencia de la señal con validación fisiológica
      let trendResult;
      let detectionResult;
      let isFingerDetected = false;
      let signalQuality = 0;
      
      try {
        // Análisis de tendencia
        trendResult = this.trendAnalyzer.analyzeTrend(filteredValue);
        
        // Validar rango fisiológico
        const biophysicalValidation = this.biophysicalValidator.validateBiophysicalRange(
          redValue, 
          rToGRatio, 
          rToBRatio
        );
        
        // Actualizar puntajes del detector en SignalAnalyzer
        this.signalAnalyzer.updateDetectorScores({
          redValue: redValue,
          redChannel: redValue / 255, // Normalizar a 0-1
          stability: this.trendAnalyzer.getStabilityScore(),
          pulsatility: this.biophysicalValidator.calculatePulsatilityIndex(filteredValue),
          biophysical: biophysicalValidation,
          periodicity: this.trendAnalyzer.getPeriodicityScore(),
          textureScore: textureScore
        });
        
        // Obtener resultados de detección
        detectionResult = this.signalAnalyzer.analyzeSignalMultiDetector(filteredValue, trendResult);
        isFingerDetected = detectionResult.isFingerDetected;
        signalQuality = detectionResult.quality; // Calidad general de 0-100
        
        // Validar calidad de la señal
        if (isNaN(signalQuality) || signalQuality < 0 || signalQuality > 100) {
          console.warn("Invalid signal quality:", signalQuality, "- Clamping to valid range");
          signalQuality = Math.max(0, Math.min(100, signalQuality || 0));
        }
      } catch (error) {
        console.error("Error in signal analysis:", error);
        this.handleError("ANALYSIS_ERROR", `Error analyzing signal: ${error.message}`);
        // Valores por defecto seguros
        isFingerDetected = false;
        signalQuality = 0;
      }

      if (trendResult === "non_physiological" && !this.isCalibrating) {
        if (shouldLog) {
          console.log("PPGSignalProcessor: Non-physiological signal rejected");
        }

        const rejectSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: filteredValue,
          quality: 0, 
          fingerDetected: false,
          roi: roi,
          perfusionIndex: 0
        };

        this.onSignalReady(rejectSignal);
        if (shouldLog) {
          console.log("PPGSignalProcessor DEBUG: Sent onSignalReady (Reject - Non-Physiological Trend):", rejectSignal);
        }
        return;
      }

      // Additional validation for color channel ratios
      if ((rToGRatio < 0.9 || rToGRatio > 4.0) && !this.isCalibrating) {
        if (shouldLog) {
          console.log("PPGSignalProcessor: Non-physiological color ratio detected:", {
            rToGRatio,
            rToBRatio
          });
        }

        const rejectSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: filteredValue,
          quality: 0, 
          fingerDetected: false,
          roi: roi,
          perfusionIndex: 0
        };

        this.onSignalReady(rejectSignal);
        if (shouldLog) {
          console.log("PPGSignalProcessor DEBUG: Sent onSignalReady (Reject - Non-Physiological Color Ratio):", rejectSignal);
        }
        return;
      }

      // 4. Preparar señal procesada con validación
      let processedSignal: ProcessedSignal;
      try {
        // Calcular el índice de perfusión (PI) con manejo de errores
        const perfusionIndex = this.biophysicalValidator.calculatePulsatilityIndex(filteredValue);
        
        // Crear objeto de señal procesada
        processedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: filteredValue,
          quality: signalQuality,
          fingerDetected: isFingerDetected,
          roi: roi,
          perfusionIndex: perfusionIndex
        };
        
        // Validar señal antes de enviar
        if (this.validateProcessedSignal(processedSignal)) {
          // Registrar métricas de rendimiento
          const processTime = performance.now() - frameStartTime;
          if (shouldLog) {
            console.log("PPGSignalProcessor: Frame processed successfully", {
              processTime: `${processTime.toFixed(2)}ms`,
              fps: frameNumber > 1 ? `${(1000/processTime).toFixed(1)} fps` : 'N/A',
              signal: {
                quality: processedSignal.quality,
                fingerDetected: processedSignal.fingerDetected,
                perfusionIndex: processedSignal.perfusionIndex.toFixed(2),
                rawValue: Math.round(processedSignal.rawValue),
                filteredValue: processedSignal.filteredValue.toFixed(2)
              },
              roi: {
                x: roi.x, y: roi.y,
                width: roi.width, height: roi.height
              }
            });
          }
          
          // Enviar señal procesada
          this.onSignalReady(processedSignal);
        } else {
          console.warn("PPGSignalProcessor: Invalid signal detected, not sending");
          this.handleError("INVALID_SIGNAL", "Signal validation failed");
        }
      } catch (error) {
        console.error("Error creating processed signal:", error);
        this.handleError("SIGNAL_CREATION_ERROR", `Error creating processed signal: ${error.message}`);
      }
    } catch (error) {
      console.error("PPGSignalProcessor: Error processing frame", error);
      this.handleError("FRAME_PROCESSING_ERROR", `Error processing frame: ${error.message}`);
    }
  }

  /**
   * Valida una señal procesada antes de enviarla
   */
  private validateProcessedSignal(signal: ProcessedSignal): boolean {
    // Validar valores numéricos
    if (isNaN(signal.quality) || signal.quality < 0 || signal.quality > 100) {
      console.error("Invalid signal quality:", signal.quality);
      return false;
    }
    
    if (isNaN(signal.rawValue) || signal.rawValue < 0 || signal.rawValue > 255) {
      console.error("Invalid raw value:", signal.rawValue);
      return false;
    }
    
    if (isNaN(signal.filteredValue) || !isFinite(signal.filteredValue)) {
      console.error("Invalid filtered value:", signal.filteredValue);
      return false;
    }
    
    if (isNaN(signal.perfusionIndex) || signal.perfusionIndex < 0 || signal.perfusionIndex > 100) {
      console.error("Invalid perfusion index:", signal.perfusionIndex);
      return false;
    }
    
    // Validar ROI
    if (!signal.roi || 
        isNaN(signal.roi.x) || isNaN(signal.roi.y) || 
        isNaN(signal.roi.width) || isNaN(signal.roi.height) ||
        signal.roi.width <= 0 || signal.roi.height <= 0) {
      console.error("Invalid ROI:", signal.roi);
      return false;
    }
    
    return true;
  }
  
  /**
   * Crea un callback de respaldo para onSignalReady
   */
  private createFallbackCallback(): (signal: ProcessedSignal) => void {
    console.warn("PPGSignalProcessor: Creating fallback onSignalReady callback");
    return (signal: ProcessedSignal) => {
      console.log("Fallback onSignalReady:", {
        timestamp: new Date(signal.timestamp).toISOString(),
        quality: signal.quality,
        fingerDetected: signal.fingerDetected,
        rawValue: signal.rawValue,
        filteredValue: signal.filteredValue
      });
    };
  }
  
  /**
   * Maneja errores de manera consistente
   */
  private handleError(code: string, message: string, details?: any): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now(),
      details: details || {}
    };
    
    console.error(`PPGSignalProcessor [${code}]: ${message}`, details);
    
    // Enviar error a través del callback si está disponible
    if (typeof this.onError === 'function') {
      try {
        this.onError(error);
      } catch (callbackError) {
        console.error("Error in error callback:", callbackError);
      }
    } else {
      console.error("PPGSignalProcessor: onError callback not available, error not reported:", error);
    }
  }
}


