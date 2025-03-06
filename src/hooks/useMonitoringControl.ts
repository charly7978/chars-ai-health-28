
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSignalProcessor } from './useSignalProcessor';
import { useVitalSignsProcessor } from './useVitalSignsProcessor';
import { useHeartBeatProcessor } from './useHeartBeatProcessor';

interface MonitoringControlReturn {
  isMonitoring: boolean;
  isCameraOn: boolean;
  elapsedTime: number;
  vitalSigns: {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
    signalQuality?: number;
    perfusionIndex?: number;
  };
  heartRate: number;
  arrhythmiaCount: string | number;
  signalQuality: number;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  startMonitoring: () => void;
  handleReset: () => void;
  processFrame: (imageData: ImageData) => void;
  lastSignal: any;
}

export const useMonitoringControl = (): MonitoringControlReturn => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<{ 
    spo2: number; 
    pressure: string;
    arrhythmiaStatus: string;
    signalQuality?: number;
    perfusionIndex?: number;
  }>({ 
    spo2: 0, 
    pressure: "--/--",
    arrhythmiaStatus: "--" 
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState<string | number>("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<{
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null>(null);
  
  const measurementTimerRef = useRef<number | null>(null);
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processVitalSigns, reset: resetVitalSigns } = useVitalSignsProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();

  // Efecto para procesar las señales y actualizar los signos vitales
  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      // Procesar latido cardíaco
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      setHeartRate(heartBeatResult.bpm);
      
      // Procesar signos vitales
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(vitals);
        // Extraer el contador de arritmias si está disponible
        const arrhythmiaInfo = vitals.arrhythmiaStatus.split('|');
        setArrhythmiaCount(arrhythmiaInfo[1] || "--");
        
        // Guardar datos de arritmia para visualización
        if (vitals.lastArrhythmiaData) {
          setLastArrhythmiaData(vitals.lastArrhythmiaData);
        }
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  const startMonitoring = useCallback(() => {
    if (isMonitoring) {
      handleReset();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      startProcessing();
      setElapsedTime(0);
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "CALIBRANDO...|0"
      }));
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          if (prev >= 30) {
            handleReset();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    }
  }, [isMonitoring, startProcessing]);

  const handleReset = useCallback(() => {
    console.log("Handling reset: turning off camera and stopping processing");
    setIsMonitoring(false);
    setIsCameraOn(false); // This is crucial to turn off the camera
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    resetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns({ 
      spo2: 0, 
      pressure: "--/--",
      arrhythmiaStatus: "--" 
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    setLastArrhythmiaData(null);
  }, [stopProcessing, resetVitalSigns]);

  return {
    isMonitoring,
    isCameraOn,
    elapsedTime,
    vitalSigns,
    heartRate,
    arrhythmiaCount,
    signalQuality,
    lastArrhythmiaData,
    startMonitoring,
    handleReset,
    processFrame,
    lastSignal
  };
};
