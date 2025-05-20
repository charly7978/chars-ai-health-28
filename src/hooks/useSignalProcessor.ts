import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { toast } from "@/components/ui/use-toast";

export const useSignalProcessor = () => {
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0,
    lastQualityUpdateTime: 0
  });
  const signalHistoryRef = useRef<ProcessedSignal[]>([]);
  const qualityTransitionsRef = useRef<{time: number, from: number, to: number}[]>([]);
  const calibrationInProgressRef = useRef(false);

  // CRITICAL CHANGE: Ensure we always have a valid processor
  useEffect(() => {
    console.log("useSignalProcessor: Creating new processor instance", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });

    // Create processor with callbacks defined from the start
    const onSignalReady = (signal: ProcessedSignal) => {
      console.log("Callback onSignalReady called successfully", {
        timestamp: new Date(signal.timestamp).toISOString(),
        fingerDetected: signal.fingerDetected,
        quality: signal.quality,
        rawValue: signal.rawValue,
        filteredValue: signal.filteredValue
      });
      
      // Use signal as-is without forcing detection - respect actual finger detection
      setLastSignal(signal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update statistics
      setSignalStats(prev => {
        const newStats = {
          minValue: Math.min(prev.minValue, signal.filteredValue),
          maxValue: Math.max(prev.maxValue, signal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1,
          lastQualityUpdateTime: prev.lastQualityUpdateTime
        };
        
        return newStats;
      });
    };

    const onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Detailed error:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      
      setError(error);
      
      toast({
        title: "Error in signal processing",
        description: error.message,
        variant: "destructive"
      });
    };

    // Create processor with proper callbacks
    processorRef.current = new PPGSignalProcessor(onSignalReady, onError);
    
    console.log("useSignalProcessor: Processor created with callbacks established:", {
      hasOnSignalReadyCallback: !!processorRef.current.onSignalReady,
      hasOnErrorCallback: !!processorRef.current.onError
    });
    
    return () => {
      if (processorRef.current) {
        console.log("useSignalProcessor: Cleaning up processor");
        processorRef.current.stop();
      }
      signalHistoryRef.current = [];
      qualityTransitionsRef.current = [];
    };
  }, []);

  const startProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available");
      return;
    }

    console.log("useSignalProcessor: Starting processing", {
      estadoAnterior: isProcessing,
      timestamp: new Date().toISOString(),
      processorExists: !!processorRef.current,
      hasSignalReadyCallback: !!processorRef.current.onSignalReady
    });
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0,
      lastQualityUpdateTime: 0
    });
    signalHistoryRef.current = [];
    qualityTransitionsRef.current = [];
    
    processorRef.current.start();
  }, [isProcessing]);

  const stopProcessing = useCallback(() => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to stop");
      return;
    }

    console.log("useSignalProcessor: Stopping processing", {
      estadoAnterior: isProcessing,
      framesProcessados: framesProcessed,
      estadisticasFinales: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processorRef.current.stop();
    calibrationInProgressRef.current = false;
  }, [isProcessing, framesProcessed, signalStats]);

  const calibrate = useCallback(async () => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to calibrate");
      return false;
    }

    try {
      console.log("useSignalProcessor: Starting advanced calibration", {
        timestamp: new Date().toISOString()
      });
      
      calibrationInProgressRef.current = true;
      await processorRef.current.calibrate();
      
      // Wait a bit for the automatic calibration to complete
      setTimeout(() => {
        calibrationInProgressRef.current = false;
        console.log("useSignalProcessor: Advanced calibration completed", {
          timestamp: new Date().toISOString()
        });
      }, 3000);
      
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Detailed calibration error:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      calibrationInProgressRef.current = false;
      return false;
    }
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current) {
      console.error("useSignalProcessor: No processor available to process frames");
      return;
    }

    if (isProcessing) {
      console.log("processFrame: Processing frame", {
        width: imageData.width,
        height: imageData.height,
        timestamp: Date.now()
      });
      
      // Verify callbacks are properly assigned
      if (!processorRef.current.onSignalReady) {
        console.error("processFrame: onSignalReady is not defined in the processor");
        return;
      }
      
      try {
        processorRef.current.processFrame(imageData);
      } catch (error) {
        console.error("processFrame: Error processing frame", error);
        toast({
          title: "Error processing frame",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    }
  }, [isProcessing]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    isCalibrating: calibrationInProgressRef.current,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame
  };
};
