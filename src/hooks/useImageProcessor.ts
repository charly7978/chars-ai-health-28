/**
 * Hook personalizado para RealTimeImageProcessor
 * Proporciona una interfaz React para procesamiento de imagen en tiempo real
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealTimeImageProcessor } from '../modules/image-processing/RealTimeImageProcessor';
import { 
  ProcessedFrame, 
  ImageProcessingConfig, 
  QualityMetrics,
  FingerDetection,
  OpticalDensity,
  ColorChannels
} from '../types/image-processing';

export interface UseImageProcessorResult {
  // Estado
  isProcessing: boolean;
  lastFrame: ProcessedFrame | null;
  frameCount: number;
  averageQuality: number;
  
  // Métricas en tiempo real
  currentQuality: QualityMetrics | null;
  fingerDetection: FingerDetection | null;
  opticalDensity: OpticalDensity | null;
  
  // Configuración
  config: ImageProcessingConfig;
  
  // Métodos
  processFrame: (imageData: ImageData) => ProcessedFrame | null;
  updateConfig: (newConfig: Partial<ImageProcessingConfig>) => void;
  reset: () => void;
  
  // Estadísticas
  processingStats: {
    framesProcessed: number;
    averageProcessingTime: number;
    qualityHistory: number[];
    fingerDetectionRate: number;
  };
}

export const useImageProcessor = (initialConfig?: Partial<ImageProcessingConfig>): UseImageProcessorResult => {
  // Estados
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrame, setLastFrame] = useState<ProcessedFrame | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [averageQuality, setAverageQuality] = useState(0);
  const [currentQuality, setCurrentQuality] = useState<QualityMetrics | null>(null);
  const [fingerDetection, setFingerDetection] = useState<FingerDetection | null>(null);
  const [opticalDensity, setOpticalDensity] = useState<OpticalDensity | null>(null);
  const [config, setConfig] = useState<ImageProcessingConfig>({
    roiSize: { width: 200, height: 200 },
    roiPosition: { x: 0.5, y: 0.5 },
    enableStabilization: true,
    qualityThreshold: 70,
    textureAnalysisDepth: 3,
    colorSpaceConversion: 'Lab',
    ...initialConfig
  });
  
  // Referencias
  const processorRef = useRef<RealTimeImageProcessor | null>(null);
  const processingTimesRef = useRef<number[]>([]);
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectionCountRef = useRef<number>(0);
  const totalFramesRef = useRef<number>(0);
  
  // Crear instancia del procesador
  useEffect(() => {
    processorRef.current = new RealTimeImageProcessor(config);
    
    console.log('useImageProcessor: Procesador de imagen creado', {
      config,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      if (processorRef.current) {
        processorRef.current.reset();
      }
    };
  }, []);
  
  // Actualizar configuración del procesador cuando cambie
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.updateConfig(config);
    }
  }, [config]);
  
  /**
   * Procesa un frame de imagen
   */
  const processFrame = useCallback((imageData: ImageData): ProcessedFrame | null => {
    if (!processorRef.current) {
      console.error('useImageProcessor: Procesador no inicializado');
      return null;
    }
    
    const startTime = performance.now();
    setIsProcessing(true);
    
    try {
      // Procesar frame
      const processedFrame = processorRef.current.processFrame(imageData);
      
      // Actualizar estados
      setLastFrame(processedFrame);
      setCurrentQuality(processedFrame.qualityMetrics);
      setFingerDetection(processedFrame.fingerDetection);
      setOpticalDensity(processedFrame.opticalDensity);
      
      // Actualizar contadores
      const newFrameCount = frameCount + 1;
      setFrameCount(newFrameCount);
      totalFramesRef.current = newFrameCount;
      
      // Actualizar estadísticas de calidad
      const quality = processedFrame.qualityMetrics.overallQuality;
      qualityHistoryRef.current.push(quality);
      
      // Mantener historial limitado
      if (qualityHistoryRef.current.length > 100) {
        qualityHistoryRef.current.shift();
      }
      
      // Calcular calidad promedio
      const avgQuality = qualityHistoryRef.current.reduce((sum, q) => sum + q, 0) / qualityHistoryRef.current.length;
      setAverageQuality(avgQuality);
      
      // Actualizar estadísticas de detección de dedo
      if (processedFrame.fingerDetection.isPresent) {
        fingerDetectionCountRef.current++;
      }
      
      // Actualizar estadísticas de tiempo de procesamiento
      const processingTime = performance.now() - startTime;
      processingTimesRef.current.push(processingTime);
      
      // Mantener historial limitado de tiempos
      if (processingTimesRef.current.length > 50) {
        processingTimesRef.current.shift();
      }
      
      console.log('useImageProcessor: Frame procesado', {
        frameId: processedFrame.frameId,
        quality: quality.toFixed(1),
        fingerDetected: processedFrame.fingerDetection.isPresent,
        processingTime: `${processingTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
      
      return processedFrame;
      
    } catch (error) {
      console.error('useImageProcessor: Error procesando frame:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      return null;
      
    } finally {
      setIsProcessing(false);
    }
  }, [frameCount]);
  
  /**
   * Actualiza la configuración del procesador
   */
  const updateConfig = useCallback((newConfig: Partial<ImageProcessingConfig>) => {
    setConfig(prevConfig => {
      const updatedConfig = { ...prevConfig, ...newConfig };
      
      console.log('useImageProcessor: Configuración actualizada', {
        previousConfig: prevConfig,
        newConfig: updatedConfig,
        timestamp: new Date().toISOString()
      });
      
      return updatedConfig;
    });
  }, []);
  
  /**
   * Resetea el procesador y estadísticas
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    // Resetear estados
    setLastFrame(null);
    setFrameCount(0);
    setAverageQuality(0);
    setCurrentQuality(null);
    setFingerDetection(null);
    setOpticalDensity(null);
    setIsProcessing(false);
    
    // Resetear referencias
    processingTimesRef.current = [];
    qualityHistoryRef.current = [];
    fingerDetectionCountRef.current = 0;
    totalFramesRef.current = 0;
    
    console.log('useImageProcessor: Procesador y estadísticas reseteados', {
      timestamp: new Date().toISOString()
    });
  }, []);
  
  // Calcular estadísticas en tiempo real
  const processingStats = {
    framesProcessed: frameCount,
    averageProcessingTime: processingTimesRef.current.length > 0 
      ? processingTimesRef.current.reduce((sum, time) => sum + time, 0) / processingTimesRef.current.length 
      : 0,
    qualityHistory: [...qualityHistoryRef.current],
    fingerDetectionRate: totalFramesRef.current > 0 
      ? (fingerDetectionCountRef.current / totalFramesRef.current) * 100 
      : 0
  };
  
  return {
    // Estado
    isProcessing,
    lastFrame,
    frameCount,
    averageQuality,
    
    // Métricas en tiempo real
    currentQuality,
    fingerDetection,
    opticalDensity,
    
    // Configuración
    config,
    
    // Métodos
    processFrame,
    updateConfig,
    reset,
    
    // Estadísticas
    processingStats
  };
};