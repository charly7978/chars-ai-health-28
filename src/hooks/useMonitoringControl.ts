
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
  const processingRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processVitalSigns, reset: resetVitalSigns } = useVitalSignsProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
        measurementTimerRef.current = null;
      }
      stopProcessing();
      setIsMonitoring(false);
      setIsCameraOn(false);
    };
  }, [stopProcessing]);

  // Process signals and update vital signs
  useEffect(() => {
    if (!lastSignal || !lastSignal.fingerDetected || !isMonitoring) {
      return;
    }
    
    try {
      // Process heart beat
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      if (heartBeatResult && heartBeatResult.bpm) {
        setHeartRate(heartBeatResult.bpm);
        
        // Process vital signs
        const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
        if (vitals) {
          setVitalSigns(vitals);
          // Extract arrhythmia counter if available
          const arrhythmiaInfo = vitals.arrhythmiaStatus.split('|');
          setArrhythmiaCount(arrhythmiaInfo[1] || "--");
          
          // Save arrhythmia data for visualization
          if (vitals.lastArrhythmiaData) {
            setLastArrhythmiaData(vitals.lastArrhythmiaData);
          }
        }
      }
      
      setSignalQuality(lastSignal.quality);
    } catch (error) {
      console.error("Error processing signal:", error);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.log('Error entering fullscreen mode:', err);
    }
  };

  const startMonitoring = useCallback(() => {
    console.log("Starting monitoring");
    
    // If already monitoring, stop first
    if (isMonitoring) {
      console.log("Already monitoring, stopping first");
      handleReset();
      // Give some time for everything to reset
      setTimeout(() => {
        startMonitoring();
      }, 500);
      return;
    }
    
    try {
      // Prevent rapid restarts
      const now = Date.now();
      if (now - startTimeRef.current < 1000) {
        console.log("Preventing rapid restart");
        return;
      }
      startTimeRef.current = now;
      
      enterFullScreen();
      
      // First turn on camera
      setIsCameraOn(true);
      
      // Wait a bit before setting isMonitoring
      setTimeout(() => {
        setIsMonitoring(true);
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
      }, 500);
    } catch (error) {
      console.error("Error starting monitoring:", error);
      handleReset();
    }
  }, [isMonitoring, startProcessing]);

  const handleReset = useCallback(() => {
    console.log("Handling reset: turning off camera and stopping processing");
    
    // First stop processing
    stopProcessing();
    
    // Then update states
    setIsMonitoring(false);
    
    // Give a little time before turning off camera
    setTimeout(() => {
      setIsCameraOn(false);
    }, 100);
    
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
