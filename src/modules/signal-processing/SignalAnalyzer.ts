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
  private readonly DETECTION_TIMEOUT = 3000; // Aumentado a 3 segundos para mayor retención
  
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
    // Factor de suavizado para cambios - más rápido para adaptarse
    const alpha = 0.4;  // Aumentado para adaptarse más rápido
    
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
      redChannel: 55,    // Aumentado para priorizar este indicador
      stability: 15,     
      pulsatility: 15,   
      biophysical: 10,
      periodicity: 5
    };
    
    // Calcular puntuación ponderada
    let weightedScore = 0;
    
    for (const [detector, weight] of Object.entries(detectorWeights)) {
      weightedScore += (this.detectorScores[detector] || 0) * weight;
    }
    
    // Normalizar a 100
    const normalizedScore = weightedScore / 100;
    
    // Reglas de detección con histéresis - UMBRALES MUY REDUCIDOS PARA AUMENTAR SENSIBILIDAD
    let detectionChanged = false;
    
    // *** CAMBIO CRÍTICO: UMBRAL DRÁSTICAMENTE REDUCIDO ***
    if (normalizedScore > 0.30) {  // Reducido a solo 0.30 (antes 0.40)
      // Puntuación alta -> incrementar detecciones consecutivas
      this.consecutiveDetections++;
      this.consecutiveNoDetections = 0; // Resetea completamente
      
      // ACTIVACIÓN INMEDIATA: solo requiere 1 frame con buena detección
      if (this.consecutiveDetections >= 1 && !this.isCurrentlyDetected) { 
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        detectionChanged = true;
        console.log("SignalAnalyzer: Detección de dedo ACTIVADA (score bajo)", { normalizedScore });
      }
    } else if (normalizedScore < 0.20) {  // Reducido de 0.30 a 0.20 para mayor permisividad
      // Puntuación baja -> decrementar detecciones
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.consecutiveNoDetections++;
      
      // Requiere MÁS no-detecciones para considerar ausencia de dedo
      if (this.consecutiveNoDetections >= 15 && this.isCurrentlyDetected) { // Aumentado a 15
        this.isCurrentlyDetected = false;
        detectionChanged = true;
        console.log("SignalAnalyzer: Detección de dedo DESACTIVADA", { normalizedScore });
      }
    }
    
    // Timeout de seguridad para señal perdida - aumentado para mantener más tiempo
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
      // *** FACTOR MULTIPLICATIVO AUMENTADO ***
      const baseQuality = normalizedScore * 20 * 1.5; // Factor multiplicativo aumentado
      
      // Ajustes basados en reglas
      let adjustments = 0;
      
      // Premiar estabilidad
      if (trendResult === 'stable') adjustments += 3;
      if (trendResult === 'highly_stable') adjustments += 5;
      
      // Aplicar ajustes y limitar a rango 0-20
      const adjustedQuality = Math.max(0, Math.min(20, baseQuality + adjustments));
      
      // Convertir a escala 0-100
      qualityValue = Math.round(adjustedQuality * 5);
      
      // *** CALIDAD MÍNIMA GARANTIZADA SI HAY DETECCIÓN ***
      if (qualityValue < 35) qualityValue = 35; // Garantiza un mínimo de 35% de calidad
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
    const finalQuality = avgQuality > 0 && avgQuality < 35 ? Math.max(35, avgQuality) : avgQuality;
    
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
