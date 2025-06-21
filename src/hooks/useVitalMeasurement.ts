import { useState, useEffect, useRef } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose: number;
  totalCholesterol: number;
  triglycerides: number;
  hemoglobin: number;
}

interface UseVitalMeasurementProps {
  isMeasuring: boolean;
  currentVitalSigns: VitalSignsResult;
  currentArrhythmiaCount: string | number;
  currentHeartRate: number;
  isCalibrating: boolean;
  calibrationProgress?: VitalSignsResult['calibration'];
}

export const useVitalMeasurement = ({
  isMeasuring,
  currentVitalSigns,
  currentArrhythmiaCount,
  currentHeartRate,
  isCalibrating,
  calibrationProgress,
}: UseVitalMeasurementProps) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0,
    totalCholesterol: 0,
    triglycerides: 0,
    hemoglobin: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const measurementTimerRef = useRef<number | null>(null);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: Math.random().toString(36).substring(2, 9), // Identificador único para esta sesión
      isCalibrating,
      calibrationProgress
    });

    if (!isMeasuring) {
      console.log('useVitalMeasurement - Reiniciando mediciones por detención', {
        prevValues: {...measurements},
        timestamp: new Date().toISOString()
      });
      
      setMeasurements({
        heartRate: 0,
        spo2: 0,
        pressure: "--/--",
        arrhythmiaCount: "--",
        glucose: 0,
        totalCholesterol: 0,
        triglycerides: 0,
        hemoglobin: 0
      });
      
      setElapsedTime(0);

      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
        measurementTimerRef.current = null;
      }
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición', {
      startTime: new Date(startTime).toISOString(),
      prevValues: {...measurements}
    });
    
    const MEASUREMENT_DURATION = 30000; // Duración total de la medición en ms (30 segundos)

    // Actualizar las mediciones directamente desde las props
    setMeasurements({
      heartRate: currentHeartRate,
      spo2: currentVitalSigns.spo2 || 0,
      pressure: currentVitalSigns.pressure || "--/--",
      arrhythmiaCount: currentArrhythmiaCount,
      glucose: currentVitalSigns.glucose || 0,
      totalCholesterol: currentVitalSigns.lipids?.totalCholesterol || 0,
      triglycerides: currentVitalSigns.lipids?.triglycerides || 0,
      hemoglobin: currentVitalSigns.hemoglobin || 0
    });

    // Configurar temporizador para la duración de la medición
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    measurementTimerRef.current = window.setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString()
      });
      
      setElapsedTime(elapsed / 1000);

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          timestamp: new Date().toISOString()
        });
        
        clearInterval(measurementTimerRef.current);
        measurementTimerRef.current = null;
        // Disparar evento si es necesario, pero la finalización ahora es externa
        // const event = new CustomEvent('measurementComplete');
        // window.dispatchEvent(event);
      }
    }, 200);

    return () => {
      console.log('useVitalMeasurement - Limpiando intervalo', {
        currentElapsed: elapsedTime,
        timestamp: new Date().toISOString()
      });
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
    };
  }, [isMeasuring, currentVitalSigns, currentArrhythmiaCount, currentHeartRate, isCalibrating, calibrationProgress]); // Dependencias del useEffect

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30), // Asegurar que no exceda 30 segundos
    isComplete: elapsedTime >= 30, // Indicar si la medición está completa
    isCalibrating,
    calibrationProgress,
  };
};
