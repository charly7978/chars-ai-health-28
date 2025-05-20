
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
          frameRate: { ideal: 30, max: 30 }, // Limitamos explícitamente a 30 FPS
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints
      };

      console.log("Intentando obtener acceso a la cámara con estos constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Acceso a la cámara obtenido exitosamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
            console.log("Modo de exposición continua aplicado");
          }
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
            setDeviceSupportsAutoFocus(true);
            console.log("Modo de enfoque continuo aplicado");
          }
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
            console.log("Modo de balance de blancos continuo aplicado");
          }

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
            console.log("Constraints avanzados aplicados exitosamente");
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
          
          // Activar linterna (flash) inmediatamente si está disponible
          if (capabilities.torch) {
            console.log("Activando linterna para mejorar la señal PPG");
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
            setDeviceSupportsTorch(true);
          } else {
            console.log("Este dispositivo no tiene linterna disponible");
            setDeviceSupportsTorch(false);
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
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
      console.error("Error al iniciar la cámara:", err);
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Gestión mejorada de la linterna basada en detección de dedo
  useEffect(() => {
    if (!stream || !deviceSupportsTorch) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return;
    
    const shouldTorchBeOn = isFingerDetected;
    
    if (shouldTorchBeOn !== torchEnabled) {
      console.log(`${shouldTorchBeOn ? 'Activando' : 'Desactivando'} linterna basado en detección de dedo:`, {
        isFingerDetected,
        torchEnabled,
        signalQuality
      });
      
      videoTrack.applyConstraints({
        advanced: [{ torch: shouldTorchBeOn }]
      }).then(() => {
        setTorchEnabled(shouldTorchBeOn);
      }).catch(err => {
        console.error(`Error ${shouldTorchBeOn ? 'activando' : 'desactivando'} linterna:`, err);
      });
    }
  }, [stream, isFingerDetected, torchEnabled, deviceSupportsTorch]);

  // Intentar enfoque automático periódicamente si el dispositivo lo soporta
  useEffect(() => {
    if (!stream || !isMonitoring || !deviceSupportsAutoFocus) return;
    
    let focusInterval: number;
    
    // Si no hay dedo detectado, intentamos enfocar con más frecuencia
    const focusIntervalTime = isFingerDetected ? 5000 : 2000;
    
    const attemptRefocus = () => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        console.log("Intentando re-enfocar la cámara");
        videoTrack.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        }).catch(err => {
          console.warn("Error al intentar re-enfocar:", err);
        });
      }
    };
    
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
