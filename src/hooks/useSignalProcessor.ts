import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { generateSessionId } from '../utils/deterministicId';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';
import { CallbackDiagnostics } from '../utils/CallbackDiagnostics';
import { FrameProcessingMonitor } from '../utils/FrameProcessingMonitor';
import { SignalQualityValidator } from '../utils/SignalQualityValidator';

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

  // Create processor with well-defined callbacks
  useEffect(() => {
    const sessionId = generateSessionId();
    
    logger.info('useSignalProcessor', 'Creating new processor instance', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Definir el callback onSignalReady con manejo de errores
    const onSignalReady = (signal: ProcessedSignal) => {
      try {
        // Validar la señal entrante
        if (!signal || typeof signal !== 'object') {
          throw new Error('Señal inválida recibida');
        }

        // Registrar ejecución del callback
        frameMonitor.current.recordCallbackExecution();
        
        // Validar calidad de señal
        const validation = signalValidator.current.validateSignal(signal);
        
        // Log detallado solo si hay cambios significativos o errores
        if (!validation.isValid || signal.quality < 50) {
          logger.warn('useSignalProcessor', 'Signal quality issues detected', {
            quality: signal.quality,
            issues: validation.issues,
            suggestions: validation.suggestions
          });
        }
        
        // Actualizar el estado con la nueva señal
        setLastSignal(prevSignal => {
          // Solo actualizar si hay un cambio significativo para evitar re-renderizados innecesarios
          if (!prevSignal || 
              prevSignal.quality !== signal.quality ||
              prevSignal.fingerDetected !== signal.fingerDetected) {
            return signal;
          }
          return prevSignal;
        });
        
        // Limpiar errores previos si la señal es válida
        if (validation.isValid) {
          setError(null);
        }
        
        // Actualizar contador de frames procesados
        setFramesProcessed(prev => prev + 1);
        
        // Almacenar en el historial para análisis
        signalHistoryRef.current = [
          ...signalHistoryRef.current.slice(-99), // Mantener solo los últimos 100
          signal
        ];
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido en onSignalReady';
        logger.error('useSignalProcessor', 'Error en onSignalReady', {
          error: errorMessage,
          signal: signal
        });
      }
    };
    
    // Envolver el callback con el diagnóstico
    const wrappedOnSignalReady = callbackDiagnostics.current.wrapCallback(
      'onSignalReady',
      onSignalReady
    );
    
    // Definir el manejador de errores
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

      // Crear el procesador con los callbacks asegurados
    try {
      processorRef.current = new PPGSignalProcessor(
        wrappedOnSignalReady, 
        onError
      );
      
      // Verificación de callbacks
      if (!processorRef.current.onSignalReady || !processorRef.current.onError) {
        throw new Error('Fallo al establecer los callbacks del procesador');
      }
      
      logger.info('useSignalProcessor', 'Processor created with callbacks', {
        hasOnSignalReadyCallback: !!processorRef.current.onSignalReady,
        hasOnErrorCallback: !!processorRef.current.onError,
        sessionId
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al crear el procesador';
      logger.error('useSignalProcessor', 'Error creating processor', {
        error: errorMessage,
        sessionId
      });
      
      // Establecer un estado de error claro
      setError({
        message: 'Error al inicializar el procesador de señales',
        code: 'PROCESSOR_INIT_ERROR',
        timestamp: Date.now(),
        details: errorMessage
      });
      
      // Detener cualquier procesamiento
      setIsProcessing(false);
    }
    
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
      const errorMsg = "No hay procesador disponible para iniciar";
      logger.error('useSignalProcessor', errorMsg);
      setError({
        message: errorMsg,
        code: 'NO_PROCESSOR',
        timestamp: Date.now()
      });
      return;
    }

    // Validar que los callbacks estén configurados
    if (!processorRef.current.onSignalReady || !processorRef.current.onError) {
      const errorMsg = "Callbacks del procesador no configurados correctamente";
      logger.error('useSignalProcessor', errorMsg, {
        hasOnSignalReady: !!processorRef.current.onSignalReady,
        hasOnError: !!processorRef.current.onError
      });
      
      setError({
        message: errorMsg,
        code: 'INVALID_CALLBACKS',
        timestamp: Date.now()
      });
      return;
    }

    logger.info('useSignalProcessor', 'Iniciando procesamiento', {
      timestamp: new Date().toISOString(),
      sessionId: generateSessionId()
    });
    
    // Resetear estados
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0,
      lastQualityUpdateTime: 0
    });
    
    // Limpiar referencias
    signalHistoryRef.current = [];
    qualityTransitionsRef.current = [];
    errorCountRef.current = 0;
    lastErrorTimeRef.current = 0;
    
    // Iniciar el procesador
    try {
      processorRef.current.start();
      logger.info('useSignalProcessor', 'Procesamiento iniciado correctamente');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido al iniciar el procesamiento';
      logger.error('useSignalProcessor', 'Error al iniciar el procesamiento', {
        error: errorMsg,
        stack: err instanceof Error ? err.stack : undefined
      });
      
      setError({
        message: 'Error al iniciar el procesamiento',
        details: errorMsg,
        code: 'START_ERROR',
        timestamp: Date.now()
      });
      
      setIsProcessing(false);
    }
    
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

  // Función optimizada para procesar frames
  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current) {
      logger.error("useSignalProcessor", "No processor available to process frames");
      return;
    }
    
    // Verificar rápidamente si debemos procesar este frame
    if (!isProcessing) {
      return;
    }
    
    // Usar requestAnimationFrame para optimizar el procesamiento
    requestAnimationFrame(() => {
      // Iniciar monitoreo de frame
      const frameStartTime = frameMonitor.current.startFrameProcessing();
      
      try {
        // Validar que los callbacks estén configurados
        const callbackValidation = callbackDiagnostics.current.validateCallbackChain({
          onSignalReady: processorRef.current?.onSignalReady,
          onError: processorRef.current?.onError
        });
        
        if (!callbackValidation.isValid) {
          // Solo registrar el error una vez cada 60 frames para evitar saturación
          if (framesProcessed % 60 === 0) {
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

  // Memoizar el valor de retorno para evitar recreaciones innecesarias
  const api = React.useMemo(() => ({
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
    calibrate
  }), [
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
    calibrate
  ]);

  return api;
    callbackDiagnostics: callbackDiagnostics.current,
    signalValidator: signalValidator.current
  };
};
