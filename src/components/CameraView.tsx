
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
  const [hasActiveTrack, setHasActiveTrack] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const stopCamera = async () => {
    console.log("Deteniendo cámara...");
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          // Turn off torch if it's available
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
          // Stop the track
          track.stop();
        } catch (e) {
          console.error("Error stopping track:", e);
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      setHasActiveTrack(false);
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
      setHasActiveTrack(true);
      
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
      setHasActiveTrack(false);
    }
  };
  
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !contextRef.current || !stream) return;
    
    try {
      // Check if the video track is still active
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.readyState || videoTrack.readyState !== 'live') {
        console.log("Video track not active, restarting camera");
        startCamera();
        return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      
      // Only process if video is playing and has data
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
      
      const { width, height } = videoTrack.getSettings();
      
      if (!width || !height) return;
      
      // Set canvas dimensions to match video
      canvas.width = width;
      canvas.height = height;
      
      // Draw the current video frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Only send the frame data to external processor if monitoring
        if (isMonitoring && onStreamReady && hasActiveTrack) {
          // Processing happens in parent component
          // We've already sent the stream to the parent via onStreamReady
        }
      } catch (err) {
        console.error("Error capturando frame:", err);
      }
    } catch (error) {
      console.error("Error en captureFrame:", error);
    }
  };
  
  const startFrameProcessing = () => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    
    const processFrame = () => {
      if (!isMonitoring || !hasActiveTrack) {
        animationFrameIdRef.current = null;
        return;
      }
      
      captureFrame();
      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    };
    
    animationFrameIdRef.current = requestAnimationFrame(processFrame);
  };

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

  // Check if track is still valid and restart if needed
  useEffect(() => {
    const checkTrackStatus = () => {
      if (stream && hasActiveTrack) {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== 'live') {
          console.log("Video track no longer active, restarting camera");
          setHasActiveTrack(false);
          startCamera();
        }
      }
    };
    
    const trackCheckInterval = setInterval(checkTrackStatus, 2000);
    
    return () => {
      clearInterval(trackCheckInterval);
    };
  }, [stream, hasActiveTrack]);

  // Main effect for controlling camera based on isMonitoring
  useEffect(() => {
    console.log("CameraView rendering - isMonitoring:", isMonitoring, "stream:", !!stream, "onFrame:", !!onStreamReady);
    if (isMonitoring && (!stream || !hasActiveTrack)) {
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
  }, [isMonitoring, onStreamReady, hasActiveTrack]);

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
      {isMonitoring && !hasActiveTrack && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white p-4 z-10">
          <p className="text-center">
            Iniciando cámara...
            <br/>
            Por favor permita el acceso a la cámara si se le solicita.
          </p>
        </div>
      )}
    </>
  );
};

export default CameraView;
