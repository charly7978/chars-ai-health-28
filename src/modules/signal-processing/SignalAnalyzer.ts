
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
  private readonly DETECTION_TIMEOUT = 5000; // Reduced timeout for faster response to finger removal
  private readonly MOTION_ARTIFACT_THRESHOLD = 0.65;
  private valueHistory: number[] = []; // Track signal history for artifact detection
  
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
    // Store actual scores without manipulation
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel)); 
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability));
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility));
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical));
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity));
    
    // Track values for motion artifact detection
    this.valueHistory.push(scores.redValue);
    if (this.valueHistory.length > 15) {
      this.valueHistory.shift();
    }
    
    // Detect motion artifacts (rapid large changes in signal)
    if (this.valueHistory.length >= 5) {
      const recentValues = this.valueHistory.slice(-5);
      const maxChange = Math.max(...recentValues) - Math.min(...recentValues);
      const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calculate normalized change as percentage of mean
      const normalizedChange = meanValue > 0 ? maxChange / meanValue : 0;
      
      // Update motion artifact score with smoothing
      this.motionArtifactScore = this.motionArtifactScore * 0.7 + (normalizedChange > 0.4 ? 0.3 : 0);
      
      // Apply artifact penalty to stability
      if (this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD) {
        this.detectorScores.stability *= 0.4; // Stronger penalty for motion artifacts
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
    
    // Apply trend analysis results - stronger penalties for unstable trends
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
        trendMultiplier = 0.7; // Stronger penalty
        break;
      case 'highly_unstable':
        trendMultiplier = 0.5; // Stronger penalty
        break;
      case 'non_physiological':
        trendMultiplier = 0.2; // Stronger penalty for non-physiological signals
        break;
    }
    
    // Calculate weighted score from detector scores - using medical research-based weights
    const redScore = this.detectorScores.redChannel * 0.20;
    const stabilityScore = this.detectorScores.stability * 0.25; // Increased importance of stability
    const pulsatilityScore = this.detectorScores.pulsatility * 0.25; 
    const biophysicalScore = this.detectorScores.biophysical * 0.20; 
    const periodicityScore = this.detectorScores.periodicity * 0.10;
    
    // Apply trend multiplier from signal analysis
    const normalizedScore = (redScore + stabilityScore + pulsatilityScore + 
                           biophysicalScore + periodicityScore) * trendMultiplier;
    
    // Apply motion artifact penalty - stronger penalty for clear artifacts
    const finalScore = this.motionArtifactScore > this.MOTION_ARTIFACT_THRESHOLD ? 
                      normalizedScore * 0.5 : normalizedScore;
    
    // Higher threshold for reliable detection - increased for more stringent detection
    const detectionThreshold = 0.65; // Higher threshold for reliable detection
    const isFingerDetected = finalScore >= detectionThreshold;
    
    // Update consecutive detection counters
    if (isFingerDetected) {
      this.consecutiveDetections++;
      this.consecutiveNoDetections = 0;
      this.lastDetectionTime = currentTime;
    } else {
      this.consecutiveDetections = 0;
      this.consecutiveNoDetections++;
    }
    
    // Apply stronger hysteresis to prevent detection flickering
    if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS) {
      this.isCurrentlyDetected = true;
      console.log("SignalAnalyzer: Finger DETECTED after consistent readings");
    } else if (this.isCurrentlyDetected && 
              (this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS ||
               currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT)) {
      this.isCurrentlyDetected = false;
      console.log("SignalAnalyzer: Finger LOST after consistent absence");
    }
    
    // Auto-reset on extreme signal changes that indicate finger removal
    if (this.isCurrentlyDetected && this.motionArtifactScore > 0.8) {
      this.consecutiveNoDetections += 2; // Accelerate detection loss for clear artifacts
    }
    
    // Calculate quality based on weighted scores with physiological validation
    let qualityValue = Math.round(finalScore * this.CONFIG.QUALITY_LEVELS);
    
    // Enforce zero quality when not detected
    if (!this.isCurrentlyDetected) {
      qualityValue = 0;
    }
    
    // Apply quality smoothing with history - no smoothing for low quality to react faster
    if (qualityValue > 0) {
      this.qualityHistory.push(qualityValue);
      if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
        this.qualityHistory.shift();
      }
    }
    
    const finalQuality = this.isCurrentlyDetected ? 
      Math.round(this.qualityHistory.reduce((a, b) => a + b, 0) / Math.max(1, this.qualityHistory.length)) : 0;
    
    // Convert to percentage
    const quality = Math.max(0, Math.min(100, (finalQuality / this.CONFIG.QUALITY_LEVELS) * 100));
    
    console.log("SignalAnalyzer: Detection result:", {
      normalizedScore: normalizedScore.toFixed(2),
      finalScore: finalScore.toFixed(2),
      trendMultiplier: trendMultiplier.toFixed(2),
      motionArtifact: this.motionArtifactScore.toFixed(2),
      consecutiveDetections: this.consecutiveDetections,
      isFingerDetected: this.isCurrentlyDetected,
      quality,
      trendResult
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
