/**
 * Hook personalizado para PPGSignalExtractor
 * Proporciona una interfaz React para extracción de señales PPG en tiempo real
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalExtractor } from '../modules/ppg-extraction/PPGSignalExtractor';
import { ProcessedFrame } from '../types/image-processing';
import { 
  PPGSignal, 
  PulseWaveform, 
  SpectralAnalysis, 
  PPGExtractionConfig,
  PPGExtractionResult,
  PPGStatistics
} from '../types/ppg-extraction';

export interface UsePPGExtractorResult {
  // Estado
  isExtracting: boolean;
  isCalibrated: boolean;
  calibrationProgress: number;
  
  // Señales y análisis
  currentSignal: PPGSignal | null;
  pulseWaveform: PulseWaveform | null;
  spectralAnalysis: SpectralAnalysis | null;
  
  // Métricas
  signalQuality: number;
  heartRate: number;
  perfusionIndex: number;
  
  // Configuración
  config: PPGExtractionConfig;
  
  // Métodos
  extractSignal: (frames: ProcessedFrame[]) => PPGExtractionResult | null;
  updateConfig: (newConfig: Partial<PPGExtractionConfig>) => void;
  reset: () => void;
  
  // Estadísticas
  statistics: PPGStatistics;
}

export const usePPGExtractor = (initialConfig?: Partial<PPGExtractionConfig>): UsePPGExtractorResult => {
  // Estados
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [currentSignal, setCurrentSignal] = useState<PPGSignal | null>(null);
  const [pulseWaveform, setPulseWaveform] = useState<PulseWaveform | null>(null);
  const [spectralAnalysis, setSpectralAnalysis] = useState<SpectralAnalysis | null>(null);
  const [signalQuality, setSignalQuality] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [perfusionIndex, setPerfusionIndex] = useState(0);
  const [config, setConfig] = useState<PPGExtractionConfig>({
    samplingRate: 30,
    windowSize: 256,
    overlapRatio: 0.5,
    filterOrder: 4,
    cutoffFrequencies: { low: 0.5, high: 4.0 },
    spectralAnalysisDepth: 5,
    qualityThreshold: 0.7,
    enableAdaptiveFiltering: true,
    ...initialConfig
  });
  
  // Referencias
  const extractorRef = useRef<PPGSignalExtractor | null>(null);
  const extractionCountRef = useRef<number>(0);
  const qualityHistoryRef = useRef<number[]>([]);
  const heartRateHistoryRef = useRef<number[]>([]);
  
  // Crear instancia del extractor
  useEffect(() => {
    extractorRef.current = new PPGSignalExtractor(config);
    
    console.log('usePPGExtractor: Extractor PPG creado', {
      config,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      if (extractorRef.current) {
        extractorRef.current.reset();
      }
    };
  }, []);
  
  // Actualizar configuración del extractor cuando cambie
  useEffect(() => {
    if (extractorRef.current) {
      extractorRef.current.updateConfig(config);
    }
  }, [config]);
  
  // Actualizar estadísticas periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      if (extractorRef.current) {
        const stats = extractorRef.current.getStatistics();
        setIsCalibrated(stats.isCalibrated);
        setCalibrationProgress(stats.calibrationProgress);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  /**
   * Extrae señal PPG de frames procesados
   */
  const extractSignal = useCallback((frames: ProcessedFrame[]): PPGExtractionResult | null => {
    if (!extractorRef.current || frames.length === 0) {
      console.warn('usePPGExtractor: Extractor no inicializado o frames vacíos');
      return null;
    }
    
    setIsExtracting(true);
    const startTime = performance.now();
    
    try {
      // Extraer señal PPG
      const signal = extractorRef.current.extractPPGSignal(frames);
      setCurrentSignal(signal);
      
      // Calcular métricas de calidad
      const avgQuality = signal.qualityIndex.reduce((sum, q) => sum + q, 0) / signal.qualityIndex.length;
      setSignalQuality(avgQuality);
      
      // Actualizar historial de calidad
      qualityHistoryRef.current.push(avgQuality);
      if (qualityHistoryRef.current.length > 50) {
        qualityHistoryRef.current.shift();
      }
      
      // Extraer forma de onda de pulso si la calidad es suficiente
      let waveform: PulseWaveform | null = null;
      if (avgQuality > config.qualityThreshold && signal.acComponent.length > 10) {
        try {
          waveform = extractorRef.current.extractPulseWaveform(signal.acComponent);
          setPulseWaveform(waveform);
        } catch (error) {
          console.warn('usePPGExtractor: No se pudo extraer forma de onda:', error);
        }
      }
      
      // Realizar análisis espectral
      let spectral: SpectralAnalysis | null = null;
      if (signal.red.length >= config.windowSize) {
        try {
          spectral = extractorRef.current.performSpectralAnalysis(signal.red);
          setSpectralAnalysis(spectral);
          
          // Calcular frecuencia cardíaca desde análisis espectral
          const hr = spectral.dominantFrequency * 60; // Convertir Hz a BPM
          if (hr >= 40 && hr <= 200) { // Rango fisiológico
            setHeartRate(hr);
            
            // Actualizar historial de frecuencia cardíaca
            heartRateHistoryRef.current.push(hr);
            if (heartRateHistoryRef.current.length > 20) {
              heartRateHistoryRef.current.shift();
            }
          }
        } catch (error) {
          console.warn('usePPGExtractor: No se pudo realizar análisis espectral:', error);
        }
      }
      
      // Calcular índice de perfusión
      const avgAC = signal.acComponent.reduce((sum, ac) => sum + Math.abs(ac), 0) / signal.acComponent.length;
      const avgDC = signal.dcComponent.reduce((sum, dc) => sum + Math.abs(dc), 0) / signal.dcComponent.length;
      const pi = avgDC > 0 ? (avgAC / avgDC) * 100 : 0;
      setPerfusionIndex(pi);
      
      // Crear resultado de extracción
      const result: PPGExtractionResult = {
        signal,
        pulseWaveform: waveform,
        spectralAnalysis: spectral || {
          frequencies: [],
          magnitudes: [],
          phases: [],
          dominantFrequency: 0,
          harmonics: [],
          spectralPurity: 0,
          snr: 0
        },
        qualityMetrics: {
          snr: spectral?.snr || 0,
          perfusionIndex: pi,
          signalQuality: avgQuality,
          artifactLevel: 1 - avgQuality
        },
        timestamp: Date.now(),
        frameId: `ppg_extraction_${extractionCountRef.current}`
      };
      
      extractionCountRef.current++;
      
      const processingTime = performance.now() - startTime;
      
      console.log('usePPGExtractor: Señal PPG extraída exitosamente:', {
        signalLength: signal.red.length,
        quality: avgQuality.toFixed(3),
        heartRate: hr.toFixed(1),
        perfusionIndex: pi.toFixed(2),
        processingTime: `${processingTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } catch (error) {
      console.error('usePPGExtractor: Error extrayendo señal PPG:', {
        error: error instanceof Error ? error.message : String(error),
        frameCount: frames.length,
        timestamp: new Date().toISOString()
      });
      
      return null;
      
    } finally {
      setIsExtracting(false);
    }
  }, [config]);
  
  /**
   * Actualiza la configuración del extractor
   */
  const updateConfig = useCallback((newConfig: Partial<PPGExtractionConfig>) => {
    setConfig(prevConfig => {
      const updatedConfig = { ...prevConfig, ...newConfig };
      
      console.log('usePPGExtractor: Configuración actualizada:', {
        previousConfig: prevConfig,
        newConfig: updatedConfig,
        timestamp: new Date().toISOString()
      });
      
      return updatedConfig;
    });
  }, []);
  
  /**
   * Resetea el extractor y estadísticas
   */
  const reset = useCallback(() => {
    if (extractorRef.current) {
      extractorRef.current.reset();
    }
    
    // Resetear estados
    setIsExtracting(false);
    setIsCalibrated(false);
    setCalibrationProgress(0);
    setCurrentSignal(null);
    setPulseWaveform(null);
    setSpectralAnalysis(null);
    setSignalQuality(0);
    setHeartRate(0);
    setPerfusionIndex(0);
    
    // Resetear referencias
    extractionCountRef.current = 0;
    qualityHistoryRef.current = [];
    heartRateHistoryRef.current = [];
    
    console.log('usePPGExtractor: Extractor y estadísticas reseteados', {
      timestamp: new Date().toISOString()
    });
  }, []);
  
  // Calcular estadísticas en tiempo real
  const statistics: PPGStatistics = {
    isCalibrated,
    calibrationProgress,
    signalBufferSize: extractorRef.current?.getStatistics().signalBufferSize || 0,
    frameHistorySize: extractorRef.current?.getStatistics().frameHistorySize || 0,
    lastSignalQuality: signalQuality,
    averageHeartRate: heartRateHistoryRef.current.length > 0 
      ? heartRateHistoryRef.current.reduce((sum, hr) => sum + hr, 0) / heartRateHistoryRef.current.length 
      : 0,
    signalStability: qualityHistoryRef.current.length > 1 
      ? 1 - (Math.max(...qualityHistoryRef.current) - Math.min(...qualityHistoryRef.current))
      : 0
  };
  
  return {
    // Estado
    isExtracting,
    isCalibrated,
    calibrationProgress,
    
    // Señales y análisis
    currentSignal,
    pulseWaveform,
    spectralAnalysis,
    
    // Métricas
    signalQuality,
    heartRate,
    perfusionIndex,
    
    // Configuración
    config,
    
    // Métodos
    extractSignal,
    updateConfig,
    reset,
    
    // Estadísticas
    statistics
  };
};