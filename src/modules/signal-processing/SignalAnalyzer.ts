
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
  private readonly DETECTION_TIMEOUT = 250;
  
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
    // Factor de suavizado para cambios
    const alpha = 0.2;
    
    // Actualizar cada puntuación con suavizado
    this.detectorScores.redChannel = 
      (1 - alpha) * this.detectorScores.redChannel + alpha * scores.redChannel;
    
    this.detectorScores.stability = 
      (1 - alpha) * this.detectorScores.stability + alpha * scores.stability;
    
    this.detectorScores.pulsatility = 
      (1 - alpha) * this.detectorScores.pulsatility + alpha * scores.pulsatility;
    
    this.detectorScores.biophysical = 
      (1 - alpha) * this.detectorScores.biophysical + alpha * scores.biophysical;
    
    this.detectorScores.periodicity = 
      (1 - alpha) * this.detectorScores.periodicity + alpha * scores.periodicity;
  }

  analyzeSignalMultiDetector(
    filtered: number, 
    trendResult: 'highly_stable' | 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' | 'non_physiological'
  ): DetectionResult {
    const currentTime = Date.now();
    
    // Aplicar ponderación a los detectores (total: 100)
    const detectorWeights = {
      redChannel: 20,    // 20% al valor de rojo
      stability: 20,     // 20% a estabilidad
      pulsatility: 25,   // 25% a pulsatilidad
      biophysical: 15,   // 15% a validación biofísica
      periodicity: 20    // 20% a periodicidad fisiológica
    };
    
    // Calcular puntuación ponderada
    let weightedScore = 0;
    
    for (const [detector, weight] of Object.entries(detectorWeights)) {
      weightedScore += (this.detectorScores[detector] || 0) * weight;
    }
    
    // Normalizar a 100
    const normalizedScore = weightedScore / 100;
    
    // Reglas de detección con histéresis
    let detectionChanged = false;
    
    if (normalizedScore > 0.68) {
      // Puntuación alta -> incrementar detecciones consecutivas
      this.consecutiveDetections++;
      this.consecutiveNoDetections = Math.max(0, this.consecutiveNoDetections - 1);
      
      if (this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS && !this.isCurrentlyDetected) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        detectionChanged = true;
      }
    } else if (normalizedScore < 0.45 || trendResult === 'non_physiological') {
      // Puntuación baja o señal no fisiológica -> decrementar detecciones
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.consecutiveNoDetections++;
      
      if (this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS && this.isCurrentlyDetected) {
        this.isCurrentlyDetected = false;
        detectionChanged = true;
      }
    }
    
    // Timeout de seguridad para señal perdida
    if (this.isCurrentlyDetected && currentTime - this.lastDetectionTime > 1000) {
      console.log("SignalAnalyzer: Timeout de detección activado");
      this.isCurrentlyDetected = false;
      detectionChanged = true;
    }
    
    // Calcular calidad en escala 0-100 con niveles más granulares
    let qualityValue: number;
    
    if (!this.isCurrentlyDetected) {
      qualityValue = 0;
    } else {
      // Sistema de 20 niveles de calidad (multiplica por 5 para obtener 0-100)
      const baseQuality = normalizedScore * 20;
      
      // Ajustes basados en reglas
      let adjustments = 0;
      
      // Penalizar inestabilidad
      if (trendResult === 'unstable') adjustments -= 1;
      if (trendResult === 'highly_unstable') adjustments -= 3;
      
      // Premiar estabilidad
      if (trendResult === 'stable') adjustments += 1;
      if (trendResult === 'highly_stable') adjustments += 2;
      
      // Aplicar ajustes y limitar a rango 0-20
      const adjustedQuality = Math.max(0, Math.min(20, baseQuality + adjustments));
      
      // Convertir a escala 0-100
      qualityValue = Math.round(adjustedQuality * 5);
    }
    
    // Añadir a historial de calidad
    this.qualityHistory.push(qualityValue);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Calcular calidad promedio para estabilidad
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / 
                      Math.max(1, this.qualityHistory.length);
    
    // Si la calidad es baja pero no cero, aplicar un mínimo
    const finalQuality = avgQuality > 0 && avgQuality < 15 ? Math.max(15, avgQuality) : avgQuality;
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: Math.round(+finalQuality), // Convert to number explicitly and round
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
    this.detectorScores = {
      redChannel: 0,
      stability: 0,
      pulsatility: 0,
      biophysical: 0,
      periodicity: 0
    };
  }
}
