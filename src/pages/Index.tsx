import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import CalibrationDialog from "@/components/CalibrationDialog";
import CalibrationIndicator from "@/components/CalibrationIndicator";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>({
    spo2: 0,
    pressure: "--/--",
    arrhythmiaStatus: "--",
    lastArrhythmiaData: null,
    glucose: 0,
    lipids: {
      totalCholesterol: 0,
      triglycerides: 0
    },
    hemoglobin: 0
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState<string | number>("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState<VitalSignsResult['calibration']>();
  const measurementTimerRef = useRef<number | null>(null);
  const [calibrationMessage, setCalibrationMessage] = useState<string>("");
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults,
    startCalibration,
    forceCalibrationCompletion
  } = useVitalSignsProcessor();

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      
      startProcessing();
      
      setElapsedTime(0);
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "SIN ARRITMIAS|0",
        lastArrhythmiaData: null
      }));
      
      startAutoCalibration();
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const startAutoCalibration = () => {
    console.log("Iniciando auto-calibración real basada en datos del sensor");
    setIsCalibrating(true);
    setCalibrationMessage("Esperando detección del dedo para calibrar sensores");
    
    startCalibration();
    
    setVitalSigns(prev => ({
      ...prev,
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "CALIBRANDO...|0",
      lastArrhythmiaData: null,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0,
      calibration: {
        isCalibrating: true,
        progress: {
          heartRate: 0,
          spo2: 0,
          pressure: 0,
          arrhythmia: 0,
          glucose: 0,
          lipids: 0,
          hemoglobin: 0
        }
      }
    }));
  };

  const finishCalibration = (intervalId: number) => {
    console.log("Completando calibración");
    clearInterval(intervalId);
    forceCalibrationCompletion();
    setIsCalibrating(false);
    setCalibrationMessage("Calibración completada con éxito");
    
    setCalibrationProgress({
      isCalibrating: false,
      progress: {
        heartRate: 100,
        spo2: 100,
        pressure: 100,
        arrhythmia: 100,
        glucose: 100,
        lipids: 100,
        hemoglobin: 100
      }
    });
    
    setVitalSigns(prev => ({
      ...prev,
      arrhythmiaStatus: "CALIBRACIÓN COMPLETA|0",
      lastArrhythmiaData: null
    }));
    
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    setTimeout(() => {
      setCalibrationMessage("");
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "SIN ARRITMIAS|0",
        lastArrhythmiaData: null
      }));
    }, 1500);
  };

  const finalizeMeasurement = () => {
    console.log("Finalizando medición: manteniendo resultados");
    
    if (isCalibrating) {
      console.log("Calibración en progreso al finalizar, forzando finalización");
      forceCalibrationCompletion();
    }
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    setIsCalibrating(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
    setSignalQuality(0);
    setCalibrationProgress(undefined);
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    setIsCalibrating(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    fullResetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns({
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "SIN ARRITMIAS|0",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0,
      lastArrhythmiaData: null
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    setCalibrationProgress(undefined);
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30;
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    const enhanceCanvas = document.createElement('canvas');
    const enhanceCtx = enhanceCanvas.getContext('2d', {willReadFrequently: true});
    enhanceCanvas.width = 320;
    enhanceCanvas.height = 240;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          const frame = await imageCapture.grabFrame();
          
          const targetWidth = Math.min(320, frame.width);
          const targetHeight = Math.min(240, frame.height);
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          if (enhanceCtx) {
            enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
            
            enhanceCtx.globalCompositeOperation = 'source-over';
            enhanceCtx.fillStyle = 'rgba(255,0,0,0.05)';
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.globalCompositeOperation = 'source-over';
            
            const imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            processFrame(imageData);
          } else {
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
          }
          
          frameCount++;
          lastProcessTime = now;
          
          if (now - lastFpsUpdateTime > 1000) {
            processingFps = frameCount;
            frameCount = 0;
            lastFpsUpdateTime = now;
            console.log(`Rendimiento de procesamiento: ${processingFps} FPS`);
          }
        } catch (error) {
          console.error("Error capturando frame:", error);
        }
      }
      
      if (isMonitoring) {
        requestAnimationFrame(processImage);
      }
    };

    processImage();
  };

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      if (isCalibrating) {
        setCalibrationMessage("Calibrando sensores con datos reales");
      }
      
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      const calculatedHeartRate = heartBeatResult.bpm > 0 ? heartBeatResult.bpm : 0;
      setHeartRate(calculatedHeartRate);
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(vitals);
        if (vitals.arrhythmiaStatus) {
          setArrhythmiaCount(vitals.arrhythmiaStatus.split('|')[1] || "--");
        }
      }
      
      setSignalQuality(lastSignal.quality);
    } else if (isCalibrating) {
      setCalibrationMessage("Coloque su dedo en la cámara para comenzar la calibración");
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, isCalibrating]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black" style={{ 
      height: 'calc(100vh + env(safe-area-inset-bottom))',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <CameraView 
            onStreamReady={handleStreamReady}
            isMonitoring={isCameraOn}
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
              preserveResults={showResults}
            />
          </div>

          {isCalibrating && calibrationProgress && (
            <CalibrationIndicator 
              isCalibrating={isCalibrating} 
              progress={calibrationProgress?.progress || {
                heartRate: 0,
                spo2: 0,
                pressure: 0,
                arrhythmia: 0,
                glucose: 0,
                lipids: 0,
                hemoglobin: 0
              }}
              message={calibrationMessage}
              isFingerDetected={lastSignal?.fingerDetected || false}
            />
          )}

          <div className="absolute inset-x-0 top-[50%] bottom-[70px] bg-[#2C2A2B] px-3 py-4">
            <div className="grid grid-cols-3 gap-3 h-full">
              <VitalSign 
                label="FRECUENCIA CARDÍACA"
                value={heartRate || "--"}
                unit="BPM"
                calibrationProgress={calibrationProgress?.progress.heartRate}
              />
              <VitalSign 
                label="SPO2"
                value={vitalSigns.spo2 || "--"}
                unit="%"
                calibrationProgress={calibrationProgress?.progress.spo2}
              />
              <VitalSign 
                label="PRESIÓN ARTERIAL"
                value={vitalSigns.pressure}
                unit="mmHg"
                calibrationProgress={calibrationProgress?.progress.pressure}
              />
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                calibrationProgress={calibrationProgress?.progress.glucose}
              />
              <VitalSign 
                label="COLESTEROL/TRIGL."
                value={`${vitalSigns.lipids.totalCholesterol || "--"}/${vitalSigns.lipids.triglycerides || "--"}`}
                unit="mg/dL"
                calibrationProgress={calibrationProgress?.progress.lipids}
              />
              <VitalSign 
                label="HEMOGLOBINA"
                value={vitalSigns.hemoglobin || "--"}
                unit="g/dL"
                calibrationProgress={calibrationProgress?.progress.hemoglobin}
              />
            </div>
          </div>

          <div className="h-[70px] grid grid-cols-2 gap-px bg-[#2C2A2B] mt-auto">
            <MonitorButton 
              isMonitoring={isMonitoring}
              onClick={startMonitoring}
            />
            <button 
              onClick={handleReset}
              className="w-full h-full bg-gradient-to-b from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 active:from-gray-700 active:to-gray-800 transition-colors duration-200 shadow-md"
              style={{textShadow: '0 1px 2px rgba(0,0,0,0.2)'}}
            >
              RESETEAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
