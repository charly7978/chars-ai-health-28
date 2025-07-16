import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { generateSessionId } from '../utils/deterministicId';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';
import { CallbackDiagnostics } from '../utils/CallbackDiagnostics';
import { FrameProcessingMonitor } from '../utils/FrameProcessingMonitor';
import { SignalQualityValidator } from '../utils/SignalQualityValidator';
import { CallbackChainValidator } from '../utils/CallbackChainValidator';

/**
 * Custom hook for managing PPG signal processing
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
 */
export const useSignalProcessor = () => {
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0,
    lastQualityUpdateTime: 0
  });
  const signalHistoryRef = useRef<ProcessedSignal[]>([]);
  const qualityTransitionsRef = useRef<{time: number, from: number, to: number}[]>([]);
  const calibrationInProgressRef = useRef(false);
  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);

  // Sistema de diagnóstico integrado
  const logger = DiagnosticLogger.getInstance();
  const callbackDiagnostics = useRef(new CallbackDiagnostics());
  const frameMonitor = useRef(new FrameProcessingMonitor());
  const signalValidator = useRef(new SignalQualityValidator());
  const callbackValidator = useRef(new CallbackChainValidator());

  // Create processor with well-defined callbacks
  useEffect(() => {
    const sessionId = generateSessionId();
    
    logger.info('useSignalProcessor', 'Creating new processor instance', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Define enhanced signal ready callback with full diagnostics
    const onSignalReady = callbackDiagnostics.current.wrapCallback(
      'onSignalReady',
      (signal: ProcessedSignal) => {
        // Registrar ejecución del callback
        frameMonitor.current.recordCallbackExecution();
        
        // Validar calidad de señal
        const validation = signalValidator.current.validateSignal(signal);
        
        logger.signalFlow('SignalReceived', true, {
          fingerDetected: signal.fingerDetected,
          quality: signal.quality,
          rawValue: signal.rawValue,
          filteredValue: signal.filteredValue,
          validation: validation
        });
        
        // Log detallado para diagnóstico
        logger.debug('useSignalProcessor', 'Signal received and validated', {
          signal: {
            timestamp: new Date(signal.timestamp).toISOString(),
            fingerDetected: signal.fingerDetected,
            quality: signal.quality,
            rawValue: signal.rawValue,
            filteredValue: signal.filteredValue,
            perfusionIndex: signal.perfusionIndex
          },
          validation: {
            isValid: validation.isValid,
            quality: validation.quality,
            issueCount: validation.issues.length
          }
        });
        
        // Advertir sobre problemas de calidad
        if (!validation.isValid) {
          logger.warn('useSignalProcessor', 'Signal quality issues detected', {
            issues: validation.issues,
            suggestions: validation.suggestions
          });
        }
        
        // Use signal with medical validation - no forcing detection
        setLastSignal(signal);
        setError(null);
        setFramesProcessed(prev => prev + 1);
        
        // Store for history tracking
        signalHistoryRef.current.push(signal);
        if (signalHistoryRef.current.length > 100) { // Keep last 100 signals
          signalHistoryRef.current.shift();
        }
        
        // Track quality transitions for analysis
        const prevSignal = signalHistoryRef.current[signalHistoryRef.current.length - 2];
        if (prevSignal && Math.abs(prevSignal.quality - signal.quality) > 15) {
          qualityTransitionsRef.current.push({
            time: signal.timestamp,
            from: prevSignal.quality,
            to: signal.quality
          });
          
          logger.info('useSignalProcessor', 'Quality transition detected', {
            from: prevSignal.quality,
            to: signal.quality,
            change: signal.quality - prevSignal.quality
          });
          
          // Keep limited history
          if (qualityTransitionsRef.current.length > 20) {
            qualityTransitionsRef.current.shift();
          }
        }
        
        // Update statistics with valid signals only
        if (signal.fingerDetected && signal.quality > 30) {
          setSignalStats(prev => {
            const newStats = {
              minValue: Math.min(prev.minValue, signal.filteredValue),
              maxValue: Math.max(prev.maxValue, signal.filteredValue),
              avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
              totalValues: prev.totalValues + 1,
              lastQualityUpdateTime: signal.timestamp
            };
            
            return newStats;
          });
        }
      }
    );

    // Enhanced error handling with rate limiting
    const onError = (error: ProcessingError) => {
      const currentTime = Date.now();
      
      // Avoid error flooding - limit to one error every 2 seconds
      if (currentTime - lastErrorTimeRef.current < 2000) {
        errorCountRef.current++;
        
        // Only log without toast if errors are coming too quickly
        console.error("useSignalProcessor: Error suppressed to avoid flooding:", {
          ...error,
          formattedTime: new Date(error.timestamp).toISOString(),
          errorCount: errorCountRef.current
        });
        
        return;
      }
      
      // Reset error count and update last error time
      errorCountRef.current = 1;
      lastErrorTimeRef.current = currentTime;
      
      console.error("useSignalProcessor: Detailed error:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      
      setError(error);
    };

    // Create processor with proper callbacks
    processorRef.current = new PPGSignalProcessor(onSignalReady, onError);
    
    // CRITICAL FIX: Ensure callbacks are always defined with fallbacks
    const ensureCallbacks = () => {
      if (!processorRef.current) return;
      
      // Verificar y crear callback de respaldo para onSignalReady
      if (!processorRef.current.onSignalReady) {
        logger.error('useSignalProcessor', 'onSignalReady callback missing, creating fallback');
        processorRef.current.onSignalReady = (signal: ProcessedSignal) => {
          logger.warn('useSignalProcessor', 'Using fallback onSignalReady callback', signal);
          setLastSignal(signal);
          setError(null);
          setFramesProcessed(prev => prev + 1);
        };
      }
      
      // Verificar y crear callback de respaldo para onError
      if (!processorRef.current.onError) {
        logger.error('useSignalProcessor', 'onError callback missing, creating fallback');
        processorRef.current.onError = (error: ProcessingError) => {
          logger.error('useSignalProcessor', 'Using fallback onError callback', error);
          setError(error);
        };
      }
      
      // Forzar re-asignación de callbacks para asegurar que estén correctamente vinculados
      const originalOnSignalReady = processorRef.current.onSignalReady;
      const originalOnError = processorRef.current.onError;
      
      processorRef.current.onSignalReady = originalOnSignalReady;
      processorRef.current.onError = originalOnError;
      
      logger.info('useSignalProcessor', 'Callbacks verified and ensured', {
        hasOnSignalReady: !!processorRef.current.onSignalReady,
        hasOnError: !!processorRef.current.onError
      });
    };
    
    // Ejecutar verificación de callbacks inmediatamente
    ensureCallbacks();
    
    // Verificar callbacks periódicamente durante los primeros 10 segundos
    const callbackCheckInterval = setInterval(() => {
      ensureCallbacks();
    }, 1000);
    
    setTimeout(() => {
      clearInterval(callbackCheckInterval);
      logger.info('useSignalProcessor', 'Callback verification period completed');
    }, 10000);
    
    logger.info("useSignalProcessor", "Processor created with callbacks established", {
      hasOnSignalReadyCallback: !!processorRef.current.onSignalReady,
      hasOnErrorCallback: !!processorRef.current.onError,
      processorType: processorRef.current.constructor.name
    });
    
    return () => {
      if (processorRef.current) {
        console.log("useSignalProcessor: Cleaning up processor");
        processorRef.current.stop();
      }
      signalHistoryRef.current = [];
      qualityTransitionsRef.current = [];
    };
  }, []);

  const startProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available");
      return;
    }

    console.log("useSignalProcessor: Starting processing", {
      previousState: isProcessing,
      timestamp: new Date().toISOString(),
      processorExists: !!processorRef.current,
      hasSignalReadyCallback: !!processorRef.current.onSignalReady
    });
    
    // Reset all stats and history
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0,
      lastQualityUpdateTime: 0
    });
    
    signalHistoryRef.current = [];
    qualityTransitionsRef.current = [];
    errorCountRef.current = 0;
    lastErrorTimeRef.current = 0;
    
    // Start the processor
    processorRef.current.start();
  }, [isProcessing]);

  const stopProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to stop");
      return;
    }

    console.log("useSignalProcessor: Stopping processing", {
      previousState: isProcessing,
      framesProcessed: framesProcessed,
      finalStats: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processorRef.current.stop();
    calibrationInProgressRef.current = false;
  }, [isProcessing, framesProcessed, signalStats]);

  const calibrate = useCallback(async () => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to calibrate");
      return false;
    }

    try {
      console.log("useSignalProcessor: Starting advanced calibration", {
        timestamp: new Date().toISOString()
      });
      
      calibrationInProgressRef.current = true;
      
      await processorRef.current.calibrate();
      
      // Wait a bit for the automatic calibration to complete
      setTimeout(() => {
        calibrationInProgressRef.current = false;
        
        console.log("useSignalProcessor: Advanced calibration completed", {
          timestamp: new Date().toISOString()
        });
      }, 3000);
      
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Detailed calibration error:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      calibrationInProgressRef.current = false;
      
      return false;
    }
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current) {
      logger.error("useSignalProcessor", "No processor available to process frames");
      return;
    }
    
    if (!isProcessing) {
      logger.debug("useSignalProcessor", "Not processing, ignoring frame");
      return;
    }

    // Iniciar monitoreo de frame
    const frameStartTime = frameMonitor.current.startFrameProcessing();
    
    try {
      // Validar que los callbacks estén configurados
      const callbackValidation = callbackDiagnostics.current.validateCallbackChain({
        onSignalReady: processorRef.current.onSignalReady,
        onError: processorRef.current.onError
      });
      
      if (!callbackValidation.isValid) {
        logger.error("useSignalProcessor", "Callback validation failed", {
          missingCallbacks: callbackValidation.missingCallbacks,
          validCallbacks: callbackValidation.validCallbacks
        });
        
        frameMonitor.current.endFrameProcessing(frameStartTime, false);
        return;
      }
      
      // Log detallado cada 30 frames para evitar spam
      if (framesProcessed % 30 === 0) {
        logger.debug("useSignalProcessor", "Processing frame with diagnostics", {
          frameNumber: framesProcessed,
          imageSize: `${imageData.width}x${imageData.height}`,
          processorState: processorRef.current.isProcessing,
          callbacksValid: callbackValidation.isValid
        });
      }
      
      // Procesar frame
      processorRef.current.processFrame(imageData);
      
      // Finalizar monitoreo exitoso
      frameMonitor.current.endFrameProcessing(frameStartTime, true);
      
    } catch (error) {
      logger.error("useSignalProcessor", "Frame processing error", {
        error: error instanceof Error ? error.message : String(error),
        frameNumber: framesProcessed,
        imageSize: `${imageData.width}x${imageData.height}`
      });
      
      // Registrar error en el monitor
      frameMonitor.current.recordError(error);
      frameMonitor.current.endFrameProcessing(frameStartTime, false);
    }
  }, [isProcessing, framesProcessed, logger]);

  // Función para obtener métricas de diagnóstico
  const getDiagnosticMetrics = useCallback(() => {
    const frameMetrics = frameMonitor.current.getMetrics();
    const callbackStats = callbackDiagnostics.current.getExecutionStats();
    const qualityStats = signalValidator.current.getQualityStats();
    const deviceMetrics = frameMonitor.current.getDeviceMetrics();
    
    return {
      ...frameMetrics,
      callbackStats,
      qualityStats,
      deviceMetrics,
      suggestions: frameMonitor.current.getOptimizationSuggestions(),
      isLowPerformance: frameMonitor.current.isPerformanceLow()
    };
  }, []);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    isCalibrating: calibrationInProgressRef.current,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame,
    signalHistory: signalHistoryRef.current,
    qualityTransitions: qualityTransitionsRef.current,
    // Nuevas funciones de diagnóstico
    getDiagnosticMetrics,
    diagnosticLogger: logger,
    frameMonitor: frameMonitor.current,
    callbackDiagnostics: callbackDiagnostics.current,
    signalValidator: signalValidator.current
  };
};
