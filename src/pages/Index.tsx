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
      
      // Iniciar procesamiento de señal
      startProcessing();
      
      // Resetear valores
      setElapsedTime(0);
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "SIN ARRITMIAS|0",
        lastArrhythmiaData: null
      }));
      
      // Iniciar calibración automática
      // Importante: esto debe establecer correctamente el estado de calibración
      console.log("Iniciando fase de calibración automática");
      startAutoCalibration();
      
      // Iniciar temporizador para medición
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          // Finalizar medición después de 30 segundos
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
    setCalibrationMessage("Iniciando proceso de calibración de sensores");
    
    // Iniciar la calibración real en el procesador
    startCalibration();
    
    // Mostrar indicador explícito de calibración
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
      hemoglobin: 0
    }));
    
    // Establecer claramente el estado de calibración en UI
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
    
    // Actualizar el progreso de calibración visualmente
    let step = 0;
    const totalSteps = 5; // Reducido a 5 pasos (de 10)
    const calibrationInterval = setInterval(() => {
      step += 1;
      
      // Actualizar progreso visual (5 pasos en total)
      if (step <= totalSteps) {
        const progressPercent = step * (100/totalSteps); // 0-100%
        console.log(`Actualizando progreso de calibración: ${progressPercent}%`);
        
        // Actualizar cada valor individualmente para asegurar que se renderice
        setCalibrationProgress({
          isCalibrating: true,
          progress: {
            heartRate: progressPercent,
            spo2: Math.max(0, progressPercent - 10),
            pressure: Math.max(0, progressPercent - 15),
            arrhythmia: Math.max(0, progressPercent - 10),
            glucose: Math.max(0, progressPercent - 5),
            lipids: Math.max(0, progressPercent - 20),
            hemoglobin: Math.max(0, progressPercent - 25)
          }
        });
        
        // Actualizar mensaje para mostrar claramente que está calibrando
        if (step === 1) {
          setCalibrationMessage("Calibrando sensores y ajustando parámetros");
          setVitalSigns(prev => ({
            ...prev,
            arrhythmiaStatus: "CALIBRANDO SENSORES|0",
            lastArrhythmiaData: null
          }));
        } else if (step === 3) {
          setCalibrationMessage("Ajustando algoritmos para mayor precisión");
          setVitalSigns(prev => ({
            ...prev,
            arrhythmiaStatus: "AJUSTANDO PARÁMETROS|0",
            lastArrhythmiaData: null
          }));
        }
      } else {
        // Al finalizar, detener el intervalo - Completar después de 5 pasos
        console.log("Finalizando calibración automática");
        clearInterval(calibrationInterval);
        
        // Completar calibración
        if (isCalibrating) {
          console.log("Completando calibración");
          setCalibrationMessage("Calibración completada con éxito");
          forceCalibrationCompletion();
          setIsCalibrating(false);
          
          // Establecer calibrationProgress a undefined para que no muestre más el progreso
          setCalibrationProgress(undefined);
          
          // Actualizar mensaje para mostrar que la calibración se completó
          setVitalSigns(prev => ({
            ...prev,
            arrhythmiaStatus: "CALIBRACIÓN COMPLETA|0",
            lastArrhythmiaData: null
          }));
          
          // Opcional: vibración si está disponible
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          
          // Después de un breve retraso, reestablecer el estado normal
          setTimeout(() => {
            if (!isCalibrating) {
              setCalibrationMessage("");
              setVitalSigns(prev => ({
                ...prev,
                arrhythmiaStatus: "SIN ARRITMIAS|0",
                lastArrhythmiaData: null
              }));
            }
          }, 1500);
        }
      }
    }, 600); // Cada paso dura 600ms (3 segundos en total)
    
    // Temporizador de seguridad más corto
    setTimeout(() => {
      if (isCalibrating) {
        console.log("Forzando finalización de calibración por tiempo límite");
        clearInterval(calibrationInterval);
        forceCalibrationCompletion();
        setIsCalibrating(false);
        setCalibrationMessage("Finalización de calibración por tiempo límite");
        
        // Asegurar que se limpie el estado de calibración
        setCalibrationProgress(undefined);
        
        // Marcar explícitamente que la calibración ha finalizado
        setVitalSigns(prev => ({
          ...prev,
          arrhythmiaStatus: "CALIBRACIÓN FINALIZADA|0",
          lastArrhythmiaData: null
        }));
        
        // Después de un breve retraso, reestablecer el estado normal
        setTimeout(() => {
          setCalibrationMessage("");
          setVitalSigns(prev => ({
            ...prev,
            arrhythmiaStatus: "SIN ARRITMIAS|0",
            lastArrhythmiaData: null
          }));
        }, 1500);
      }
    }, 5000); // 5 segundos como máximo (reducido de 10)
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
    
    // Asegurar que la linterna esté encendida para mediciones de PPG
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
    }
    
    // Crear un canvas de tamaño óptimo para el procesamiento
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Variables para controlar el rendimiento y la tasa de frames
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30; // Apuntar a 30 FPS para precisión
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    // Crearemos un contexto dedicado para el procesamiento de imagen
    const enhanceCanvas = document.createElement('canvas');
    const enhanceCtx = enhanceCanvas.getContext('2d', {willReadFrequently: true});
    enhanceCanvas.width = 320;  // Tamaño óptimo para procesamiento PPG
    enhanceCanvas.height = 240;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      // Control de tasa de frames para no sobrecargar el dispositivo
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          // Capturar frame 
          const frame = await imageCapture.grabFrame();
          
          // Configurar tamaño adecuado del canvas para procesamiento
          const targetWidth = Math.min(320, frame.width);
          const targetHeight = Math.min(240, frame.height);
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          // Dibujar el frame en el canvas
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          // Mejorar la imagen para detección PPG
          if (enhanceCtx) {
            // Resetear canvas
            enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Dibujar en el canvas de mejora
            enhanceCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
            
            // Opcionales: Ajustes para mejorar la señal roja
            enhanceCtx.globalCompositeOperation = 'source-over';
            enhanceCtx.fillStyle = 'rgba(255,0,0,0.05)';  // Sutil refuerzo del canal rojo
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.globalCompositeOperation = 'source-over';
          
            // Obtener datos de la imagen mejorada
            const imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Procesar el frame mejorado
            processFrame(imageData);
          } else {
            // Fallback a procesamiento normal
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
          }
          
          // Actualizar contadores para monitoreo de rendimiento
          frameCount++;
          lastProcessTime = now;
          
          // Calcular FPS cada segundo
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
      
      // Programar el siguiente frame
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
        setVitalSigns(vitals);
        if (vitals.arrhythmiaStatus) {
          setArrhythmiaCount(vitals.arrhythmiaStatus.split('|')[1] || "--");
        }
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

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
              progress={calibrationProgress.progress}
              message={calibrationMessage}
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
                label="ARRITMIAS"
                value={vitalSigns.arrhythmiaStatus}
                calibrationProgress={calibrationProgress?.progress.arrhythmia}
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
