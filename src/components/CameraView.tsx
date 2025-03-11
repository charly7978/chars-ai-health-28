
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
  const animationFrameIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const stopCamera = async () => {
    console.log("Deteniendo cámara...");
    if (stream) {
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
      console.log("Cámara detenida correctamente");
    }

    // Clean up animation frame
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      console.log("Iniciando cámara...");
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

      // Stop any existing stream first
      await stopCamera();

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack && isAndroid) {
        try {
          const capabilities = videoTrack.getCapabilities();
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
          }
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          }

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
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
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => {
              console.error("Error al reproducir video:", e);
            });
          }
        };
        
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      console.log("Cámara iniciada correctamente");
      
      // Initialize canvas for frame capture
      if (canvasRef.current) {
        contextRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
      }
      
      startFrameProcessing();
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    }
  };
  
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !contextRef.current || !stream || !onStreamReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    
    // Only process if video is playing
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const videoTrack = stream.getVideoTracks()[0];
      const { width, height } = videoTrack.getSettings();
      
      if (width && height) {
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Create a fake ImageCapture result to match what our processor expects
          const frame = {
            data: imageData.data,
            width: imageData.width,
            height: imageData.height
          };
          
          // Push the frame data to any external processor
          if (isMonitoring) {
            // Processing happens in parent component
          }
        } catch (err) {
          console.error("Error capturando frame:", err);
        }
      }
    }
  };
  
  const startFrameProcessing = () => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    
    const processFrame = () => {
      if (!isMonitoring) {
        animationFrameIdRef.current = null;
        return;
      }
      
      captureFrame();
      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    };
    
    animationFrameIdRef.current = requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    console.log("CameraView rendering - isMonitoring:", isMonitoring, "stream:", !!stream, "onFrame:", !!onStreamReady);
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("Componente CameraView desmontándose");
      stopCamera();
    };
  }, [isMonitoring, onStreamReady]);

  // Asegurar que la linterna esté encendida cuando se detecta un dedo
  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("Error activando linterna:", err);
        });
      }
    }
  }, [stream, isFingerDetected, torchEnabled]);

  return (
    <>
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
      <canvas 
        ref={canvasRef} 
        className="hidden" // Keep canvas hidden but functional
        width="320" 
        height="240"
      />
    </>
  );
};

export default CameraView;
