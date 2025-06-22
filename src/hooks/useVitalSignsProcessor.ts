import { useState, useCallback, useRef, useEffect } from 'react';
import { AdvancedVitalSignsProcessor, BiometricReading } from '../modules/vital-signs/VitalSignsProcessor';
import { ProcessedSignal } from '../types/signal';

// Define a new interface for the combined vital signs data returned by this hook
export interface VitalSignsDisplayData extends BiometricReading {
  pressure: string; // e.g., "120/80"
  arrhythmiaStatus: string; // e.g., "SIN ARRITMIAS|0"
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  hemoglobin: number; // assuming this is a calculated value or placeholder
}

/**
 * Custom hook for processing vital signs with advanced algorithms
 * Uses improved signal processing and arrhythmia detection based on medical research
 */
export const useVitalSignsProcessor = () => {
  // State and refs
  const [processor] = useState(() => {
    console.log("useVitalSignsProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString()
    });
    return new AdvancedVitalSignsProcessor();
  });
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const [lastValidResults, setLastValidResults] = useState<BiometricReading | null>(null);
  const lastArrhythmiaTime = useRef<number>(0);
  const hasDetectedArrhythmia = useRef<boolean>(false);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Advanced configuration based on clinical guidelines
  const MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // Minimum 1 second between arrhythmias
  const MAX_ARRHYTHMIAS_PER_SESSION = 20; // Reasonable maximum for 30 seconds
  const SIGNAL_QUALITY_THRESHOLD = 0.55; // Signal quality required for reliable detection
  
  useEffect(() => {
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      parametros: {
        MIN_TIME_BETWEEN_ARRHYTHMIAS,
        MAX_ARRHYTHMIAS_PER_SESSION,
        SIGNAL_QUALITY_THRESHOLD
      }
    });
    
    return () => {
      console.log("useVitalSignsProcessor: Hook destruido", {
        sessionId: sessionId.current,
        arritmiasTotales: arrhythmiaCounter,
        señalesProcesadas: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Start calibration for all vital signs
   */
  const startCalibration = useCallback(() => {
    console.warn("Calibración no implementada en AdvancedVitalSignsProcessor.");
  }, []);
  
  /**
   * Force calibration to complete immediately
   */
  const forceCalibrationCompletion = useCallback(() => {
    console.warn("Finalización forzada de calibración no implementada en AdvancedVitalSignsProcessor.");
  }, []);
  
  // Process the signal with improved algorithms
  const processSignal = useCallback((signal: ProcessedSignal, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    processedSignals.current++;
    
    console.log("useVitalSignsProcessor: Procesando señal", {
      valorEntrada: signal.filteredValue, // Log the filtered value from ProcessedSignal
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      contadorArritmias: arrhythmiaCounter,
      señalNúmero: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      // Removed calibration related logs
    });
    
    // Process signal through the vital signs processor
    const ppgSignalForAdvancedProcessor = {
        red: [signal.avgRed || 0], // Pass avgRed as a single-element array
        green: [signal.avgGreen || 0],
        ir: [signal.avgBlue || 0], // Assuming avgBlue is used for IR
        timestamp: signal.timestamp,
      };
      
      const biometricResult = processor.processSignal(ppgSignalForAdvancedProcessor); // Pass the constructed PPGSignal
      const currentTime = Date.now();
    
    // Guardar para depuración
    if (processedSignals.current % 20 === 0) {
      signalLog.current.push({
        timestamp: currentTime,
        value: signal.filteredValue,
        result: {...biometricResult}
      });
      
      // Mantener el log a un tamaño manejable
      if (signalLog.current.length > 50) {
        signalLog.current = signalLog.current.slice(-50);
      }
      
      console.log("useVitalSignsProcessor: Log de señales", {
        totalEntradas: signalLog.current.length,
        ultimasEntradas: signalLog.current.slice(-3)
      });
    }
    
    // If we have a valid BiometricReading, save it
    if (biometricResult && biometricResult.spo2 > 0 && biometricResult.glucose > 0) { // Removed lipids.totalCholesterol
      console.log("useVitalSignsProcessor: Resultado válido detectado", {
        spo2: biometricResult.spo2,
        presión: `${biometricResult.sbp}/${biometricResult.dbp}`,
        glucosa: biometricResult.glucose,
        timestamp: new Date().toISOString()
      });
      
      setLastValidResults(biometricResult);
    }
    
    // Enhanced RR interval analysis (more robust than previous)
    if (rrData?.intervals && rrData.intervals.length >= 3) {
      const lastThreeIntervals = rrData.intervals.slice(-3);
      const avgRR = lastThreeIntervals.reduce((a, b) => a + b, 0) / lastThreeIntervals.length;
      
      // Calculate RMSSD (Root Mean Square of Successive Differences)
      let rmssd = 0;
      for (let i = 1; i < lastThreeIntervals.length; i++) {
        rmssd += Math.pow(lastThreeIntervals[i] - lastThreeIntervals[i-1], 2);
      }
      rmssd = Math.sqrt(rmssd / (lastThreeIntervals.length - 1));
      
      // Enhanced arrhythmia detection criteria with SD metrics
      const lastRR = lastThreeIntervals[lastThreeIntervals.length - 1];
      const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
      
      console.log("useVitalSignsProcessor: Análisis avanzado RR", {
        rmssd,
        rrVariation,
        lastRR,
        avgRR,
        lastThreeIntervals,
        tiempoDesdeÚltimaArritmia: currentTime - lastArrhythmiaTime.current,
        arritmiaDetectada: hasDetectedArrhythmia.current,
        contadorArritmias: arrhythmiaCounter,
        timestamp: new Date().toISOString()
      });
      
      // Multi-parametric arrhythmia detection algorithm
      if ((rmssd > 50 && rrVariation > 0.20) || // Primary condition
          (lastRR > 1.4 * avgRR) ||             // Extreme outlier condition
          (lastRR < 0.6 * avgRR)) {             // Extreme outlier condition
          
        console.log("useVitalSignsProcessor: Posible arritmia detectada", {
          rmssd,
          rrVariation,
          condición1: rmssd > 50 && rrVariation > 0.20,
          condición3: lastRR > 1.4 * avgRR,
          condición4: lastRR < 0.6 * avgRR,
          timestamp: new Date().toISOString()
        });
        
        if (currentTime - lastArrhythmiaTime.current >= MIN_TIME_BETWEEN_ARRHYTHMIAS &&
            arrhythmiaCounter < MAX_ARRHYTHMIAS_PER_SESSION) {
          
          hasDetectedArrhythmia.current = true;
          const nuevoContador = arrhythmiaCounter + 1;
          setArrhythmiaCounter(nuevoContador);
          lastArrhythmiaTime.current = currentTime;
          
          console.log("Arritmia confirmada:", {
            rmssd,
            rrVariation,
            lastRR,
            avgRR,
            intervals: lastThreeIntervals,
            counter: nuevoContador,
            timestamp: new Date().toISOString()
          });

          return {
            ...(biometricResult || {} as BiometricReading),
            pressure: biometricResult ? `${biometricResult.sbp}/${biometricResult.dbp}` : "--/--",
            arrhythmiaStatus: `ARRITMIA DETECTADA|${nuevoContador}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd,
              rrVariation
            },
            hemoglobin: biometricResult ? (biometricResult.spo2 * 0.15) : 0, // Placeholder calculation for hemoglobin
          };
        } else {
          console.log("useVitalSignsProcessor: Arritmia detectada pero ignorada", {
            motivo: currentTime - lastArrhythmiaTime.current < MIN_TIME_BETWEEN_ARRHYTHMIAS ? 
              "Demasiado pronto desde la última" : "Máximo número de arritmias alcanzado",
            tiempoDesdeÚltima: currentTime - lastArrhythmiaTime.current,
            máximoPermitido: MAX_ARRHYTHMIAS_PER_SESSION,
            contadorActual: arrhythmiaCounter,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // If we previously detected an arrhythmia, maintain that state
    let currentArrhythmiaStatus = `SIN ARRITMIAS|${arrhythmiaCounter}`;
    if (hasDetectedArrhythmia.current) {
      currentArrhythmiaStatus = `ARRITMIA DETECTADA|${arrhythmiaCounter}`;
    }
    
    // Return the combined result, now using BiometricReading properties
    return {
      ...(biometricResult || {} as BiometricReading),
      pressure: biometricResult ? `${biometricResult.sbp}/${biometricResult.dbp}` : "--/--",
      arrhythmiaStatus: currentArrhythmiaStatus,
      lastArrhythmiaData: null,
      hemoglobin: biometricResult ? (biometricResult.spo2 * 0.15) : 0, // Placeholder calculation for hemoglobin
    };
  }, [processor, arrhythmiaCounter]);

  // Soft reset: reset internal states of the hook
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        arritmias: arrhythmiaCounter,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          sbp: lastValidResults.sbp,
          dbp: lastValidResults.dbp,
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    console.log("Reseteo suave completado");
    return null; // Return null as there are no saved results from a stateless processor
  }, [arrhythmiaCounter, lastValidResults]);
  
  // Hard reset: clear all results and reset
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo completo", {
      estadoAnterior: {
        arritmias: arrhythmiaCounter,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          sbp: lastValidResults.sbp,
          dbp: lastValidResults.dbp,
        } : null,
        señalesProcesadas: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    processedSignals.current = 0;
    signalLog.current = [];
    console.log("Reseteo completo finalizado");
  }, [arrhythmiaCounter, lastValidResults]);

  return {
    processSignal,
    reset,
    fullReset,
    startCalibration,
    forceCalibrationCompletion,
    arrhythmiaCounter,
    lastValidResults,
    // Removed calibrationProgress
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
