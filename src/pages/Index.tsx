
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>({
    spo2: 0,
    pressure: "--/--",
    arrhythmiaStatus: "--",
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
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<{
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null>(null);
  
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

  useEffect(() => {
    let fullscreenChangeCount = 0;
    const maxAttempts = 10;
    
    const requestFullscreen = () => {
      try {
        const element = document.documentElement;
        
        const isFullscreen = Boolean(
          document.fullscreenElement || 
          document.webkitFullscreenElement || 
          document.mozFullScreenElement || 
          document.msFullscreenElement
        );
        
        if (!isFullscreen) {
          console.log("Attempting fullscreen entry");
          
          if (element.requestFullscreen) {
            element.requestFullscreen();
          } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
          } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
          } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
          }
          
          setTimeout(() => {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('portrait')
                .catch(err => console.warn('Orientation lock failed:', err));
            }
          }, 500);
        }
      } catch (err) {
        console.error("Fullscreen request failed:", err);
      }
    };
    
    const checkFullscreen = () => {
      fullscreenChangeCount++;
      
      const isFullscreen = Boolean(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement
      );
      
      if (!isFullscreen) {
        console.log(`Not in fullscreen, attempt ${fullscreenChangeCount}/${maxAttempts}`);
        
        if (fullscreenChangeCount < maxAttempts) {
          setTimeout(requestFullscreen, 300);
        }
      } else {
        console.log("Successfully entered fullscreen mode");
      }
    };
    
    requestFullscreen();
    
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    document.addEventListener('mozfullscreenchange', checkFullscreen);
    document.addEventListener('MSFullscreenChange', checkFullscreen);
    
    const handleUserInteraction = () => {
      requestFullscreen();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    
    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      document.removeEventListener('mozfullscreenchange', checkFullscreen);
      document.removeEventListener('MSFullscreenChange', checkFullscreen);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });
    
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  const startMonitoring = () => {
    console.log("Iniciando monitoreo");
    requestAnimationFrame(() => {
      try {
        const element = document.documentElement;
        
        const isFullscreen = Boolean(
          document.fullscreenElement || 
          document.webkitFullscreenElement || 
          document.mozFullScreenElement || 
          document.msFullscreenElement
        );
        
        if (!isFullscreen) {
          if (element.requestFullscreen) {
            element.requestFullscreen();
          } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
          } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
          } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
          }
        }
      } catch (e) {
        console.error("Error forcing fullscreen on start:", e);
      }
    });
    
    setIsMonitoring(true);
    setIsCameraOn(true);
    setShowResults(false);
    
    startProcessing();
    
    setElapsedTime(0);
    setVitalSigns(prev => ({
      ...prev,
      arrhythmiaStatus: "SIN ARRITMIAS|0"
    }));
    
    console.log("Iniciando fase de calibración automática");
    startAutoCalibration();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    
    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        console.log(`Tiempo transcurrido: ${newTime}s`);
        
        if (newTime >= 30) {
          stopMonitoring();
          return 30;
        }
        return newTime;
      });
    }, 1000);
  };

  const stopMonitoring = () => {
    console.log("Deteniendo monitoreo");
    
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

  const handleMonitoringButton = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  const startAutoCalibration = () => {
    if (isCalibrating) {
      console.log("Ya hay una calibración en progreso, ignorando nueva solicitud");
      return;
    }

    console.log("Iniciando auto-calibración real con indicadores visuales");
    setIsCalibrating(true);
    
    startCalibration();
    
    console.log("Estableciendo valores iniciales de calibración");
    setCalibrationProgress({
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
    });
    
    let step = 0;
    const calibrationInterval = setInterval(() => {
      if (!isCalibrating) {
        console.log("Calibración cancelada externamente");
        clearInterval(calibrationInterval);
        return;
      }

      step += 1;
      
      if (step <= 10) {
        const progressPercent = step * 10;
        console.log(`Actualizando progreso de calibración: ${progressPercent}%`);
        
        setCalibrationProgress(prev => {
          if (!prev?.isCalibrating) return prev;
          return {
            isCalibrating: true,
            progress: {
              heartRate: progressPercent,
              spo2: Math.max(0, progressPercent - 10),
              pressure: Math.max(0, progressPercent - 20),
              arrhythmia: Math.max(0, progressPercent - 15),
              glucose: Math.max(0, progressPercent - 5),
              lipids: Math.max(0, progressPercent - 25),
              hemoglobin: Math.max(0, progressPercent - 30)
            }
          };
        });
      } else {
        console.log("Finalizando animación de calibración");
        clearInterval(calibrationInterval);
        
        if (isCalibrating) {
          console.log("Completando calibración");
          forceCalibrationCompletion();
          setIsCalibrating(false);
          
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
          
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
        }
      }
    }, 800);
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
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    setLastArrhythmiaData(null);
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
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      setHeartRate(heartBeatResult.bpm);
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(prevState => {
          const newState = { ...prevState };
          
          if (vitals.spo2 && vitals.spo2 > 0) {
            newState.spo2 = vitals.spo2;
          }
          
          if (vitals.pressure && vitals.pressure !== "--/--") {
            newState.pressure = vitals.pressure;
          }
          
          if (vitals.arrhythmiaStatus) {
            newState.arrhythmiaStatus = vitals.arrhythmiaStatus;
          }
          
          if (vitals.glucose && vitals.glucose > 0) {
            newState.glucose = vitals.glucose;
          }
          
          if (vitals.lipids) {
            if (vitals.lipids.totalCholesterol > 0) {
              newState.lipids.totalCholesterol = vitals.lipids.totalCholesterol;
            }
            if (vitals.lipids.triglycerides > 0) {
              newState.lipids.triglycerides = vitals.lipids.triglycerides;
            }
          }
          
          if (vitals.hemoglobin && vitals.hemoglobin > 0) {
            newState.hemoglobin = vitals.hemoglobin;
          }
          
          return newState;
        });
        
        if (vitals.lastArrhythmiaData) {
          setLastArrhythmiaData(vitals.lastArrhythmiaData);
          const [status, count] = vitals.arrhythmiaStatus.split('|');
          setArrhythmiaCount(count || "0");
        }
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  return (
    <div className="fixed inset-0 flex flex-col bg-gold-black" style={{ 
      height: '100dvh',
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: '100dvh',
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
              rawArrhythmiaData={lastArrhythmiaData}
              preserveResults={showResults}
            />
          </div>

          {isCalibrating && (
            <div className="absolute bottom-[55%] left-0 right-0 text-center">
              <span className="text-sm font-medium text-white animate-pulse">
                Calibración {Math.round(calibrationProgress?.progress?.heartRate || 0)}%
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-[72px] top-[calc(50%+2px)]">
            <div className="grid grid-cols-3 gap-0 h-full w-full">
              <VitalSign 
                label="FRECUENCIA CARDÍACA"
                value={heartRate || "--"}
                unit="BPM"
                highlighted={showResults}
              />
              <VitalSign 
                label="SPO2"
                value={vitalSigns.spo2 || "--"}
                unit="%"
                highlighted={showResults}
              />
              <VitalSign 
                label="PRESIÓN ARTERIAL"
                value={vitalSigns.pressure}
                unit="mmHg"
                highlighted={showResults}
              />
              <VitalSign 
                label="HEMOGLOBINA"
                value={vitalSigns.hemoglobin || "--"}
                unit="g/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="COLESTEROL/TRIGL."
                value={`${vitalSigns.lipids?.totalCholesterol || "--"}/${vitalSigns.lipids?.triglycerides || "--"}`}
                unit="mg/dL"
                highlighted={showResults}
              />
            </div>
          </div>

          <div className="h-[60px] grid grid-cols-2 gap-0 mt-auto">
            <button 
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              className={`w-full h-full text-xl font-bold text-white transition-colors duration-200 ${
                isMonitoring 
                  ? 'bg-gradient-to-b from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 active:from-red-800 active:to-red-950' 
                  : 'bg-gradient-to-b from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 active:from-green-800 active:to-green-950'
              }`}
            >
              {isMonitoring ? 'DETENER' : 'INICIAR'}
            </button>
            <button 
              onClick={handleReset}
              className="w-full h-full gold-button text-lg font-bold text-white"
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
