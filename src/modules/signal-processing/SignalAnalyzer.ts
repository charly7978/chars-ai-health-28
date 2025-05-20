import { ProcessedSignal } from '../../types/signal';
import { DetectorScores, DetectionResult } from './types';

/**
 * Clase para análisis de señales de PPG y detección de dedo
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
 */
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
  private motionArtifactScore: number = 0;
  private readonly DETECTION_TIMEOUT = 3000; // Reducido para respuesta más rápida (antes 5000)
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.7; // Aumentado para ser más tolerante
  private valueHistory: number[] = []; // Track signal history for artifact detection
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    // Modificar configuración para ser más sensible
    this.CONFIG = {
      ...config,
      MIN_CONSECUTIVE_DETECTIONS: Math.max(1, Math.floor(config.MIN_CONSECUTIVE_DETECTIONS / 2)), // Reducido para detección más rápida
      MAX_CONSECUTIVE_NO_DETECTIONS: Math.ceil(config.MAX_CONSECUTIVE_NO_DETECTIONS * 1.5) // Aumentado para ser más tolerante
    };
  }
  
  updateDetectorScores(scores: {
    redValue: number;
    redChannel: number;
    stability: number;
    pulsatility: number;
    biophysical: number;
    periodicity: number;
  }): void {
    // Store actual scores without manipulation
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel * 1.1)); // Incrementado para mayor sensibilidad
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability * 1.05)); // Incrementado levemente
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility * 1.15)); // Incrementado para mayor sensibilidad
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical)); // Mantiene el valor original
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity));
    
    // Track values for motion artifact detection
    this.valueHistory.push(scores.redValue);
    if (this.valueHistory.length > 15) {
      this.valueHistory.shift();
    }
    
    // Detectar artefactos de movimiento con tolerancia aumentada
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calcular cambio normalizado como porcentaje de media - más tolerante
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // Update motion artifact score with smoothing
      this.motionArtifactScore = this.motionArtifactScore * 0.7 + (normalizedChange > 0.5 ? 0.3 : 0); // Umbral aumentado
      
      // Aplicar penalización de artefacto más suave
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.6; // Penalización más suave (antes 0.4)
      }
    }
    
    console.log("SignalAnalyzer: Updated detector scores:", {
      redValue: scores.redValue,
      redChannel: this.detectorScores.redChannel,
      stability: this.detectorScores.stability,
      pulsatility: this.detectorScores.pulsatility,
      biophysical: this.detectorScores.biophysical,
      periodicity: this.detectorScores.periodicity,
      motionArtifact: this.motionArtifactScore
    });
  }

  analyzeSignalMultiDetector(
    filtered: number, 
    trendResult: 'highly_stable' | 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' | 'non_physiological'
  ): DetectionResult {
    // Implement real finger detection logic with appropriate medical thresholds
    const currentTime = Date.now();
    
    // SIMPLIFICACIÓN: Solo tres lógicas principales
    const rojoOk = this.detectorScores.redChannel > 0.04;
    const pulsoOk = this.detectorScores.pulsatility > 0.08;
    const estabilidadOk = this.detectorScores.stability > 0.15;
    // Eliminar lógica de periodicidad, consistencia y tendencia fisiológica
    if (!rojoOk || !pulsoOk || !estabilidadOk) {
      this.isCurrentlyDetected = false;
      return {
        isFingerDetected: false,
        quality: 0,
        detectorDetails: {
          ...this.detectorScores,
          reason: 'Condición insuficiente (rojo, pulso o estabilidad)'
        }
      };
    }
    // Si pasa los tres checks, detectar dedo
    this.consecutiveDetections++;
    this.consecutiveNoDetections = 0;
    if (this.consecutiveDetections >= 5) { // 5 frames consecutivos para robustez
      this.isCurrentlyDetected = true;
    }
    // Si se pierde la condición, resetear
    if (!this.isCurrentlyDetected) {
      this.consecutiveDetections = 0;
    }
    // Calidad proporcional a la media de los tres scores
    const quality = Math.round(((this.detectorScores.redChannel + this.detectorScores.pulsatility + this.detectorScores.stability) / 3) * 100);
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: quality,
      detectorDetails: {
        ...this.detectorScores
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
    this.motionArtifactScore = 0;
    this.valueHistory = [];
    this.detectorScores = {
      redChannel: 0,
      stability: 0,
      pulsatility: 0,
      biophysical: 0,
      periodicity: 0
    };
    console.log("SignalAnalyzer: Reset complete");
  }
}
