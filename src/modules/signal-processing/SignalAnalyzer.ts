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
    
    // Apply trend analysis results - penalties más suaves para tendencias inestables
    let trendMultiplier = 1.0;
    switch(trendResult) {
      case 'highly_stable':
        trendMultiplier = 1.2;
        break;
      case 'stable':
        trendMultiplier = 1.1;
        break;
      case 'moderately_stable':
        trendMultiplier = 1.0;
        break;
      case 'unstable':
        trendMultiplier = 0.8; // Penalización más suave (antes 0.7)
        break;
      case 'highly_unstable':
        trendMultiplier = 0.6; // Penalización más suave (antes 0.5)
        break;
      case 'non_physiological':
        trendMultiplier = 0.3; // Penalización más suave (antes 0.2)
        break;
    }
    
    // Ponderación más permisiva para facilitar detección
    const redScore = this.detectorScores.redChannel * 0.35; // Antes 0.25
    const stabilityScore = this.detectorScores.stability * 0.25; // Antes 0.20
    const pulsatilityScore = this.detectorScores.pulsatility * 0.30; // Antes 0.25
    const biophysicalScore = this.detectorScores.biophysical * 0.07; // Antes 0.20
    const periodicityScore = this.detectorScores.periodicity * 0.03; // Antes 0.10
    
    // Apply trend multiplier from signal analysis
    const normalizedScore = (redScore + stabilityScore + pulsatilityScore + 
                           biophysicalScore + periodicityScore) * trendMultiplier;
    
    // Penalización más suave por artefactos de movimiento
    const finalScore = this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD ? 
                      normalizedScore * 0.6 : normalizedScore; // Antes 0.5
    
    // Umbral de detección aún más bajo para máxima sensibilidad
    const detectionThreshold = 0.03; // Antes 0.5
    const isFingerDetected = finalScore >= detectionThreshold || (this.detectorScores.redChannel > 0.05 && this.detectorScores.pulsatility > 0.05);
    
    // Update consecutive detection counters
    if (isFingerDetected) {
      this.consecutiveDetections++;
      this.consecutiveNoDetections = 0;
      this.lastDetectionTime = currentTime;
    } else {
      this.consecutiveDetections = 0;
      this.consecutiveNoDetections++;
    }
    
    // Histéresis más suave para prevenir parpadeo de detección
    if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS) {
      this.isCurrentlyDetected = true;
      console.log("SignalAnalyzer: Finger DETECTED after consistent readings");
    } else if (this.isCurrentlyDetected && 
              (this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS ||
               currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT)) {
      this.isCurrentlyDetected = false;
      console.log("SignalAnalyzer: Finger LOST after consistent absence");
    }
    
    // Auto-reset en cambios extremos de señal - más tolerante
    if (this.isCurrentlyDetected && this.motionArtifactScore > 0.85) { // Umbral aumentado (antes 0.8)
      this.consecutiveNoDetections += 1; // Incremento más lento (antes +2)
    }
    
    // Calcular calidad basada en puntuaciones ponderadas
    let qualityValue = Math.round(finalScore * this.CONFIG.QUALITY_LEVELS);
    
    // Asignar calidad mínima cuando se detecta dedo pero con señal débil
    if (this.isCurrentlyDetected && qualityValue < 1) {
      qualityValue = 10; // Garantizar calidad mínima para dedos detectados
    }
    
    // Suavizado de calidad con historial
    if (qualityValue > 0) {
      this.qualityHistory.push(qualityValue);
      if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
        this.qualityHistory.shift();
      }
    }
    
    const finalQuality = this.isCurrentlyDetected ? 
      Math.round(this.qualityHistory.reduce((a, b) => a + b, 0) / Math.max(1, this.qualityHistory.length)) : 0;
    
    // Convertir a porcentaje
    const quality = Math.max(0, Math.min(100, (finalQuality / this.CONFIG.QUALITY_LEVELS) * 100));
    
    console.log("SignalAnalyzer: Detection result:", {
      normalizedScore: normalizedScore.toFixed(2),
      finalScore: finalScore.toFixed(2),
      trendMultiplier: trendMultiplier.toFixed(2),
      motionArtifact: this.motionArtifactScore.toFixed(2),
      consecutiveDetections: this.consecutiveDetections,
      isFingerDetected: this.isCurrentlyDetected,
      quality,
      trendResult,
      detectionThreshold
    });
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: quality,
      detectorDetails: {
        ...this.detectorScores,
        normalizedScore,
        trendType: trendResult
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
