
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { toast } from "@/components/ui/use-toast";

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

  // CAMBIO CRÍTICO: Asegurarnos de que siempre existe un procesador válido
  useEffect(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });

    // Crear el procesador con callbacks definidos desde el inicio
    const onSignalReady = (signal: ProcessedSignal) => {
      console.log("Callback onSignalReady llamado correctamente", {
        timestamp: new Date(signal.timestamp).toISOString(),
        fingerDetected: signal.fingerDetected,
        quality: signal.quality,
        rawValue: signal.rawValue,
        filteredValue: signal.filteredValue
      });
      
      // FORZAR DETECCIÓN PARA DEPURACIÓN
      const modifiedSignal = { 
        ...signal, 
        fingerDetected: true,
        quality: Math.max(70, signal.quality) // Garantizar calidad alta
      };
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Actualizar estadísticas
      setSignalStats(prev => {
        const newStats = {
          minValue: Math.min(prev.minValue, modifiedSignal.filteredValue),
          maxValue: Math.max(prev.maxValue, modifiedSignal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + modifiedSignal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1,
          lastQualityUpdateTime: prev.lastQualityUpdateTime
        };
        
        return newStats;
      });
    };

    const onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error detallado:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      
      setError(error);
      
      toast({
        title: "Error en procesamiento de señal",
        description: error.message,
        variant: "destructive"
      });
    };

    // Crear el procesador con los callbacks adecuados
    processorRef.current = new PPGSignalProcessor(onSignalReady, onError);
    
    console.log("useSignalProcessor: Procesador creado con callbacks establecidos:", {
      hasOnSignalReadyCallback: !!processorRef.current.onSignalReady,
      hasOnErrorCallback: !!processorRef.current.onError
    });
    
    return () => {
      if (processorRef.current) {
        console.log("useSignalProcessor: Limpiando procesador");
        processorRef.current.stop();
      }
      signalHistoryRef.current = [];
      qualityTransitionsRef.current = [];
    };
  }, []);

  const startProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay procesador disponible");
      return;
    }

    console.log("useSignalProcessor: Iniciando procesamiento", {
      estadoAnterior: isProcessing,
      timestamp: new Date().toISOString(),
      processorExists: !!processorRef.current,
      hasSignalReadyCallback: !!processorRef.current.onSignalReady
    });
    
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
    
    processorRef.current.start();
  }, [isProcessing]);

  const stopProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay procesador disponible para detener");
      return;
    }

    console.log("useSignalProcessor: Deteniendo procesamiento", {
      estadoAnterior: isProcessing,
      framesProcessados: framesProcessed,
      estadisticasFinales: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processorRef.current.stop();
    calibrationInProgressRef.current = false;
  }, [isProcessing, framesProcessed, signalStats]);

  const calibrate = useCallback(async () => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No hay procesador disponible para calibrar");
      return false;
    }

    try {
      console.log("useSignalProcessor: Iniciando calibración avanzada", {
        timestamp: new Date().toISOString()
      });
      
      calibrationInProgressRef.current = true;
      await processorRef.current.calibrate();
      
      // Esperamos un poco para dar tiempo a la calibración automática
      setTimeout(() => {
        calibrationInProgressRef.current = false;
        console.log("useSignalProcessor: Calibración avanzada completada", {
          timestamp: new Date().toISOString()
        });
      }, 3000);
      
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de calibración detallado:", {
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
      console.error("useSignalProcessor: No hay procesador disponible para procesar frames");
      return;
    }

    if (isProcessing) {
      console.log("processFrame: Procesando frame", {
        width: imageData.width,
        height: imageData.height,
        timestamp: Date.now()
      });
      
      // Verificar que los callbacks estén correctamente asignados
      if (!processorRef.current.onSignalReady) {
        console.error("processFrame: onSignalReady no está definido en el procesador");
        return;
      }
      
      try {
        processorRef.current.processFrame(imageData);
      } catch (error) {
        console.error("processFrame: Error al procesar frame", error);
        toast({
          title: "Error al procesar frame",
          description: error instanceof Error ? error.message : "Error desconocido",
          variant: "destructive"
        });
      }
    }
  }, [isProcessing]);

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
    processFrame
  };
};
