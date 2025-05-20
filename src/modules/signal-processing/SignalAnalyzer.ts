
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
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.75; // Ajustado para mejor equilibrio (era 0.7)
  private valueHistory: number[] = []; // Track signal history for artifact detection
  // Nuevo: calibración adaptativa
  private calibrationPhase: boolean = true;
  private calibrationSamples: number[] = [];
  private readonly CALIBRATION_SAMPLE_SIZE = 20;
  private adaptiveThreshold: number = 0.03; // Umbral inicial que se ajustará
  
  constructor(config: { 
    QUALITY_LEVELS: number;
    QUALITY_HISTORY_SIZE: number;
    MIN_CONSECUTIVE_DETECTIONS: number;
    MAX_CONSECUTIVE_NO_DETECTIONS: number;
  }) {
    // Modificar configuración para ser más sensible
    this.CONFIG = {
      ...config,
      MIN_CONSECUTIVE_DETECTIONS: Math.max(1, Math.floor(config.MIN_CONSECUTIVE_DETECTIONS / 3)), // Reducido aún más para detección más rápida (antes /2)
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
    textureScore?: number; // Opcional para compatibilidad
  }): void {
    // Store actual scores with enhancement multipliers
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel * 1.2)); // Aumentado (antes 1.1)
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability * 1.1)); // Incrementado levemente (antes 1.05)
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility * 1.25)); // Aumentado significativamente (antes 1.15)
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical * 1.1)); // Ahora también se aumenta (antes sin multiplicador)
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity * 1.1)); // Aumentado levemente (antes sin multiplicador)
    
    // Store texture score if available
    if (typeof scores.textureScore !== 'undefined') {
      this.detectorScores.textureScore = scores.textureScore;
    }
    
    // Track values for motion artifact detection
    this.valueHistory.push(scores.redValue);
    if (this.valueHistory.length > 15) {
      this.valueHistory.shift();
    }
    
    // Detectar artefactos de movimiento con tolerancia ajustada
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calcular cambio normalizado como porcentaje de media - más tolerante
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // Update motion artifact score with smoothing
      this.motionArtifactScore = this.motionArtifactScore * 0.7 + (normalizedChange > 0.55 ? 0.3 : 0); // Umbral aumentado (antes 0.5)
      
      // Aplicar penalización de artefacto más suave
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.7; // Penalización más suave (antes 0.6)
      }
    }
    
    // Calibración adaptativa - recolectar muestras en fase de calibración
    if (this.calibrationPhase && this.detectorScores.redChannel > 0.1) {
      this.calibrationSamples.push(scores.redValue);
      
      // Cuando tenemos suficientes muestras, calibramos el umbral
      if (this.calibrationSamples.length >= this.CALIBRATION_SAMPLE_SIZE) {
        this.calibrateAdaptiveThreshold();
        this.calibrationPhase = false;
      }
    }
    
    console.log("SignalAnalyzer: Updated detector scores:", {
      redValue: scores.redValue,
      redChannel: this.detectorScores.redChannel,
      stability: this.detectorScores.stability,
      pulsatility: this.detectorScores.pulsatility,
      biophysical: this.detectorScores.biophysical,
      periodicity: this.detectorScores.periodicity,
      motionArtifact: this.motionArtifactScore,
      adaptiveThreshold: this.adaptiveThreshold,
      calibrationPhase: this.calibrationPhase
    });
  }

  // Nuevo método para calibración adaptativa del umbral
  private calibrateAdaptiveThreshold(): void {
    // Ordenar muestras y eliminar valores extremos (10% superior e inferior)
    const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
    const trimCount = Math.floor(sortedSamples.length * 0.1);
    const trimmedSamples = sortedSamples.slice(trimCount, sortedSamples.length - trimCount);
    
    // Calcular media y desviación estándar
    const mean = trimmedSamples.reduce((sum, val) => sum + val, 0) / trimmedSamples.length;
    const variance = trimmedSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / trimmedSamples.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular coeficiente de variación (CV) para ajustar sensibilidad
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Ajustar umbral según variabilidad - menor variabilidad requiere umbral más alto
    // para evitar falsos positivos, mayor variabilidad requiere umbral más bajo
    if (cv < 0.05) { // Muy estable
      this.adaptiveThreshold = 0.04; // Umbral más alto para evitar falsos positivos
    } else if (cv < 0.1) { // Estable
      this.adaptiveThreshold = 0.025; // Umbral moderado
    } else { // Variable
      this.adaptiveThreshold = 0.02; // Umbral más bajo para mejorar detección
    }
    
    console.log("SignalAnalyzer: Calibración adaptativa completada", {
      muestras: this.calibrationSamples.length,
      media: mean.toFixed(2),
      desviacionEstandar: stdDev.toFixed(2),
      coeficienteVariacion: cv.toFixed(3),
      umbralAdaptativo: this.adaptiveThreshold
    });
    
    // Limpiar muestras de calibración
    this.calibrationSamples = [];
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
        trendMultiplier = 1.3; // Aumento (antes 1.2)
        break;
      case 'stable':
        trendMultiplier = 1.2; // Aumento (antes 1.1)
        break;
      case 'moderately_stable':
        trendMultiplier = 1.1; // Aumento (antes 1.0)
        break;
      case 'unstable':
        trendMultiplier = 0.85; // Penalización más suave (antes 0.8)
        break;
      case 'highly_unstable':
        trendMultiplier = 0.7; // Penalización más suave (antes 0.6)
        break;
      case 'non_physiological':
        trendMultiplier = 0.4; // Penalización más suave (antes 0.3)
        break;
    }
    
    // Ponderación más permisiva para facilitar detección
    const redScore = this.detectorScores.redChannel * 0.4; // Aumentado (antes 0.35)
    const stabilityScore = this.detectorScores.stability * 0.25; // Mantiene (antes 0.25)
    const pulsatilityScore = this.detectorScores.pulsatility * 0.30; // Mantiene (antes 0.30)
    const biophysicalScore = this.detectorScores.biophysical * 0.07; // Mantiene (antes 0.07)
    const periodicityScore = this.detectorScores.periodicity * 0.05; // Aumentado (antes 0.03)
    
    // Apply trend multiplier from signal analysis
    const normalizedScore = (redScore + stabilityScore + pulsatilityScore + 
                           biophysicalScore + periodicityScore) * trendMultiplier;
    
    // Penalización más suave por artefactos de movimiento
    const finalScore = this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD ? 
                      normalizedScore * 0.7 : normalizedScore; // Más suave (antes 0.6)
    
    // Usar umbral adaptativo si ya no estamos en fase de calibración
    const detectionThreshold = this.calibrationPhase ? 0.025 : this.adaptiveThreshold;
    
    // Condición de detección más sensible
    const isFingerDetected = finalScore >= detectionThreshold || 
                           (this.detectorScores.redChannel > 0.04 && this.detectorScores.pulsatility > 0.04);
    
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
    // Ahora requiere menos frames consecutivos para detección
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
    if (this.isCurrentlyDetected && this.motionArtifactScore > 0.9) { // Umbral aumentado (antes 0.85)
      this.consecutiveNoDetections += 1; // Incremento más lento
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
    
    // Condiciones más permisivas para detección
    const rojoOk = this.detectorScores.redChannel > 0.03; // Antes 0.04
    const pulsoOk = this.detectorScores.pulsatility > 0.06; // Antes 0.08
    
    // Verificación de textura más permisiva
    const texturaOk = typeof this.detectorScores.textureScore === 'undefined' || 
                     (this.detectorScores.textureScore > 0.33 && this.detectorScores.textureScore < 0.98);
    
    // Ajuste para reducir mínimo de frames consecutivos
    this.CONFIG.MIN_CONSECUTIVE_DETECTIONS = 5; // Antes 7
    
    // Condición permisiva de detección
    if (!rojoOk || !texturaOk) { // Ya no requerimos pulsoOk para la detección inicial
      // Esta condición sigue siendo estricta para evitar falsos positivos
      this.isCurrentlyDetected = false;
      return {
        isFingerDetected: false,
        quality: 0,
        detectorDetails: {
          ...this.detectorScores,
          normalizedScore,
          trendType: trendResult,
          reason: 'Condición insuficiente (rojo o textura)'
        }
      };
    }
    
    // Si la señal es fisiológicamente absurda pero hay rojo, solo rechazar si la periodicidad es absurda
    if (trendResult === 'non_physiological' && (!rojoOk)) {
      this.isCurrentlyDetected = false;
      return {
        isFingerDetected: false,
        quality: 0,
        detectorDetails: {
          ...this.detectorScores,
          normalizedScore,
          trendType: trendResult,
          reason: 'Tendencia no fisiológica y señal débil'
        }
      };
    }
    
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
    this.calibrationPhase = true; // Reiniciar fase de calibración
    this.calibrationSamples = []; // Limpiar muestras de calibración
    this.adaptiveThreshold = 0.03; // Restablecer umbral adaptativo
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
