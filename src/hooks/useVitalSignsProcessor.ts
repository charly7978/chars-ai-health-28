
import { useState, useCallback, useRef } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

/**
 * Custom hook for processing vital signs with advanced algorithms
 * Uses improved signal processing and arrhythmia detection based on medical research
 */
export const useVitalSignsProcessor = () => {
  // State and refs
  const [processor] = useState(() => new VitalSignsProcessor());
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const lastArrhythmiaTime = useRef<number>(0);
  const hasDetectedArrhythmia = useRef<boolean>(false);
  
  // Advanced configuration based on clinical guidelines
  const MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // Minimum 1 second between arrhythmias
  const MAX_ARRHYTHMIAS_PER_SESSION = 20; // Reasonable maximum for 30 seconds
  const SIGNAL_QUALITY_THRESHOLD = 0.55; // Signal quality required for reliable detection
  
  // Process the signal with improved algorithms
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    // Process signal through the vital signs processor
    const result = processor.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Si tenemos un resultado válido, guárdalo
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      setLastValidResults(result);
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
      
      // Multi-parametric arrhythmia detection algorithm
      if ((rmssd > 50 && rrVariation > 0.20) || // Primary condition
          (rrSD > 35 && rrVariation > 0.18) ||  // Secondary condition
          (lastRR > 1.4 * avgRR) ||             // Extreme outlier condition
          (lastRR < 0.6 * avgRR)) {             // Extreme outlier condition
          
        if (currentTime - lastArrhythmiaTime.current >= MIN_TIME_BETWEEN_ARRHYTHMIAS &&
            arrhythmiaCounter < MAX_ARRHYTHMIAS_PER_SESSION) {
          
          hasDetectedArrhythmia.current = true;
          setArrhythmiaCounter(prev => prev + 1);
          lastArrhythmiaTime.current = currentTime;
          
          console.log("Arritmia detectada:", {
            rmssd,
            rrVariation,
            rrSD,
            lastRR,
            avgRR,
            intervals: lastThreeIntervals,
            counter: arrhythmiaCounter + 1
          });

          return {
            ...result,
            arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounter + 1}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd,
              rrVariation
            }
          };
        }
      }
    }
    
    // If we previously detected an arrhythmia, maintain that state
    if (hasDetectedArrhythmia.current) {
      return {
        ...result,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No arrhythmias detected
    return {
      ...result,
      arrhythmiaStatus: `SIN ARRITMIAS|${arrhythmiaCounter}`
    };
  }, [processor, arrhythmiaCounter]);

  // Soft reset: mantener los resultados pero reiniciar los procesadores
  const reset = useCallback(() => {
    const savedResults = processor.reset();
    if (savedResults) {
      setLastValidResults(savedResults);
    }
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    console.log("Reseteo suave - manteniendo resultados");
    return savedResults;
  }, [processor]);
  
  // Hard reset: borrar todos los resultados y reiniciar
  const fullReset = useCallback(() => {
    processor.fullReset();
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    console.log("Reseteo completo - borrando todos los resultados");
  }, [processor]);

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter,
    lastValidResults
  };
};
