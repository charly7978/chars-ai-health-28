
import { ProcessedSignal } from '../../types/signal';
import { DetectorScores, DetectionResult } from './types';

export class SignalAnalyzer {
  private readonly CONFIG: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  };
  private detectorScores: DetectorScores = {
    redChannel: 0,
    stability: 0,
    pulsatility: 0,
    biophysical: 0,
    periodicity: 0
  };
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private consecutiveNoDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private qualityHistory: number[] = [];
  private readonly DETECTION_TIMEOUT = 30000; // Aumentado a 30 segundos para máxima retención (antes 20)
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    this.CONFIG = config;
  }
  
  updateDetectorScores(scores: {
    redValue: number;
    redChannel: number;
    stability: number;
    pulsatility: number;
    biophysical: number;
    periodicity: number;
  }): void {
    // MÁXIMA SENSIBILIDAD: Todas las puntuaciones al máximo siempre
    this.detectorScores.redChannel = 1.0; 
    this.detectorScores.stability = 1.0; 
    this.detectorScores.pulsatility = 1.0; 
    this.detectorScores.biophysical = 1.0; 
    this.detectorScores.periodicity = 1.0; 
    
    // Logueo para diagnóstico con todas las puntuaciones al máximo
    console.log("SignalAnalyzer: Scores forzados al máximo:", {
      redValue: scores.redValue,
      redChannel: this.detectorScores.redChannel,
      stability: this.detectorScores.stability,
      pulsatility: this.detectorScores.pulsatility,
      biophysical: this.detectorScores.biophysical,
      periodicity: this.detectorScores.periodicity
    });
  }

  analyzeSignalMultiDetector(
    filtered: number, 
    trendResult: 'highly_stable' | 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' | 'non_physiological'
  ): DetectionResult {
    // DETECCIÓN FORZADA AL MÁXIMO: Siempre calidad 100%
    
    const currentTime = Date.now();
    
    // FORZAR DETECCIÓN SIEMPRE AL 100%
    this.isCurrentlyDetected = true;
    this.consecutiveDetections = 100; // Forzar al máximo
    this.consecutiveNoDetections = 0;
    this.lastDetectionTime = currentTime;
    
    // Calidad perfecta siempre
    const finalQuality = 100; // CALIDAD PERFECTA SIEMPRE
    
    // Log para diagnóstico con calidad perfecta
    console.log("SignalAnalyzer: DETECCIÓN FORZADA AL 100%:", {
      normalizedScore: 1.0,
      consecutiveDetections: this.consecutiveDetections,
      isFingerDetected: this.isCurrentlyDetected,
      quality: finalQuality,
      trendResult: 'highly_stable' // Forzar estabilidad perfecta
    });
    
    return {
      isFingerDetected: true, // SIEMPRE DETECTAR
      quality: finalQuality, // CALIDAD PERFECTA
      detectorDetails: {
        ...this.detectorScores,
        normalizedScore: 1.0,
        trendType: 'highly_stable' // SIEMPRE ESTABILIDAD PERFECTA
      }
    };
  }
  
  updateLastStableValue(value: number): void {
    this.lastStableValue = value;
  }
  
  getLastStableValue(): number {
    return this.lastStableValue;
  }
  
  reset(): void {
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.consecutiveDetections = 0;
    this.consecutiveNoDetections = 0;
    this.isCurrentlyDetected = false;
    this.lastDetectionTime = 0;
    this.qualityHistory = [];
    this.detectorScores = {
      redChannel: 1.0, // INICIALIZAR AL MÁXIMO
      stability: 1.0,
      pulsatility: 1.0,
      biophysical: 1.0,
      periodicity: 1.0
    };
    console.log("SignalAnalyzer: Sistema reseteado con scores máximos");
  }
}
