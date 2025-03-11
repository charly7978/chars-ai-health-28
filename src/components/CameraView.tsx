
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

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
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const torchIntervalRef = useRef<number | null>(null);
  const restartAttemptRef = useRef<number>(0);
  const lastTorchToggleRef = useRef<number>(0);

  const stopCamera = useCallback(async () => {
    console.log("Deteniendo cámara...");
    
    // Clear any pending torch toggle interval
    if (torchIntervalRef.current) {
      clearInterval(torchIntervalRef.current);
      torchIntervalRef.current = null;
    }
    
    // Clean up animation frame
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    
    if (stream) {
      const tracks = stream.getTracks();
      console.log(`Stopping ${tracks.length} track(s)`);
      
      tracks.forEach(track => {
        try {
          // Turn off torch if it's available and enabled
          if (track.kind === 'video' && track.getCapabilities()?.torch && torchEnabled) {
            console.log("Disabling torch before stopping track");
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error disabling torch:", err));
            setTorchEnabled(false);
          }
          
          console.log(`Stopping track: ${track.kind}, ID: ${track.id}, active: ${track.readyState}`);
          track.stop();
        } catch (e) {
          console.error("Error stopping track:", e);
        }
      });
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setHasActiveTrack(false);
      console.log("Cámara detenida correctamente");
    } else {
      console.log("No hay stream para detener");
    }
  }, [stream, torchEnabled]);

  const startCamera = useCallback(async () => {
    try {
      setIsCameraInitializing(true);
      console.log("Iniciando cámara...");
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      // Stop any existing stream first to prevent resource conflicts
      await stopCamera();
      
      const isAndroid = /android/i.test(navigator.userAgent);
      console.log(`Detected platform: ${isAndroid ? 'Android' : 'Other'}`);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 480 }
      };

      if (isAndroid) {
        // Optimizations for Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints
      };

      console.log("Requesting camera access with constraints:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted, stream obtained");
      
      const videoTrack = newStream.getVideoTracks()[0];
      
      if (!videoTrack) {
        throw new Error("No se pudo obtener un track de video");
      }
      
      console.log(`Video track obtained: ID: ${videoTrack.id}, label: ${videoTrack.label}`);
      console.log(`Track capabilities:`, videoTrack.getCapabilities());

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
            console.log("Applying advanced camera constraints:", JSON.stringify(advancedConstraints));
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }
          
          // Apply hardware acceleration hints to video element
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      // Setup video playback with the new stream
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Promise-based playback to handle autoplay issues
        videoRef.current.play().then(() => {
          console.log("Video playback started successfully");
        }).catch(e => {
          console.error("Error al reproducir video:", e);
          toast.error("Error al iniciar reproducción de video");
        });
        
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      setHasActiveTrack(true);
      restartAttemptRef.current = 0;
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      console.log("Cámara iniciada correctamente");
      
      // Enable the torch after a delay to ensure camera is ready
      setTimeout(() => {
        enableTorch(videoTrack);
      }, 500);
      
      // Initialize canvas for frame capture
      if (canvasRef.current) {
        contextRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
      }
      
      startFrameProcessing();
      setIsCameraInitializing(false);
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      toast.error("Error al iniciar la cámara");
      setHasActiveTrack(false);
      setIsCameraInitializing(false);
      restartAttemptRef.current++;
      
      // If we've tried restarting a few times without success, wait longer
      const restartDelay = restartAttemptRef.current > 3 ? 3000 : 1000;
      
      // Try again after a delay
      setTimeout(() => {
        if (isMonitoring) {
          console.log(`Retry ${restartAttemptRef.current}: Restarting camera after failure...`);
          startCamera();
        }
      }, restartDelay);
    }
  }, [stopCamera, onStreamReady, isMonitoring]);

  const enableTorch = useCallback((videoTrack?: MediaStreamTrack) => {
    const now = Date.now();
    // Prevent torch toggling too frequently
    if (now - lastTorchToggleRef.current < 2000) {
      console.log("Skipping torch toggle - too soon since last toggle");
      return;
    }
    
    lastTorchToggleRef.current = now;
    
    const track = videoTrack || (stream?.getVideoTracks()[0]);
    
    if (track && track.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      track.applyConstraints({
        advanced: [{ torch: true }]
      }).then(() => {
        setTorchEnabled(true);
        console.log("Torch enabled successfully");
      }).catch(err => {
        console.error("Error activando linterna:", err);
        setTorchEnabled(false);
      });
    } else {
      console.log("La linterna no está disponible en este dispositivo");
    }
  }, [stream]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !contextRef.current || !stream) return;
    
    try {
      // Check if the video track is still active
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        console.log("Video track not active, skipping frame capture");
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
        if (isMonitoring && hasActiveTrack) {
          // Processing happens in parent component via stream
        }
      } catch (err) {
        console.error("Error capturando frame:", err);
      }
    } catch (error) {
      console.error("Error en captureFrame:", error);
    }
  }, [stream, isMonitoring, hasActiveTrack]);
  
  const startFrameProcessing = useCallback(() => {
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
  }, [isMonitoring, hasActiveTrack, captureFrame]);

  // Implement safeguard to ensure torch stays on when needed
  useEffect(() => {
    // If monitoring with a finger detected, ensure torch is on
    if (isMonitoring && isFingerDetected && stream) {
      // Clear any existing interval
      if (torchIntervalRef.current) {
        clearInterval(torchIntervalRef.current);
      }
      
      // Check and re-enable torch every 3 seconds if needed
      torchIntervalRef.current = window.setInterval(() => {
        if (!torchEnabled && stream) {
          console.log("Torch check: re-enabling torch");
          enableTorch();
        }
      }, 3000);
      
      // Immediate check
      if (!torchEnabled) {
        enableTorch();
      }
    }
    
    return () => {
      if (torchIntervalRef.current) {
        clearInterval(torchIntervalRef.current);
        torchIntervalRef.current = null;
      }
    };
  }, [isMonitoring, isFingerDetected, stream, torchEnabled, enableTorch]);

  // Check if track is still valid and restart if needed
  useEffect(() => {
    const checkTrackStatus = () => {
      if (stream && hasActiveTrack) {
        const videoTrack = stream.getVideoTracks()[0];
        
        if (!videoTrack || videoTrack.readyState !== 'live') {
          console.log("Video track no longer active, restarting camera");
          setHasActiveTrack(false);
          // Add small delay before restart to allow resources to be freed
          setTimeout(() => {
            if (isMonitoring) {
              startCamera();
            }
          }, 500);
        }
      }
    };
    
    const trackCheckInterval = setInterval(checkTrackStatus, 2000);
    
    return () => {
      clearInterval(trackCheckInterval);
    };
  }, [stream, hasActiveTrack, isMonitoring, startCamera]);

  // Main effect for starting and stopping the camera
  useEffect(() => {
    console.log("CameraView effect - isMonitoring:", isMonitoring, "stream:", !!stream, "hasActiveTrack:", hasActiveTrack);
    
    if (isMonitoring && (!stream || !hasActiveTrack) && !isCameraInitializing) {
      console.log("Starting camera because monitoring is enabled and no active stream");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because monitoring is disabled");
      stopCamera();
    }
    
    return () => {
      console.log("Componente CameraView desmontándose");
      stopCamera();
    };
  }, [isMonitoring, stream, hasActiveTrack, isCameraInitializing, startCamera, stopCamera]);

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
      {isMonitoring && (isCameraInitializing || !hasActiveTrack) && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white p-4 z-10">
          <div className="text-center">
            <p className="mb-2">
              Iniciando cámara...
            </p>
            <p className="text-sm opacity-75">
              Por favor permita el acceso a la cámara si se le solicita.
            </p>
            <div className="mt-4 h-1 w-48 mx-auto bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse rounded-full w-1/3"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CameraView;
