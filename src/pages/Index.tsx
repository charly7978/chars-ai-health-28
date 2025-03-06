
import React, { useEffect, useCallback } from "react";
import VitalSignsPanel from "@/components/VitalSignsPanel";
import CameraView from "@/components/CameraView";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import TimerDisplay from "@/components/TimerDisplay";
import ControlButtons from "@/components/ControlButtons";
import { useMonitoringControl } from "@/hooks/useMonitoringControl";

const Index = () => {
  const {
    isMonitoring,
    isCameraOn,
    elapsedTime,
    vitalSigns,
    heartRate,
    signalQuality,
    lastArrhythmiaData,
    startMonitoring,
    handleReset,
    processFrame,
    lastSignal
  } = useMonitoringControl();
  
  // Prevent page scrolling
  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  // Handle stream ready callback
  const handleStreamReady = useCallback((stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack) {
      console.error("No video track found in stream");
      return;
    }
    
    const imageCapture = new ImageCapture(videoTrack);
    
    // Try to enable torch if available
    if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activating torch:", err));
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error("Could not get 2D context");
      return;
    }
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      try {
        const frame = await imageCapture.grabFrame();
        tempCanvas.width = frame.width;
        tempCanvas.height = frame.height;
        tempCtx.drawImage(frame, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, frame.width, frame.height);
        processFrame(imageData);
        
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      } catch (error) {
        console.error("Error capturing frame:", error);
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      }
    };

    processImage();
  }, [isMonitoring, processFrame]);

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
            onStreamReady={handleStreamReady}
            isMonitoring={isCameraOn}
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex-1">
            {/* Only render PPGSignalMeter when we have a signal or monitoring is active */}
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
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
