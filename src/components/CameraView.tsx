
import React, { useRef, useEffect } from 'react';

interface CameraViewProps {
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  stream: MediaStream | null;
}

const CameraView = ({ 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  stream
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Connect video element to stream when stream changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      
      if (stream) {
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => 
              console.error("Error playing video:", err)
            );
          }
        };
      }
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
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
        backfaceVisibility: 'hidden',
        opacity: isMonitoring ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out'
      }}
    />
  );
};

export default CameraView;
