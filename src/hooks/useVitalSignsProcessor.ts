import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { applyTimeBasedProcessing } from '../modules/vital-signs/utils';

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
    return new VitalSignsProcessor();
  });
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const lastArrhythmiaTime = useRef<number>(0);
  const hasDetectedArrhythmia = useRef<boolean>(false);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  const measurementActive = useRef<boolean>(false);
  const measurementStartTime = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const bloodPressureReadings = useRef<{systolic: number[], diastolic: number[]}>({
    systolic: [],
    diastolic: []
  });
  
  // Advanced configuration based on clinical guidelines
  const MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // Minimum 1 second between arrhythmias
  const MAX_ARRHYTHMIAS_PER_SESSION = 20; // Reasonable maximum for 30 seconds
  const SIGNAL_QUALITY_THRESHOLD = 0.55; // Signal quality required for reliable detection
  const MEASUREMENT_DURATION = 30; // Total duration in seconds
  const FINAL_PROCESSING_TIME = 29; // Time in seconds when to apply special processing
  
  useEffect(() => {
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      parametros: {
        MIN_TIME_BETWEEN_ARRHYTHMIAS,
        MAX_ARRHYTHMIAS_PER_SESSION,
        SIGNAL_QUALITY_THRESHOLD,
        MEASUREMENT_DURATION,
        FINAL_PROCESSING_TIME
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
    console.log("useVitalSignsProcessor: Iniciando calibración de todos los parámetros", {
      timestamp: new Date().toISOString(),
      sessionId: sessionId.current
    });
    
    processor.startCalibration();
    measurementActive.current = true;
    measurementStartTime.current = Date.now();
    elapsedTimeRef.current = 0;
    bloodPressureReadings.current = { systolic: [], diastolic: [] };
  }, [processor]);
  
  /**
   * Force calibration to complete immediately
   */
  const forceCalibrationCompletion = useCallback(() => {
    console.log("useVitalSignsProcessor: Forzando finalización de calibración", {
      timestamp: new Date().toISOString(),
      sessionId: sessionId.current
    });
    
    processor.forceCalibrationCompletion();
  }, [processor]);
  
  // Process the signal with improved algorithms
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    processedSignals.current++;
    
    // Update elapsed time for time-based processing
    if (measurementActive.current && measurementStartTime.current > 0) {
      elapsedTimeRef.current = (Date.now() - measurementStartTime.current) / 1000;
    }
    
    console.log("useVitalSignsProcessor: Procesando señal", {
      valorEntrada: value,
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      contadorArritmias: arrhythmiaCounter,
      señalNúmero: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      calibrando: processor.isCurrentlyCalibrating(),
      progresoCalibración: processor.getCalibrationProgress(),
      medicionActiva: measurementActive.current,
      tiempoTranscurrido: elapsedTimeRef.current.toFixed(1)
    });
    
    // Marcar que la medición está activa
    if (!measurementActive.current) {
      measurementActive.current = true;
      measurementStartTime.current = Date.now();
    }
    
    // Process signal through the vital signs processor
    const result = processor.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Store blood pressure readings for time-based processing
    if (result.pressure && result.pressure !== "--/--") {
      const [systolic, diastolic] = result.pressure.split('/').map(Number);
      if (!isNaN(systolic) && !isNaN(diastolic)) {
        bloodPressureReadings.current.systolic.push(systolic);
        bloodPressureReadings.current.diastolic.push(diastolic);
      }
    }
    
    // Apply advanced time-based processing at the 29s mark (o al finalizar la medición) for blood pressure readings
    let processedResult = { ...result };
    
    if (elapsedTimeRef.current >= FINAL_PROCESSING_TIME && 
        bloodPressureReadings.current.systolic.length > 5 && 
        bloodPressureReadings.current.diastolic.length > 5) {
        
      console.log(`[Time-Based BP Processing] Advanced filtering at ${FINAL_PROCESSING_TIME}s: using median and average fusion`, {
        systolicReadings: bloodPressureReadings.current.systolic.length,
        diastolicReadings: bloodPressureReadings.current.diastolic.length,
        exactTime: elapsedTimeRef.current
      });
      
      const processedSystolic = applyTimeBasedProcessing(
        bloodPressureReadings.current.systolic, 
        elapsedTimeRef.current,
        FINAL_PROCESSING_TIME
      );
      
      const processedDiastolic = applyTimeBasedProcessing(
        bloodPressureReadings.current.diastolic, 
        elapsedTimeRef.current,
        FINAL_PROCESSING_TIME
      );
      
      if (processedSystolic > 0 && processedDiastolic > 0) {
        processedResult.pressure = `${processedSystolic}/${processedDiastolic}`;
        console.log(`[Time-Based BP Processing] Final advanced processed value:`, {
          pressure: processedResult.pressure,
          originalPressure: result.pressure
        });
      }
    }
    
    // Guardar para depuración
    if (processedSignals.current % 20 === 0) {
      signalLog.current.push({
        timestamp: currentTime,
        value,
        result: {...processedResult}
      });
      
      // Mantener el log a un tamaño manejable
      if (signalLog.current.length > 50) {
        signalLog.current = signalLog.current.slice(-50);
      }
      
      console.log("useVitalSignsProcessor: Log de señales", {
        totalEntradas: signalLog.current.length,
        ultimasEntradas: signalLog.current.slice(-3),
        tiempoTranscurrido: elapsedTimeRef.current.toFixed(1)
      });
    }
    
    // Si tenemos un resultado válido, guárdalo
    if (processedResult.spo2 > 0 && processedResult.glucose > 0 && processedResult.lipids.totalCholesterol > 0) {
      console.log("useVitalSignsProcessor: Resultado válido detectado", {
        spo2: processedResult.spo2,
        presión: processedResult.pressure,
        glucosa: processedResult.glucose,
        lípidos: processedResult.lipids,
        timestamp: new Date().toISOString(),
        tiempoTranscurrido: elapsedTimeRef.current.toFixed(1)
      });
      
      setLastValidResults(processedResult);
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
      
      // Calculate standard deviation of intervals
      const rrSD = Math.sqrt(
        lastThreeIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
        lastThreeIntervals.length
      );
      
      console.log("useVitalSignsProcessor: Análisis avanzado RR", {
        rmssd,
        rrVariation,
        rrSD,
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
          (rrSD > 35 && rrVariation > 0.18) ||  // Secondary condition
          (lastRR > 1.4 * avgRR) ||             // Extreme outlier condition
          (lastRR < 0.6 * avgRR)) {             // Extreme outlier condition
          
        console.log("useVitalSignsProcessor: Posible arritmia detectada", {
          rmssd,
          rrVariation,
          rrSD,
          lastRR,
          avgRR,
          intervals: lastThreeIntervals,
          condición1: rmssd > 50 && rrVariation > 0.20,
          condición2: rrSD > 35 && rrVariation > 0.18,
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
            rrSD,
            lastRR,
            avgRR,
            intervals: lastThreeIntervals,
            counter: nuevoContador,
            timestamp: new Date().toISOString()
          });

          return {
            ...result,
            arrhythmiaStatus: `ARRITMIA DETECTADA|${nuevoContador}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd,
              rrVariation
            }
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
    if (hasDetectedArrhythmia.current) {
      return {
        ...processedResult,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No arrhythmias detected
    return {
      ...processedResult,
      arrhythmiaStatus: `SIN ARRITMIAS|${arrhythmiaCounter}`
    };
  }, [processor, arrhythmiaCounter]);

  /**
   * Finaliza la medición y aplica el procesamiento estadístico final
   * Devuelve los resultados finales
   */
  const completeMeasurement = useCallback(() => {
    if (!measurementActive.current) {
      console.log("useVitalSignsProcessor: No hay medición activa para completar");
      return lastValidResults;
    }
    
    console.log("useVitalSignsProcessor: Completando medición, aplicando procesamiento final", {
      tiempoTranscurrido: elapsedTimeRef.current.toFixed(1),
      lecturasSistolicas: bloodPressureReadings.current.systolic.length,
      lecturasDiastolicas: bloodPressureReadings.current.diastolic.length
    });
    
    // Process final readings with special processing if not already done
    let finalResults = processor.completeMeasurement();
    
    // If we have enough blood pressure readings and haven't already applied special processing
    if (bloodPressureReadings.current.systolic.length > 5 && 
        bloodPressureReadings.current.diastolic.length > 5) {
      
      const processedSystolic = applyTimeBasedProcessing(
        bloodPressureReadings.current.systolic, 
        MEASUREMENT_DURATION,  // Force processing by using target time
        FINAL_PROCESSING_TIME
      );
      
      const processedDiastolic = applyTimeBasedProcessing(
        bloodPressureReadings.current.diastolic, 
        MEASUREMENT_DURATION,  // Force processing by using target time
        FINAL_PROCESSING_TIME
      );
      
      if (processedSystolic > 0 && processedDiastolic > 0) {
        const processedBP = `${processedSystolic}/${processedDiastolic}`;
        
        console.log("useVitalSignsProcessor: Presión arterial finalizada con procesamiento avanzado:", {
          presionProcesada: processedBP,
          presionOriginal: finalResults?.pressure || "N/A",
          lecturasSistolicas: bloodPressureReadings.current.systolic.length,
          lecturasDiastolicas: bloodPressureReadings.current.diastolic.length
        });
        
        if (finalResults) {
          finalResults.pressure = processedBP;
        }
      }
    }
    
    measurementActive.current = false;
    measurementStartTime.current = 0;
    elapsedTimeRef.current = 0;
    
    console.log("useVitalSignsProcessor: Medición completada", {
      resultadosFinales: finalResults,
      timestamp: new Date().toISOString()
    });
    
    // Actualizar los resultados válidos con los valores finales
    if (finalResults && lastValidResults) {
      const updatedResults = {
        ...lastValidResults,
        pressure: finalResults.pressure,
        glucose: finalResults.glucose
      };
      
      setLastValidResults(updatedResults);
      return updatedResults;
    }
    
    return lastValidResults;
  }, [processor, lastValidResults]);

  // Soft reset: mantener los resultados pero reiniciar los procesadores
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        arritmias: arrhythmiaCounter,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    const savedResults = processor.reset();
    if (savedResults) {
      console.log("useVitalSignsProcessor: Guardando resultados tras reset", {
        resultadosGuardados: {
          spo2: savedResults.spo2,
          presión: savedResults.pressure,
          estadoArritmia: savedResults.arrhythmiaStatus
        },
        timestamp: new Date().toISOString()
      });
      
      setLastValidResults(savedResults);
    } else {
      console.log("useVitalSignsProcessor: No hay resultados para guardar tras reset", {
        timestamp: new Date().toISOString()
      });
    }
    
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    measurementActive.current = false;
    console.log("Reseteo suave completado - manteniendo resultados");
    return savedResults;
  }, [processor]);
  
  // Hard reset: borrar todos los resultados y reiniciar
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo completo", {
      estadoAnterior: {
        arritmias: arrhythmiaCounter,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null,
        señalesProcesadas: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    processor.fullReset();
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    processedSignals.current = 0;
    signalLog.current = [];
    measurementActive.current = false;
    console.log("Reseteo completo finalizado - borrando todos los resultados");
  }, [processor, arrhythmiaCounter, lastValidResults]);

  return {
    processSignal,
    reset,
    fullReset,
    startCalibration,
    forceCalibrationCompletion,
    completeMeasurement,
    arrhythmiaCounter,
    lastValidResults,
    isMeasurementActive: () => measurementActive.current,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10),
      elapsedTime: elapsedTimeRef.current,
      bloodPressureReadings: {
        systolicCount: bloodPressureReadings.current.systolic.length,
        diastolicCount: bloodPressureReadings.current.diastolic.length
      }
    }
  };
};

