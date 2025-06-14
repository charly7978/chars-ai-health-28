import { useState, useEffect, useRef } from "react";
import { PPGProcessor } from "../modules/signal-processing/PPGProcessor";
import type { VitalSigns, SignalQuality } from "../modules/signal-processing/types";

export function useVitalMeasurement() {
	const [measurements, setMeasurements] = useState<VitalSigns[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [quality, setQuality] = useState<SignalQuality | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const processorRef = useRef<PPGProcessor | null>(null);

	useEffect(() => {
		processorRef.current = new PPGProcessor();
	}, []);

	const initializeCamera = async () => {
		// ...código para inicializar la cámara y asignar el stream a videoRef.current...
	};

	const processFrame = () => {
		if (!isProcessing || !videoRef.current || !canvasRef.current) return;
		const context = canvasRef.current.getContext("2d");
		if (!context) return;
		context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
		const frame = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
		const result = processorRef.current!.processFrame(frame);
		setQuality(result.quality);
		// ...actualizar measurements según corresponda...
		requestAnimationFrame(processFrame);
	};

	const startMeasurement = async () => {
		setIsProcessing(true);
		await initializeCamera();
		requestAnimationFrame(processFrame);
	};

	const stopMeasurement = () => {
		setIsProcessing(false);
	};

	return {
		measurements,
		isProcessing,
		quality,
		videoRef,
		canvasRef,
		startMeasurement,
		stopMeasurement
	};
}
    startMeasurement,
    stopMeasurement: () => setIsProcessing(false)
  };
}
    
    const MEASUREMENT_DURATION = 30000;

    const updateMeasurements = () => {
      const processor = (window as any).heartBeatProcessor;
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      const bpm = processor.getFinalBPM() || 0;
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        bpm,
        rawBPM: processor.getFinalBPM(),
        confidence: processor.getConfidence ? processor.getConfidence() : 'N/A',
        timestamp: new Date().toISOString()
      });

      setMeasurements(prev => {
        if (prev.heartRate === bpm) {
          console.log('useVitalMeasurement - BPM sin cambios, no se actualiza', {
            currentBPM: prev.heartRate,
            timestamp: new Date().toISOString()
          });
          return prev;
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm
        };
        
        console.log('useVitalMeasurement - Actualizando BPM', {
          prevBPM: prev.heartRate,
          newBPM: bpm,
          timestamp: new Date().toISOString()
        });
        
        return newValues;
      });
    };

    updateMeasurements();

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString()
      });
      
      setElapsedTime(elapsed / 1000);

      updateMeasurements();

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          timestamp: new Date().toISOString()
        });
        
        clearInterval(interval);
        const event = new CustomEvent('measurementComplete');
        window.dispatchEvent(event);
      }
    }, 200);

    return () => {
      console.log('useVitalMeasurement - Limpiando intervalo', {
        currentElapsed: elapsedTime,
        timestamp: new Date().toISOString()
      });
      clearInterval(interval);
    };
  }, [isMeasuring, measurements]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
