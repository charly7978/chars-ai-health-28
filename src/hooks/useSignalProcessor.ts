import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor'; // Esta es la importación correcta
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { toast } from "@/components/ui/use-toast";

export const useSignalProcessor = () => {
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    // Creamos el procesador pero NO asignamos los callbacks aquí
    // se asignarán en el useEffect
    return new PPGSignalProcessor();
  });
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

  // Análisis avanzado de calidad para detección de falsos positivos
  const analyzeSignalQuality = useCallback((signal: ProcessedSignal): boolean => {
    // CAMBIO CRÍTICO: Si hay alguna detección, confiar en ella
    if (signal.fingerDetected) return true;
    
    const now = Date.now();
    
    // Añadir señal al historial (limitado a 300 para 10 segundos a 30fps)
    signalHistoryRef.current.push({...signal});
    if (signalHistoryRef.current.length > 300) {
      signalHistoryRef.current.shift();
    }
    
    // Si tenemos menos de 15 señales, confiamos en la detección original
    if (signalHistoryRef.current.length < 15) return signal.fingerDetected;
    
    // Obtener historia reciente (últimos 15 frames / 0.5 segundos)
    const recentHistory = signalHistoryRef.current.slice(-15);
    
    // 1. Criterio de estabilidad: verificar consistencia en detección
    const detectionCount = recentHistory.filter(s => s.fingerDetected).length;
    const detectionRatio = detectionCount / recentHistory.length;
    
    // 2. Criterio de calidad: verificar que la calidad tenga sentido
    const avgQuality = recentHistory.reduce((sum, s) => sum + s.quality, 0) / recentHistory.length;
    const qualityConsistency = Math.abs(signal.quality - avgQuality) < 15;
    
    // 3. Criterio de variabilidad PPG: verificar cambios fisiológicamente plausibles
    const filteredValues = recentHistory.map(s => s.filteredValue);
    const maxDiff = Math.max(...filteredValues) - Math.min(...filteredValues);
    const hasPlausibleVariation = maxDiff > 0.3 && maxDiff < 50; // Más permisivo
    
    // 4. Criterio de perfusión: verificar índice de perfusión plausible
    const avgPerfusion = recentHistory.reduce((sum, s) => sum + (s.perfusionIndex || 0), 0) / recentHistory.length;
    const hasPerfusion = avgPerfusion > 0.03 && avgPerfusion < 5; // Más permisivo
    
    // Combinar criterios para decisión final - EXTREMADAMENTE PERMISIVO
    const validFingerDetection = 
      (detectionRatio > 0.4) || // Reducido aún más
      (qualityConsistency && (hasPlausibleVariation || hasPerfusion)); 
    
    // Registrar transiciones de calidad significativas para análisis
    if (signalHistoryRef.current.length > 30 && 
        Math.abs(signal.quality - avgQuality) > 20 &&
        now - signalStats.lastQualityUpdateTime > 1000) {
      
      qualityTransitionsRef.current.push({
        time: now,
        from: Math.round(avgQuality),
        to: signal.quality
      });
      
      // Actualizar timestamp en las estadísticas
      setSignalStats(prev => ({
        ...prev,
        lastQualityUpdateTime: now
      }));
    }
    
    // Si la detección cambia respecto a lo reportado por el procesador
    if (validFingerDetection !== signal.fingerDetected && signalHistoryRef.current.length > 30) {
      console.log("useSignalProcessor: Corrección avanzada de detección", {
        processorDetection: signal.fingerDetected,
        correctedDetection: validFingerDetection,
        quality: signal.quality,
        avgQuality,
        filteredValue: signal.filteredValue,
        perfusionIndex: signal.perfusionIndex,
        detectionRatio,
        qualityConsistency,
        hasPlausibleVariation,
        hasPerfusion,
        timestamp: new Date().toISOString()
      });
    }
    
    return validFingerDetection;
  }, [signalStats.lastQualityUpdateTime]);

  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    // IMPORTANTE: Asignar los callbacks correctamente
    processor.onSignalReady = (signal: ProcessedSignal) => {
      console.log("Callback onSignalReady llamado correctamente", {
        timestamp: new Date(signal.timestamp).toISOString(),
        fingerDetected: signal.fingerDetected,
        quality: signal.quality,
        rawValue: signal.rawValue,
        filteredValue: signal.filteredValue
      });
      
      // AUMENTAR ROI PARA AYUDAR A DETECCIÓN
      if (signal.roi) {
        signal.roi = {
          ...signal.roi,
          width: signal.roi.width * 1.2,
          height: signal.roi.height * 1.2
        };
      }
      
      // Aplicar análisis avanzado de calidad
      const validatedFingerDetected = analyzeSignalQuality(signal);
      const modifiedSignal = { 
        ...signal, 
        fingerDetected: validatedFingerDetected,
        // Asegurar que la calidad sea siempre 0 cuando no hay detección
        quality: validatedFingerDetected ? signal.quality : 0
      };
      
      // Registrar métricas detalladas cada 30 frames
      if (framesProcessed % 30 === 0) {
        console.log("useSignalProcessor: Métricas detalladas", {
          timestamp: modifiedSignal.timestamp,
          formattedTime: new Date(modifiedSignal.timestamp).toISOString(),
          quality: modifiedSignal.quality,
          rawValue: modifiedSignal.rawValue,
          filteredValue: modifiedSignal.filteredValue,
          fingerDetected: modifiedSignal.fingerDetected,
          roi: modifiedSignal.roi,
          perfusionIndex: modifiedSignal.perfusionIndex,
          framesProcessed,
          signalStats: {
            min: signalStats.minValue,
            max: signalStats.maxValue,
            avg: signalStats.avgValue,
            total: signalStats.totalValues
          }
        });
      }
      
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

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error detallado:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      
      setError(error);
      
      // Mostrar toast de error solo para errores críticos
      if (error.code.includes("ERROR")) {
        toast({
          title: "Error en procesamiento de señal",
          description: error.message,
          variant: "destructive"
        });
      }
    };

    console.log("useSignalProcessor: Iniciando procesador", {
      timestamp: new Date().toISOString()
    });
    
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización detallado:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Error de inicialización",
        description: "No se pudo inicializar el procesador de señal",
        variant: "destructive"
      });
    });

    return () => {
      console.log("useSignalProcessor: Limpiando", {
        framesProcessados: framesProcessed,
        ultimaSeñal: lastSignal ? {
          calidad: lastSignal.quality,
          dedoDetectado: lastSignal.fingerDetected
        } : null,
        timestamp: new Date().toISOString()
      });
      processor.stop();
      signalHistoryRef.current = [];
      qualityTransitionsRef.current = [];
    };
  }, [processor, analyzeSignalQuality, framesProcessed]);

  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento", {
      estadoAnterior: isProcessing,
      timestamp: new Date().toISOString()
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
    
    processor.start();
  }, [processor, isProcessing]);

  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento", {
      estadoAnterior: isProcessing,
      framesProcessados: framesProcessed,
      estadisticasFinales: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processor.stop();
    calibrationInProgressRef.current = false;
  }, [processor, isProcessing, framesProcessed, signalStats]);

  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Iniciando calibración avanzada", {
        timestamp: new Date().toISOString()
      });
      
      calibrationInProgressRef.current = true;
      await processor.calibrate();
      
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
  }, [processor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      processor.processFrame(imageData);
    }
  }, [isProcessing, processor]);

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
