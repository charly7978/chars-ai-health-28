
import React, { useRef, useEffect, useState } from 'react';

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
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 480 }
      };

      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints
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
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ 
              exposureMode: 'continuous'
              // Eliminamos exposureTime ya que no es compatible con la definición de tipos
            });
            console.log("CameraView: Modo de exposición continua aplicado");
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

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
            console.log("CameraView: Constraints avanzados aplicados exitosamente");
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
          
          // Linterna activada en base a disponibilidad
          if (capabilities.torch) {
            console.log("CameraView: Este dispositivo tiene linterna disponible");
            setDeviceSupportsTorch(true);
            
            // Activamos la linterna inmediatamente al iniciar la medición
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
              console.log("CameraView: Linterna activada inmediatamente al iniciar la medición");
            } catch (err) {
              console.error("CameraView: Error activando linterna:", err);
              torchAttempts.current++;
            }
          } else {
            console.log("CameraView: Este dispositivo no tiene linterna disponible");
            setDeviceSupportsTorch(false);
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
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
    } catch (err) {
      console.error("CameraView: Error al iniciar la cámara:", err);
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

  // Efecto para asegurar que la linterna permanezca encendida durante toda la medición
  useEffect(() => {
    if (!stream || !deviceSupportsTorch || !isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return;
    
    const keepTorchOn = async () => {
      if (!torchEnabled) {
        try {
          console.log("CameraView: Manteniendo linterna encendida durante la medición");
          await videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
          setTorchEnabled(true);
        } catch (err) {
          console.error("CameraView: Error al mantener la linterna encendida:", err);
          torchAttempts.current++;
          
          // Si hay demasiados fallos, informamos
          if (torchAttempts.current > 3) {
            console.warn("CameraView: Múltiples fallas al activar linterna, posible problema de hardware");
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
        console.log("CameraView: Intentando re-enfocar la cámara");
        videoTrack.applyConstraints({
          advanced: [{ 
            focusMode: 'continuous'
            // Eliminamos focusDistance ya que no es compatible con la definición de tipos
          }]
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

  // Cambiar la tasa de cuadros a, por ejemplo, 12 FPS:
  const targetFrameInterval = 1000/12; // Apunta a 12 FPS para menor consumo

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
