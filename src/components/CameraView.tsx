
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const MAX_RETRY_ATTEMPTS = 3;

  const stopCamera = async () => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }

    if (stream) {
      console.log("Stopping camera stream and turning off torch");
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
        } catch (err) {
          console.error("Error stopping track:", err);
        }
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
      if (cameraError) {
        setCameraError(null);
      }

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

      // First make sure any previous stream is fully stopped
      await stopCamera();

      console.log("Requesting camera access...");
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted");
      
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
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      setRetryCount(0); // Reset retry count on success
      
      if (onStreamReady) {
        const cleanup = onStreamReady(newStream);
        streamCleanupRef.current = cleanup || null;
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      setCameraError(`Error accessing camera: ${err.message || 'Unknown error'}`);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < MAX_RETRY_ATTEMPTS && isMonitoring) {
        const timeout = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying camera access in ${timeout}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        setTimeout(() => {
          if (isMonitoring) {
            setRetryCount(prev => prev + 1);
            startCamera();
          }
        }, timeout);
      }
    }
  };

  // Camera lifecycle management
  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    // Add a watchdog timer to detect stalled camera state
    let watchdogTimer: number | null = null;
    
    if (isMonitoring && stream) {
      watchdogTimer = window.setInterval(() => {
        // Check if tracks are still active
        const allTracksActive = stream.getTracks().every(
          track => track.readyState === 'live'
        );
        
        if (!allTracksActive) {
          console.error("Camera watchdog detected inactive tracks, restarting camera");
          stopCamera();
          startCamera();
        }
      }, 5000); // Check every 5 seconds
    }
    
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
      
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
      }
    };
  }, [isMonitoring, stream]);

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
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 p-4">
          <div className="bg-red-900/50 backdrop-blur-md p-4 rounded-md text-white max-w-xs text-center">
            <p className="text-sm font-medium mb-2">Error de cámara</p>
            <p className="text-xs">{cameraError}</p>
            <button 
              onClick={() => {
                setCameraError(null);
                setRetryCount(0);
                startCamera();
              }}
              className="mt-3 bg-red-700 text-white text-xs px-3 py-1 rounded-md"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CameraView;
