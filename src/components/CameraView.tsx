
import React, { useRef, useEffect, useState } from 'react';
import { toast } from "@/components/ui/use-toast";

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const frameIntervalRef = useRef<number>(1000 / 30); // 30 FPS
  const lastFrameTimeRef = useRef<number>(0);
  const [deviceSupportsAutoFocus, setDeviceSupportsAutoFocus] = useState(false);
  const [deviceSupportsTorch, setDeviceSupportsTorch] = useState(false);
  const torchAttempts = useRef<number>(0);
  const cameraInitialized = useRef<boolean>(false);
  const requestedTorch = useRef<boolean>(false);

  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        // Turn off torch if it's available
        if (track.kind === 'video' && track.getCapabilities()?.torch) {
          track.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => console.error("Error desactivando linterna:", err));
        }
        
        // Stop the track
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
        toast({
          title: "Error",
          description: "Su dispositivo no soporta acceso a la cámara",
          variant: "destructive"
        });
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      // Configuración optimizada para captura PPG - ajustes para mejor detección
      let baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      console.log("CameraView: Configurando cámara para detección de dedo");

      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          // En algunos dispositivos, exposure y white balance pueden causar problemas
          // si se configuran incorrectamente, dejamos que la cámara los ajuste automáticamente
          resizeMode: 'crop-and-scale'
        });
      } else if (isIOS) {
        // Ajustes específicos para iOS
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 30 },
        });
      } else {
        // Para otros dispositivos establecemos parámetros generales
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Intentando obtener acceso a la cámara con constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Acceso a la cámara obtenido exitosamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("CameraView: Capacidades de la cámara:", capabilities);
          
          // Resetear contador de intentos de linterna
          torchAttempts.current = 0;
          requestedTorch.current = false;
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          // Configuración optimizada para captura PPG
          if (capabilities.exposureMode) {
            // Exposición manual para tener mejores resultados con PPG
            advancedConstraints.push({ 
              exposureMode: 'manual'
            });
            console.log("CameraView: Modo de exposición manual aplicado");

            // Solo si tiene controles de exposición, intentamos establecer un valor
            if (capabilities.exposureTime) {
              const minExposure = capabilities.exposureTime.min || 0;
              const maxExposure = capabilities.exposureTime.max || 1000;
              // Usar un valor más alto de exposición para capturar mejor la señal PPG
              const targetExposure = maxExposure * 0.7;
              
              advancedConstraints.push({
                exposureTime: targetExposure
              });
              console.log(`CameraView: Tiempo de exposición ajustado a ${targetExposure}`);
            }
          }
          
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
            setDeviceSupportsAutoFocus(true);
            console.log("CameraView: Modo de enfoque continuo aplicado");
          }
          
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
            console.log("CameraView: Modo de balance de blancos continuo aplicado");
          }

          // Aplicar configuraciones avanzadas
          if (advancedConstraints.length > 0) {
            try {
              await videoTrack.applyConstraints({
                advanced: advancedConstraints
              });
              console.log("CameraView: Constraints avanzados aplicados exitosamente");
            } catch (err) {
              console.error("CameraView: Error aplicando constraints avanzados:", err);
              // Fallback a constraints más simples
              toast({
                title: "Aviso",
                description: "Su cámara no permite ajustes avanzados. La detección podría ser menos precisa.",
                duration: 5000,
              });
            }
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
          
          // Verificar disponibilidad de linterna
          if (capabilities.torch) {
            console.log("CameraView: Este dispositivo tiene linterna disponible");
            setDeviceSupportsTorch(true);
            
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
              requestedTorch.current = true;
              console.log("CameraView: Linterna activada para medición PPG");
            } catch (err) {
              console.error("CameraView: Error activando linterna:", err);
              torchAttempts.current++;
              
              // Mostrar sugerencia al usuario
              toast({
                title: "Importante",
                description: "Coloque su dedo directamente sobre la cámara, cubriendo completamente la lente y la linterna.",
                duration: 5000,
              });
            }
          } else {
            console.log("CameraView: Este dispositivo no tiene linterna disponible");
            setDeviceSupportsTorch(false);
            // Notificar al usuario
            toast({
              title: "Aviso importante",
              description: "Para mejores resultados, utilice una fuente de luz externa dirigida a su dedo mientras lo coloca sobre la cámara.",
              duration: 8000,
            });
          }
        } catch (err) {
          console.log("CameraView: No se pudieron aplicar algunas optimizaciones:", err);
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
        onStreamReady(newStream);
      }
    } catch (err) {
      console.error("CameraView: Error al iniciar la cámara:", err);
      toast({
        title: "Error de cámara",
        description: "No se pudo acceder a la cámara. Por favor verifique los permisos.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Efecto para mantener la linterna encendida durante toda la medición
  useEffect(() => {
    if (!stream || !deviceSupportsTorch || !isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return;
    
    const keepTorchOn = async () => {
      if (isMonitoring && !torchEnabled && deviceSupportsTorch) {
        try {
          console.log("CameraView: Asegurando que la linterna esté encendida");
          await videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
          setTorchEnabled(true);
          requestedTorch.current = true;
        } catch (err) {
          console.error("CameraView: Error al mantener la linterna encendida:", err);
          torchAttempts.current++;
          
          // Si hay demasiados fallos, informamos
          if (torchAttempts.current > 2 && torchAttempts.current % 2 === 0) {
            toast({
              title: "Importante",
              description: "Asegúrese de que su dedo esté cubriendo completamente la cámara para una correcta detección.",
              variant: "default",
            });
          }
        }
      }
    };
    
    // Verificar periódicamente que la linterna permanezca encendida
    const torchCheckInterval = setInterval(keepTorchOn, 2000);
    
    // Activar inmediatamente
    keepTorchOn();
    
    return () => {
      clearInterval(torchCheckInterval);
    };
  }, [stream, isMonitoring, deviceSupportsTorch, torchEnabled]);

  // Enfoque automático optimizado para la detección PPG
  useEffect(() => {
    if (!stream || !isMonitoring || !deviceSupportsAutoFocus) return;
    
    let focusInterval: number;
    
    // Adaptamos la frecuencia de enfoque según si hay dedo o no
    const focusIntervalTime = isFingerDetected ? 4000 : 1500;
    
    const attemptRefocus = () => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        console.log("CameraView: Ajustando enfoque para optimizar detección");
        videoTrack.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        }).catch(err => {
          console.warn("CameraView: Error al intentar re-enfocar:", err);
        });
      }
    };
    
    // Enfocamos inmediatamente cuando cambia el estado del dedo
    attemptRefocus();
    
    focusInterval = window.setInterval(attemptRefocus, focusIntervalTime);
    
    return () => {
      clearInterval(focusInterval);
    };
  }, [stream, isMonitoring, isFingerDetected, deviceSupportsAutoFocus]);
  
  // Agregar instrucciones visuales al usuario
  useEffect(() => {
    if (isMonitoring && !isFingerDetected && !deviceSupportsTorch) {
      // Si no hay linterna y no se detecta dedo, dar instrucciones
      toast({
        title: "Instrucciones",
        description: "Coloque su dedo directamente sobre la cámara trasera, asegurando buena iluminación externa.",
        duration: 5000,
      });
    }
  }, [isMonitoring, isFingerDetected, deviceSupportsTorch]);

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
