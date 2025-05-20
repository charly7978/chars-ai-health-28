
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
  // Aumentar el tiempo de retención de detección
  private readonly DETECTION_TIMEOUT = 2000; 
  
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
    const alpha = 0.35;  // Aumentado para adaptarse más rápido
    
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

    // Añadir logueo para diagnóstico de valores
    console.log("SignalAnalyzer: Scores actualizados:", {
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
    const currentTime = Date.now();
    
    // Aplicar ponderación a los detectores (total: 100) - ajustado para dar mucho más peso a señal roja
    const detectorWeights = {
      redChannel: 50,    // Aumentado drásticamente para priorizar este indicador
      stability: 15,     // Reducido para dar más peso al canal rojo
      pulsatility: 15,   // Reducido para dar más peso al canal rojo
      biophysical: 10,
      periodicity: 10
    };
    
    // Calcular puntuación ponderada
    let weightedScore = 0;
    
    for (const [detector, weight] of Object.entries(detectorWeights)) {
      weightedScore += (this.detectorScores[detector] || 0) * weight;
    }
    
    // Normalizar a 100
    const normalizedScore = weightedScore / 100;
    
    // Reglas de detección con histéresis - umbrales ajustados para mejorar detección
    let detectionChanged = false;
    
    // *** CAMBIO CRÍTICO: UMBRAL DRÁSTICAMENTE REDUCIDO ***
    if (normalizedScore > 0.40) {  // Reducido a sólo 0.40 (antes 0.60)
      // Puntuación alta -> incrementar detecciones consecutivas
      this.consecutiveDetections++;
      this.consecutiveNoDetections = 0; // Resetea completamente
      
      // *** CAMBIO CRÍTICO: REQUIERE MENOS DETECCIONES CONSECUTIVAS ***
      if (this.consecutiveDetections >= 1 && !this.isCurrentlyDetected) { // Cambio de 2 a 1
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        detectionChanged = true;
        console.log("SignalAnalyzer: Detección de dedo ACTIVADA", { normalizedScore });
      }
    } else if (normalizedScore < 0.30 || trendResult === 'non_physiological') {  // Reducido de 0.40 a 0.30
      // Puntuación baja o señal no fisiológica -> decrementar detecciones
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.consecutiveNoDetections++;
      
      // *** CAMBIO CRÍTICO: REQUIERE MÁS NO-DETECCIONES PARA CONSIDERAR QUE NO HAY DEDO ***
      if (this.consecutiveNoDetections >= 10 && this.isCurrentlyDetected) { // Aumentado a 10
        this.isCurrentlyDetected = false;
        detectionChanged = true;
        console.log("SignalAnalyzer: Detección de dedo DESACTIVADA", { normalizedScore });
      }
    }
    
    // Timeout de seguridad para señal perdida - Aumentado para mantener la detección por más tiempo
    if (this.isCurrentlyDetected && currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT) {
      console.log("SignalAnalyzer: Timeout de detección activado", { 
        tiempoTranscurrido: currentTime - this.lastDetectionTime 
      });
      this.isCurrentlyDetected = false;
      detectionChanged = true;
    }
    
    // Calcular calidad en escala 0-100 con niveles más granulares
    let qualityValue: number;
    
    if (!this.isCurrentlyDetected) {
      qualityValue = 0;
    } else {
      // Sistema de 20 niveles de calidad (multiplica por 5 para obtener 0-100)
      // *** CAMBIO CRÍTICO: MULTIPLICA LA CALIDAD POR FACTOR ***
      // Esto da una mejor percepción de calidad al usuario
      const baseQuality = normalizedScore * 20 * 1.25; // Factor multiplicativo añadido
      
      // Ajustes basados en reglas
      let adjustments = 0;
      
      // Premiar estabilidad
      if (trendResult === 'stable') adjustments += 2;
      if (trendResult === 'highly_stable') adjustments += 4;
      
      // Aplicar ajustes y limitar a rango 0-20
      const adjustedQuality = Math.max(0, Math.min(20, baseQuality + adjustments));
      
      // Convertir a escala 0-100
      qualityValue = Math.round(adjustedQuality * 5);
      
      // *** CAMBIO CRÍTICO: CALIDAD MÍNIMA GARANTIZADA SI HAY DETECCIÓN ***
      if (qualityValue < 30) qualityValue = 30; // Garantiza un mínimo de 30% de calidad
    }
    
    // Añadir a historial de calidad
    this.qualityHistory.push(qualityValue);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Calcular calidad promedio para estabilidad
    const avgQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / 
                      Math.max(1, this.qualityHistory.length);
    
    // Si la calidad es baja pero no cero, aplicar un mínimo más generoso
    const finalQuality = avgQuality > 0 && avgQuality < 30 ? Math.max(30, avgQuality) : avgQuality;
    
    // Loguear resultados para diagnóstico
    console.log("SignalAnalyzer: Estado de detección:", {
      normalizedScore,
      consecutiveDetections: this.consecutiveDetections,
      consecutiveNoDetections: this.consecutiveNoDetections,
      isFingerDetected: this.isCurrentlyDetected,
      quality: Math.round(+finalQuality),
      trendResult
    });
    
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
    console.log("SignalAnalyzer: Sistema reseteado");
  }
}
