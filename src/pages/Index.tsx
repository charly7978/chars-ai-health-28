
import React, { useEffect, useCallback, useState, useRef } from "react";
import VitalSignsPanel from "@/components/VitalSignsPanel";
import CameraView from "@/components/CameraView";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import TimerDisplay from "@/components/TimerDisplay";
import ControlButtons from "@/components/ControlButtons";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { toast } from "sonner";

const Index = () => {
  // Basic monitoring state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  
  // Vital signs state
  const [vitalSigns, setVitalSigns] = useState({ 
    spo2: 0, 
    pressure: "--/--",
    arrhythmiaStatus: "--" 
  });
  const [heartRate, setHeartRate] = useState(0);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState(null);
  
  // References
  const measurementTimerRef = useRef(null);
  const streamRef = useRef(null);
  const imageCaptureRef = useRef(null);
  const isProcessingFrameRef = useRef(false);
  const tempCanvasRef = useRef(null);
  const tempCtxRef = useRef(null);
  
  // Signal processing hooks
  const { 
    startProcessing, 
    stopProcessing, 
    lastSignal, 
    processFrame 
  } = useSignalProcessor();
  
  const { processSignal: processVitalSigns, reset: resetVitalSigns } = useVitalSignsProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();

  // Prevent page scrolling
  useEffect(() => {
    const preventScroll = (e) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);
  
  // Create canvas elements for processing
  useEffect(() => {
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
      tempCtxRef.current = tempCanvasRef.current.getContext('2d', { willReadFrequently: true });
    }
    
    return () => {
      tempCanvasRef.current = null;
      tempCtxRef.current = null;
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      stopCamera();
      stopProcessing();
    };
  }, [stopProcessing]);

  // Process signals and update vital signs
  useEffect(() => {
    if (!lastSignal || !lastSignal.fingerDetected || !isMonitoring) {
      return;
    }
    
    try {
      // Process heart beat
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      if (heartBeatResult && heartBeatResult.bpm) {
        setHeartRate(heartBeatResult.bpm);
        
        // Process vital signs
        const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
        if (vitals) {
          setVitalSigns(vitals);
          
          // Save arrhythmia data for visualization
          if (vitals.lastArrhythmiaData) {
            setLastArrhythmiaData(vitals.lastArrhythmiaData);
          }
        }
      }
      
      setSignalQuality(lastSignal.quality);
    } catch (error) {
      console.error("Error processing signal:", error);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  // Process frames when camera is on
  const processVideoFrames = useCallback(() => {
    if (!isMonitoring || !streamRef.current || !imageCaptureRef.current) {
      return;
    }
    
    if (isProcessingFrameRef.current) {
      requestAnimationFrame(processVideoFrames);
      return;
    }
    
    isProcessingFrameRef.current = true;
    
    try {
      imageCaptureRef.current.grabFrame()
        .then(frame => {
          if (!tempCanvasRef.current || !tempCtxRef.current) return;
          
          tempCanvasRef.current.width = frame.width;
          tempCanvasRef.current.height = frame.height;
          tempCtxRef.current.drawImage(frame, 0, 0);
          
          const imageData = tempCtxRef.current.getImageData(
            0, 0, frame.width, frame.height
          );
          
          processFrame(imageData);
        })
        .catch(err => {
          console.error("Error capturing frame:", err);
        })
        .finally(() => {
          isProcessingFrameRef.current = false;
          if (isMonitoring) {
            requestAnimationFrame(processVideoFrames);
          }
        });
    } catch (error) {
      console.error("Error in processVideoFrames:", error);
      isProcessingFrameRef.current = false;
      if (isMonitoring) {
        requestAnimationFrame(processVideoFrames);
      }
    }
  }, [isMonitoring, processFrame]);

  // Handle timer updates
  useEffect(() => {
    if (isMonitoring) {
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          if (prev >= 30) {
            handleReset();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
        measurementTimerRef.current = null;
      }
    }
    
    return () => {
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
    };
  }, [isMonitoring]);

  // Handle Camera Setup
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        stopCamera();
      }
      
      console.log("Starting camera...");
      const isAndroid = /android/i.test(navigator.userAgent);
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 720 },
          height: { ideal: 480 },
          ...(isAndroid && {
            frameRate: { ideal: 30, max: 30 },
            resizeMode: 'crop-and-scale'
          })
        }
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera stream acquired successfully");
      
      streamRef.current = newStream;
      setIsCameraOn(true);
      setCameraError(false);
      
      const videoTrack = newStream.getVideoTracks()[0];
      
      if (videoTrack) {
        // Try to optimize camera settings
        if (isAndroid) {
          try {
            const capabilities = videoTrack.getCapabilities();
            const advancedConstraints = [];
            
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
          } catch (err) {
            console.log("Could not apply video track optimizations:", err);
          }
        }
        
        // Try to enable torch if available
        if (videoTrack.getCapabilities()?.torch) {
          videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          }).catch(err => console.error("Error activating torch:", err));
        }
        
        // Create ImageCapture instance
        imageCaptureRef.current = new ImageCapture(videoTrack);
        
        // Start processing frames
        requestAnimationFrame(processVideoFrames);
        
        return true;
      } else {
        throw new Error("No video track found in stream");
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      setCameraError(true);
      setIsCameraOn(false);
      streamRef.current = null;
      imageCaptureRef.current = null;
      toast.error("Error accessing camera. Please try again.");
      return false;
    }
  }, [processVideoFrames]);

  const stopCamera = useCallback(() => {
    console.log("Stopping camera...");
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          // Turn off torch if it's available
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error deactivating torch:", err));
          }
          
          // Stop the track
          track.stop();
        });
      }
    } catch (error) {
      console.error("Error stopping camera tracks:", error);
    }
    
    streamRef.current = null;
    imageCaptureRef.current = null;
    setIsCameraOn(false);
  }, []);

  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.log('Error entering fullscreen mode:', err);
    }
  };

  const startMonitoring = useCallback(async () => {
    console.log("Starting monitoring");
    
    // If already monitoring, stop first
    if (isMonitoring) {
      console.log("Already monitoring, stopping first");
      handleReset();
      // Give some time for everything to reset
      setTimeout(() => {
        startMonitoring();
      }, 500);
      return;
    }
    
    try {
      enterFullScreen();
      
      // First start the camera
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
        toast.error("Could not start camera. Please try again.");
        return;
      }
      
      // Then start monitoring
      setIsMonitoring(true);
      startProcessing();
      setElapsedTime(0);
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "CALIBRANDO...|0"
      }));
      
    } catch (error) {
      console.error("Error starting monitoring:", error);
      handleReset();
      toast.error("Error starting monitoring. Please try again.");
    }
  }, [isMonitoring, startCamera, startProcessing]);

  const handleReset = useCallback(() => {
    console.log("Handling reset: turning off camera and stopping processing");
    
    // First stop processing
    stopProcessing();
    
    // Then update states
    setIsMonitoring(false);
    
    // Stop the camera
    stopCamera();
    
    // Clear the timer
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    // Reset all values
    resetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns({ 
      spo2: 0, 
      pressure: "--/--",
      arrhythmiaStatus: "--" 
    });
    setSignalQuality(0);
    setLastArrhythmiaData(null);
  }, [stopCamera, stopProcessing, resetVitalSigns]);

  // Handle camera errors
  useEffect(() => {
    if (cameraError && isMonitoring) {
      toast.error("Camera error. Please try again.");
      handleReset();
    }
  }, [cameraError, isMonitoring, handleReset]);

  return (
    <div 
      className="fixed inset-0 flex flex-col bg-black" 
      style={{ 
        height: '100vh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <CameraView 
            isMonitoring={isCameraOn}
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
            stream={streamRef.current}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={signalQuality}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              rawArrhythmiaData={lastArrhythmiaData}
            />
          </div>

          <VitalSignsPanel
            heartRate={heartRate}
            vitalSigns={vitalSigns}
          />

          <TimerDisplay 
            elapsedTime={elapsedTime} 
            isMonitoring={isMonitoring} 
          />

          <ControlButtons 
            isMonitoring={isMonitoring} 
            onMonitor={startMonitoring} 
            onReset={handleReset} 
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
