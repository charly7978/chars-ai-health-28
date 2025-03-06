
import { useState, useEffect, useCallback } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export const useSignalProcessor = () => {
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creating new processor instance");
    return new PPGSignalProcessor();
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);

  useEffect(() => {
    console.log("useSignalProcessor: Setting up callbacks");
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      console.log("useSignalProcessor: Signal received:", {
        timestamp: signal.timestamp,
        quality: signal.quality,
        fingerDetected: signal.fingerDetected,
        filteredValue: signal.filteredValue
      });
      setLastSignal(signal);
      setError(null);
    };

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error received:", error);
      setError(error);
    };

    console.log("useSignalProcessor: Initializing processor");
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Initialization error:", error);
    });

    return () => {
      console.log("useSignalProcessor: Cleaning up");
      processor.stop();
      setIsProcessing(false);
    };
  }, [processor]);

  const startProcessing = useCallback(() => {
    try {
      console.log("useSignalProcessor: Starting processing");
      setIsProcessing(true);
      processor.start();
    } catch (error) {
      console.error("Error starting processing:", error);
      setIsProcessing(false);
      setError({ 
        code: "START_ERROR", 
        message: "Error starting processing", 
        timestamp: Date.now() 
      });
    }
  }, [processor]);

  const stopProcessing = useCallback(() => {
    try {
      console.log("useSignalProcessor: Stopping processing");
      setIsProcessing(false);
      processor.stop();
    } catch (error) {
      console.error("Error stopping processing:", error);
      setError({ 
        code: "STOP_ERROR", 
        message: "Error stopping processing", 
        timestamp: Date.now() 
      });
    }
  }, [processor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) {
      return;
    }
    
    try {
      processor.processFrame(imageData);
    } catch (error) {
      console.error("Error processing frame:", error);
      setError({ 
        code: "PROCESS_ERROR", 
        message: "Error processing frame", 
        timestamp: Date.now() 
      });
    }
  }, [isProcessing, processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
