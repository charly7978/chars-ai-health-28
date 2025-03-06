
import { useState, useEffect, useCallback } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export const useSignalProcessor = () => {
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador");
    return new PPGSignalProcessor();
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);

  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks");
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      console.log("useSignalProcessor: Señal recibida:", {
        timestamp: signal.timestamp,
        quality: signal.quality,
        filteredValue: signal.filteredValue
      });
      setLastSignal(signal);
      setError(null);
    };

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error recibido:", error);
      setError(error);
    };

    console.log("useSignalProcessor: Iniciando procesador");
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    return () => {
      console.log("useSignalProcessor: Limpiando");
      processor.stop();
      setIsProcessing(false);
    };
  }, [processor]);

  const startProcessing = useCallback(() => {
    try {
      console.log("useSignalProcessor: Iniciando procesamiento");
      setIsProcessing(true);
      processor.start();
    } catch (error) {
      console.error("Error starting processing:", error);
      setIsProcessing(false);
      setError({ 
        code: "START_ERROR", 
        message: "Error al iniciar el procesamiento", 
        timestamp: Date.now() 
      });
    }
  }, [processor]);

  const stopProcessing = useCallback(() => {
    try {
      console.log("useSignalProcessor: Deteniendo procesamiento");
      setIsProcessing(false);
      processor.stop();
    } catch (error) {
      console.error("Error stopping processing:", error);
      setError({ 
        code: "STOP_ERROR", 
        message: "Error al detener el procesamiento", 
        timestamp: Date.now() 
      });
    }
  }, [processor]);

  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Iniciando calibración");
      await processor.calibrate();
      console.log("useSignalProcessor: Calibración exitosa");
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de calibración:", error);
      setError({ 
        code: "CALIBRATION_ERROR", 
        message: "Error durante la calibración", 
        timestamp: Date.now() 
      });
      return false;
    }
  }, [processor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) {
      console.log("useSignalProcessor: Frame ignorado (no está procesando)");
      return;
    }
    
    try {
      processor.processFrame(imageData);
    } catch (error) {
      console.error("Error processing frame:", error);
      setError({ 
        code: "PROCESS_ERROR", 
        message: "Error al procesar el frame", 
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
    calibrate,
    processFrame
  };
};
