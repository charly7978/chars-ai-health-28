
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export const useSignalProcessor = () => {
  // Use a ref to maintain processor instance across renders
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);

  // Initialize processor only once
  useEffect(() => {
    if (!processorRef.current) {
      console.log("useSignalProcessor: Creating new processor instance");
      processorRef.current = new PPGSignalProcessor();
    }
    
    console.log("useSignalProcessor: Setting up callbacks");
    
    if (processorRef.current) {
      processorRef.current.onSignalReady = (signal: ProcessedSignal) => {
        console.log("useSignalProcessor: Signal received:", {
          timestamp: signal.timestamp,
          quality: signal.quality,
          fingerDetected: signal.fingerDetected,
          filteredValue: signal.filteredValue
        });
        setLastSignal(signal);
        setError(null);
      };

      processorRef.current.onError = (error: ProcessingError) => {
        console.error("useSignalProcessor: Error received:", error);
        setError(error);
      };
    }

    console.log("useSignalProcessor: Initializing processor");
    processorRef.current?.initialize().catch(error => {
      console.error("useSignalProcessor: Initialization error:", error);
    });

    return () => {
      console.log("useSignalProcessor: Cleaning up");
      if (processorRef.current) {
        processorRef.current.stop();
      }
      setIsProcessing(false);
    };
  }, []);

  const startProcessing = useCallback(() => {
    try {
      console.log("useSignalProcessor: Starting processing");
      if (processorRef.current) {
        setIsProcessing(true);
        processorRef.current.start();
      }
    } catch (error) {
      console.error("Error starting processing:", error);
      setIsProcessing(false);
      setError({ 
        code: "START_ERROR", 
        message: "Error starting processing", 
        timestamp: Date.now() 
      });
    }
  }, []);

  const stopProcessing = useCallback(() => {
    try {
      console.log("useSignalProcessor: Stopping processing");
      if (processorRef.current) {
        processorRef.current.stop();
      }
      setIsProcessing(false);
    } catch (error) {
      console.error("Error stopping processing:", error);
      setError({ 
        code: "STOP_ERROR", 
        message: "Error stopping processing", 
        timestamp: Date.now() 
      });
    }
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing || !processorRef.current) {
      return;
    }
    
    try {
      processorRef.current.processFrame(imageData);
    } catch (error) {
      console.error("Error processing frame:", error);
      setError({ 
        code: "PROCESS_ERROR", 
        message: "Error processing frame", 
        timestamp: Date.now() 
      });
    }
  }, [isProcessing]);

  return {
    isProcessing,
    lastSignal,
    error,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
