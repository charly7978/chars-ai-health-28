import React, { useRef, useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useAndroidCamera } from '@/hooks/useAndroidCamera';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView: React.FC<CameraViewProps> = ({
  onStreamReady,
  onError,
  isFingerDetected = false,
  signalQuality = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [flashState, setFlashState] = useState<'on' | 'off'>('off');
  const [flashSupported, setFlashSupported] = useState<boolean>(false);
  
  // Use the Android camera hook
  const {
    mediaStream: stream,
    error: cameraError,
    isInitialized,
    flashState: cameraFlashState,
    toggleFlash,
    flashSupported: isFlashSupportedByDevice,
    initialize: startCamera,
    stop,
  } = useAndroidCamera();

  // Initialize camera on mount
  useEffect(() => {
    const initCamera = async () => {
      try {
        setIsInitializing(true);
        await startCamera();
        setFlashSupported(isFlashSupportedByDevice);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize camera';
        setError(errorMessage);
        onError?.(new Error(errorMessage));
      } finally {
        setIsInitializing(false);
      }
    };

    initCamera();

    return () => {
      stop().catch(err => {
        console.error('Error stopping camera:', err);
      });
    };
  }, [startCamera, stop, isFlashSupportedByDevice, onError]);

  // Handle stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      onStreamReady?.(stream);
    }
  }, [stream, onStreamReady]);

  // Handle camera errors
  useEffect(() => {
    if (cameraError) {
      setError(cameraError);
      onError?.(new Error(cameraError));
    }
  }, [cameraError, onError]);

  // Handle flash state changes
  useEffect(() => {
    setFlashState(cameraFlashState);
  }, [cameraFlashState]);

  // Toggle flash handler
  const handleToggleFlash = async () => {
    try {
      await toggleFlash();
    } catch (err) {
      console.error('Error toggling flash:', err);
      toast({
        title: 'Error',
        description: 'Failed to toggle flash',
        variant: 'destructive',
      });
    }
  };

  // Render loading or error state
  if (error) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-white text-center p-4">
          <p className="text-lg font-medium mb-2">Camera Error</p>
          <p className="text-sm text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover ${
          isFingerDetected ? 'ring-4 ring-green-500' : ''
        }`}
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          backgroundColor: '#000',
        }}
      />

      {/* Loading overlay */}
      {isInitializing && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p>Initializing camera...</p>
          </div>
        </div>
      )}

      {/* Camera controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col space-y-3">
        {/* Flash button */}
        {flashSupported && (
          <button
            onClick={handleToggleFlash}
            className="p-3 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-all"
            aria-label={flashState === 'on' ? 'Turn off flash' : 'Turn on flash'}
          >
            {flashState === 'on' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            )}
          </button>
        )}

        {/* Signal quality indicator */}
        <div className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
          {signalQuality > 0 ? `Signal: ${Math.round(signalQuality)}%` : 'Analyzing...'}
        </div>
      </div>

      {/* Finger detection indicator */}
      {isFingerDetected && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium">
          Finger detected
        </div>
      )}
    </div>
  );
};

export default CameraView;
