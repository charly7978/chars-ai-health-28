
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
  const [permissionDenied, setPermissionDenied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const torchIntervalRef = useRef<number | null>(null);
  const restartAttemptRef = useRef<number>(0);
  const lastTorchToggleRef = useRef<number>(0);
  const cameraStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startCameraTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamOperationInProgressRef = useRef<boolean>(false);

  const stopCamera = useCallback(async () => {
    console.log("Deteniendo cámara...");
    
    // Prevent concurrent operations
    if (streamOperationInProgressRef.current) {
      console.log("Ya hay una operación en progreso, esperando...");
      return;
    }
    
    streamOperationInProgressRef.current = true;
    
    // Clean up any pending timeouts
    if (cameraStopTimeoutRef.current) {
      clearTimeout(cameraStopTimeoutRef.current);
      cameraStopTimeoutRef.current = null;
    }
    
    if (startCameraTimeoutRef.current) {
      clearTimeout(startCameraTimeoutRef.current);
      startCameraTimeoutRef.current = null;
    }
    
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
    
    // Add a delay before allowing new camera operations
    setTimeout(() => {
      streamOperationInProgressRef.current = false;
    }, 500);
  }, [stream, torchEnabled]);

  const startCamera = useCallback(async () => {
    try {
      // Prevent concurrent startCamera calls or overlapping with stop operations
      if (isCameraInitializing || streamOperationInProgressRef.current) {
        console.log("Cámara ya se está inicializando o hay otra operación en progreso, ignorando llamada duplicada");
        return;
      }
      
      setIsCameraInitializing(true);
      streamOperationInProgressRef.current = true;
      setPermissionDenied(false);
      console.log("Iniciando cámara...");
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      // Stop any existing stream first to prevent resource conflicts
      await stopCamera();
      
      // Add a substantial delay after stopping the camera before starting it again
      // This helps prevent the camera from flickering and resource conflicts
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Check for permissions first
      try {
        // Try querying camera status first to detect denied permissions
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log(`Camera permission status: ${permissionStatus.state}`);
        
        if (permissionStatus.state === 'denied') {
          setPermissionDenied(true);
          streamOperationInProgressRef.current = false;
          setIsCameraInitializing(false);
          throw new Error("Permiso de cámara denegado");
        }
      } catch (err) {
        console.log("Permissions API not supported or other error:", err);
        // Continue anyway since this might fail on some browsers
      }
      
      const isAndroid = /android/i.test(navigator.userAgent);
      console.log(`Detected platform: ${isAndroid ? 'Android' : 'Other'}`);

      // Simpler constraints for better compatibility
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      console.log("Requesting camera access with constraints:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted, stream obtained");
      
      const videoTrack = newStream.getVideoTracks()[0];
      
      if (!videoTrack) {
        throw new Error("No se pudo obtener un track de video");
      }
      
      console.log(`Video track obtained: ID: ${videoTrack.id}, label: ${videoTrack.label}`);
      
      // Verify track is in good state before proceeding
      if (videoTrack.readyState !== 'live') {
        console.error("Video track is not in live state", videoTrack.readyState);
        throw new Error("El track de video no está activo");
      }
      
      // Make video element visible
      if (videoRef.current) {
        videoRef.current.style.display = 'block';
      }

      // Setup video playback with the new stream
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Ensure it will autoplay
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        
        // Promise-based playback to handle autoplay issues
        try {
          await videoRef.current.play();
          console.log("Video playback started successfully");
        } catch (e) {
          console.error("Error al reproducir video:", e);
          toast.error("Error al iniciar reproducción de video");
          // Try playing on user interaction
          document.addEventListener('click', function playVideoOnce() {
            if (videoRef.current) {
              videoRef.current.play().catch(e => console.error("Error en reproducción en click:", e));
              document.removeEventListener('click', playVideoOnce);
            }
          });
        }
      }

      setStream(newStream);
      setHasActiveTrack(true);
      restartAttemptRef.current = 0;
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      console.log("Cámara iniciada correctamente");
      
      // Enable the torch after a longer delay to ensure camera is fully initialized
      setTimeout(() => {
        console.log("Attempting to enable torch after camera start");
        if (isMonitoring && isFingerDetected) {
          enableTorch(videoTrack);
        }
      }, 3000); // Increased delay to 3 seconds
      
      // Initialize canvas for frame capture
      if (canvasRef.current) {
        contextRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
      }
      
      startFrameProcessing();
      setIsCameraInitializing(false);
      
      // Add a delay before allowing new camera operations
      setTimeout(() => {
        streamOperationInProgressRef.current = false;
      }, 500);
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      if (err instanceof Error && err.name === 'NotAllowedError') {
        console.log("Camera permission denied by user");
        setPermissionDenied(true);
        toast.error("Permiso de cámara denegado. Por favor, recargue la página y permita el acceso.");
      } else {
        toast.error("Error al iniciar la cámara");
      }
      
      setHasActiveTrack(false);
      setIsCameraInitializing(false);
      streamOperationInProgressRef.current = false;
      restartAttemptRef.current++;
      
      // If we've tried restarting a few times without success, wait longer
      const restartDelay = restartAttemptRef.current > 3 ? 3000 : 1500;
      
      // Try again after a delay (but not if permission denied)
      if (!permissionDenied && isMonitoring) {
        // Use a ref to track the timeout so we can clear it if needed
        startCameraTimeoutRef.current = setTimeout(() => {
          if (isMonitoring) {
            console.log(`Retry ${restartAttemptRef.current}: Restarting camera after failure...`);
            startCamera();
          }
          startCameraTimeoutRef.current = null;
        }, restartDelay);
      }
    }
  }, [stopCamera, onStreamReady, isMonitoring, permissionDenied, isFingerDetected, enableTorch]);

  const enableTorch = useCallback((videoTrack?: MediaStreamTrack) => {
    const now = Date.now();
    // Prevent torch toggling too frequently
    if (now - lastTorchToggleRef.current < 2000) {
      console.log("Skipping torch toggle - too soon since last toggle");
      return;
    }
    
    lastTorchToggleRef.current = now;
    
    const track = videoTrack || (stream?.getVideoTracks()[0]);
    
    if (!track) {
      console.log("No video track available to enable torch");
      return;
    }
    
    try {
      // Verify track is active and ready
      if (track.readyState !== 'live') {
        console.log("Track not in live state, can't enable torch");
        return;
      }
      
      const capabilities = track.getCapabilities();
      console.log("Track capabilities:", capabilities);
      
      if (capabilities?.torch) {
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
    } catch (err) {
      console.error("Error trying to enable torch:", err);
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
    // Only run this effect if we're monitoring and have a finger detected
    if (isMonitoring && isFingerDetected && stream) {
      // Clear any existing interval
      if (torchIntervalRef.current) {
        clearInterval(torchIntervalRef.current);
      }
      
      // Check torch status and try to enable if needed
      if (!torchEnabled) {
        console.log("Finger detected but torch not enabled, attempting to enable");
        enableTorch();
      }
      
      // Set up interval to periodically check torch status
      torchIntervalRef.current = window.setInterval(() => {
        // Check track is still valid
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === 'live') {
          // Only try to enable torch if it's not already enabled
          if (!torchEnabled) {
            console.log("Torch check: re-enabling torch");
            enableTorch(videoTrack);
          }
        } else {
          console.log("Track not live during torch check, may need restart");
          setHasActiveTrack(false);
        }
      }, 3000);
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
            if (isMonitoring && !streamOperationInProgressRef.current) {
              startCamera();
            }
          }, 1000);
        }
      }
    };
    
    const trackCheckInterval = setInterval(checkTrackStatus, 3000);
    
    return () => {
      clearInterval(trackCheckInterval);
    };
  }, [stream, hasActiveTrack, isMonitoring, startCamera]);

  // Main effect for starting and stopping the camera
  useEffect(() => {
    console.log("CameraView effect - isMonitoring:", isMonitoring, "stream:", !!stream, "hasActiveTrack:", hasActiveTrack);
    
    // Clear any pending timeouts to prevent race conditions
    if (cameraStopTimeoutRef.current) {
      clearTimeout(cameraStopTimeoutRef.current);
      cameraStopTimeoutRef.current = null;
    }
    
    if (startCameraTimeoutRef.current) {
      clearTimeout(startCameraTimeoutRef.current);
      startCameraTimeoutRef.current = null;
    }
    
    // Add proper cleanup logic when component unmounts or when monitoring status changes
    if (isMonitoring && (!stream || !hasActiveTrack) && !isCameraInitializing && !streamOperationInProgressRef.current) {
      console.log("Starting camera because monitoring is enabled and no active stream");
      // Add a small delay before starting camera to prevent rapid cycling
      startCameraTimeoutRef.current = setTimeout(() => {
        startCamera();
        startCameraTimeoutRef.current = null;
      }, 300);
    } else if (!isMonitoring && stream) {
      console.log("Scheduling camera stop because monitoring is disabled");
      
      // Use a timeout to prevent rapid start/stop cycles that can cause flickering
      cameraStopTimeoutRef.current = setTimeout(() => {
        console.log("Executing delayed camera stop");
        stopCamera();
        cameraStopTimeoutRef.current = null;
      }, 500); // Longer delay to prevent rapid cycling
    }
    
    return () => {
      console.log("Componente CameraView desmontándose");
      if (cameraStopTimeoutRef.current) {
        clearTimeout(cameraStopTimeoutRef.current);
      }
      if (startCameraTimeoutRef.current) {
        clearTimeout(startCameraTimeoutRef.current);
      }
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
      {isMonitoring && (isCameraInitializing || !hasActiveTrack) && !permissionDenied && (
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
      {permissionDenied && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white p-4 z-10">
          <div className="text-center">
            <p className="text-xl mb-3">
              Acceso a la cámara denegado
            </p>
            <p className="mb-4">
              Esta aplicación necesita acceso a la cámara para funcionar.
            </p>
            <p className="text-sm opacity-75 mb-4">
              Por favor, recargue la página y permita el acceso cuando se le solicite.
            </p>
            <button 
              onClick={() => {
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 rounded-md font-medium"
            >
              Recargar página
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CameraView;
