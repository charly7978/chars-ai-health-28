import React, { useRef, useEffect, useState } from 'react';
import { toast } from "@/components/ui/use-toast";
import { AdvancedVitalSignsProcessor, PPGAnalysisUtils } from '../modules/vital-signs/VitalSignsProcessor';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

interface PPGSignal {
  red: number[];
  green: number[];
  ir: number[];
  timestamp: number;
}

const usePerformanceThrottling = () => {
  const [frameInterval, setFrameInterval] = useState(0);
  const frameTimes = useRef<number[]>([]);

  useEffect(() => {
    const adjustFrameRate = () => {
      if (frameTimes.current.length > 10) {
        const avgTime = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
        // Ajustar intervalo basado en performance
        setFrameInterval(avgTime > 50 ? 100 : avgTime > 30 ? 50 : 0);
        frameTimes.current = [];
      }
    };
    
    const timer = setInterval(adjustFrameRate, 2000);
    return () => clearInterval(timer);
  }, []);

  return frameInterval;
};

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const vitalProcessor = useRef(new AdvancedVitalSignsProcessor());
  const [torchEnabled, setTorchEnabled] = useState(false);
  const frameIntervalRef = useRef<number>(1000 / 30); // 30 FPS
  const lastFrameTimeRef = useRef<number>(0);
  const [deviceSupportsAutoFocus, setDeviceSupportsAutoFocus] = useState(false);
  const [deviceSupportsTorch, setDeviceSupportsTorch] = useState(false);
  const torchAttempts = useRef<number>(0);
  const cameraInitialized = useRef<boolean>(false);
  const requestedTorch = useRef<boolean>(false);
  const frameInterval = usePerformanceThrottling();
  const workerRef = useRef<Worker>();

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/ppgProcessor.worker.ts', import.meta.url));
    workerRef.current.onmessage = (e) => {
      vitalProcessor.current.processSignal(e.data);
    };
    
    return () => workerRef.current?.terminate();
  }, []);

  const stopCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        if (track.kind === 'video' && track.getCapabilities()?.torch) {
          track.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => {
            if (process.env.NODE_ENV !== 'production') {
              console.error("Error desactivando linterna:", err);
            }
          });
        }
        
        track.stop();
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      cameraInitialized.current = false;
      requestedTorch.current = false;
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Su dispositivo no soporta acceso a la cámara");
        }
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      const getOptimizedConstraints = () => {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        return {
          video: {
            width: isMobile ? 640 : 1280,
            height: isMobile ? 480 : 720,
            frameRate: isMobile ? 30 : 60,
            facingMode: 'environment'
          }
        };
      };

      const constraints: MediaStreamConstraints = getOptimizedConstraints();

      if (process.env.NODE_ENV !== 'production') {
        console.log("CameraView: Intentando obtener acceso a la cámara con constraints:", constraints);
      }
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (process.env.NODE_ENV !== 'production') {
        console.log("CameraView: Acceso a la cámara obtenido exitosamente");
      }
      
      if (!onStreamReady) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("CameraView: onStreamReady callback no disponible");
        }
        toast({
          title: "Error de cámara",
          description: "No hay callback para procesar el video",
          variant: "destructive"
        });
      }
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          if (process.env.NODE_ENV !== 'production') {
            console.log("CameraView: Capacidades de la cámara:", capabilities);
          }
          
          torchAttempts.current = 0;
          requestedTorch.current = false;
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ 
              exposureMode: 'manual'
            });
            if (process.env.NODE_ENV !== 'production') {
              console.log("CameraView: Modo de exposición manual aplicado");
            }

            if (capabilities.exposureTime) {
              const minExposure = capabilities.exposureTime.min || 0;
              const maxExposure = capabilities.exposureTime.max || 1000;
              const targetExposure = maxExposure * 0.8;
              
              advancedConstraints.push({
                exposureTime: targetExposure
              });
              if (process.env.NODE_ENV !== 'production') {
                console.log(`CameraView: Tiempo de exposición ajustado a ${targetExposure}`);
              }
            }
          }
          
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
            setDeviceSupportsAutoFocus(true);
            if (process.env.NODE_ENV !== 'production') {
              console.log("CameraView: Modo de enfoque continuo aplicado");
            }
          }
          
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
            if (process.env.NODE_ENV !== 'production') {
              console.log("CameraView: Modo de balance de blancos continuo aplicado");
            }
          }

          if (advancedConstraints.length > 0) {
            try {
              await videoTrack.applyConstraints({
                advanced: advancedConstraints
              });
              if (process.env.NODE_ENV !== 'production') {
                console.log("CameraView: Constraints avanzados aplicados exitosamente");
              }
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.error("CameraView: Error aplicando constraints avanzados:", err);
              }
            }
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
          
          if (capabilities.torch) {
            if (process.env.NODE_ENV !== 'production') {
              console.log("CameraView: Este dispositivo tiene linterna disponible");
            }
            setDeviceSupportsTorch(true);
            
            try {
              await handleTorch(true);
              if (process.env.NODE_ENV !== 'production') {
                console.log("CameraView: Linterna activada para medición PPG");
              }
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.error("CameraView: Error activando linterna:", err);
              }
              torchAttempts.current++;
              
              setTimeout(async () => {
                try {
                  await handleTorch(true);
                  if (process.env.NODE_ENV !== 'production') {
                    console.log("CameraView: Linterna activada en segundo intento");
                  }
                } catch (err) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.error("CameraView: Error en segundo intento de linterna:", err);
                  }
                }
              }, 1000);
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log("CameraView: Este dispositivo no tiene linterna disponible");
            }
            setDeviceSupportsTorch(false);
          }
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.log("CameraView: No se pudieron aplicar algunas optimizaciones:", err);
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      cameraInitialized.current = true;
      
      if (onStreamReady) {
        if (process.env.NODE_ENV !== 'production') {
          console.log("CameraView: Llamando onStreamReady con stream:", {
            hasVideoTracks: newStream.getVideoTracks().length > 0,
            streamActive: newStream.active,
            timestamp: new Date().toISOString()
          });
        }
        onStreamReady(newStream);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("CameraView: Error al iniciar la cámara:", err);
      }
    }
  };

  const handleTorch = async (enable: boolean) => {
    if (!deviceSupportsTorch) return;
    
    try {
      await stream?.getVideoTracks()[0].applyConstraints({
        advanced: [{ torch: enable }]
      });
      setTorchEnabled(enable);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error al manejar linterna:", err);
      }
    }
  };

  const handleAutoFocus = async () => {
    if (!deviceSupportsAutoFocus) return;
    
    try {
      await stream?.getVideoTracks()[0].applyConstraints({
        advanced: [{ focusMode: 'continuous' }]
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("Error al ajustar enfoque:", err);
      }
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("[DIAG] CameraView: Iniciando cámara porque isMonitoring=true");
      }
      startCamera();
    } else if (!isMonitoring && stream) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("[DIAG] CameraView: Deteniendo cámara porque isMonitoring=false");
      }
      stopCamera();
    }
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log("[DIAG] CameraView: Desmontando componente, deteniendo cámara");
      }
      stopCamera();
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (!stream || !deviceSupportsTorch || !isMonitoring) return;
    
    const keepTorchOn = async () => {
      if (!isMonitoring || !deviceSupportsTorch) return;

      const torchIsReallyOn = stream.getVideoTracks()[0].getSettings && (stream.getVideoTracks()[0].getSettings() as any).torch === true;

      if (!torchIsReallyOn) {
        try {
          await handleTorch(true);
          if (process.env.NODE_ENV !== 'production') {
            console.log("CameraView: Re-activando linterna (torch)");
          }
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("CameraView: Error re-encendiendo linterna:", err);
          }
          torchAttempts.current++;
          setTorchEnabled(false);
        }
      } else {
        if (!torchEnabled) {
          setTorchEnabled(true);
        }
      }
    };
    
    const torchCheckInterval = setInterval(keepTorchOn, 2000);
    
    keepTorchOn();
    
    return () => {
      clearInterval(torchCheckInterval);
    };
  }, [stream, isMonitoring, deviceSupportsTorch, torchEnabled]);

  useEffect(() => {
    if (!stream || !isMonitoring || !deviceSupportsAutoFocus) return;
    
    let focusInterval: number;
    
    const focusIntervalTime = isFingerDetected ? 4000 : 1500;
    
    const attemptRefocus = async () => {
      await handleAutoFocus();
    };
    
    attemptRefocus();
    
    focusInterval = window.setInterval(attemptRefocus, focusIntervalTime);
    
    return () => {
      clearInterval(focusInterval);
    };
  }, [stream, isMonitoring, isFingerDetected, deviceSupportsAutoFocus]);

  useEffect(() => {
    if (!stream || !isMonitoring) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = videoRef.current?.videoWidth || 0;
    canvas.height = videoRef.current?.videoHeight || 0;
    
    ctx?.drawImage(videoRef.current, 0, 0);
    const frameData = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
    
    if (frameData) {
      workerRef.current?.postMessage({
        frameData,
        width: canvas.width,
        height: canvas.height
      }, [frameData.buffer]);
    }
  }, [stream, isMonitoring, frameInterval]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    />
  );
};

export default CameraView;
