import React, { useRef, useEffect, useState } from 'react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

// Extendemos las interfaces nativas para incluir las capacidades adicionales
interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  brightness?: {min: number; max: number; step: number};
  contrast?: {min: number; max: number; step: number};
  sharpness?: {min: number; max: number; step: number};
  focusDistance?: {min: number; max: number; step: number};
  colorTemperature?: {min: number; max: number; step: number};
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  brightness?: number;
  contrast?: number;
  sharpness?: number;
  focusDistance?: number;
  colorTemperature?: number;
  exposureTime?: number;
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
  const torchRetryCountRef = useRef<number>(0);
  const MAX_TORCH_RETRIES = 3;

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
      torchRetryCountRef.current = 0;
    }
  };

  const enableTorch = async (track: MediaStreamTrack) => {
    if (!track.getCapabilities()?.torch) {
      console.log("Torch not available on this device");
      return false;
    }

    try {
      await track.applyConstraints({
        advanced: [{ torch: true }]
      });
      console.log("Torch enabled successfully");
      setTorchEnabled(true);
      return true;
    } catch (err) {
      console.error("Error enabling torch:", err);
      return false;
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
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          resizeMode: 'crop-and-scale',
          exposureMode: 'manual',
          whiteBalanceMode: 'manual'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities() as ExtendedMediaTrackCapabilities;
          const advancedConstraints: ExtendedMediaTrackConstraintSet[] = [];
          
          // Configuraciones optimizadas para detección de dedo
          if (capabilities.exposureMode) {
            advancedConstraints.push({ 
              exposureMode: 'manual',
              exposureTime: 1000 // 1ms exposure time
            });
          }
          if (capabilities.focusMode && capabilities.focusDistance) {
            advancedConstraints.push({ 
              focusMode: 'manual',
              focusDistance: 0.1 // Enfoque cercano
            });
          }
          if (capabilities.whiteBalanceMode && capabilities.colorTemperature) {
            advancedConstraints.push({ 
              whiteBalanceMode: 'manual',
              colorTemperature: 5500 // Temperatura de color neutra
            });
          }
          if (capabilities.brightness) {
            advancedConstraints.push({ brightness: 100 }); // Máximo brillo
          }
          if (capabilities.contrast) {
            advancedConstraints.push({ contrast: 95 }); // Alto contraste
          }
          if (capabilities.sharpness) {
            advancedConstraints.push({ sharpness: 100 }); // Máxima nitidez
          }

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints as MediaTrackConstraintSet[]
            });
          }

          // Optimizaciones de renderizado
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
            videoRef.current.style.willChange = 'transform';
          }
          
          // Activar linterna con reintentos
          if (capabilities.torch) {
            const enableTorchWithRetry = async () => {
              const success = await enableTorch(videoTrack);
              if (!success && torchRetryCountRef.current < MAX_TORCH_RETRIES) {
                torchRetryCountRef.current++;
                setTimeout(enableTorchWithRetry, 1000);
              }
            };
            enableTorchWithRetry();
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(err => console.error("Error playing video:", err));
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

  // Asegurar que la linterna esté encendida cuando se detecta un dedo
  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        enableTorch(videoTrack);
      }
    }
  }, [stream, isFingerDetected, torchEnabled]);

  // Monitorear la calidad del video
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const checkVideoQuality = () => {
      const video = videoRef.current;
      if (!video) return;

      const { videoWidth, videoHeight, readyState } = video;
      
      // Verificar si el video está funcionando correctamente
      if (readyState < 3 || videoWidth === 0 || videoHeight === 0) {
        console.log("Problemas con el video, reiniciando cámara...");
        stopCamera();
        setTimeout(startCamera, 1000);
      }
    };

    const qualityInterval = setInterval(checkVideoQuality, 5000);
    return () => clearInterval(qualityInterval);
  }, [stream]);

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
