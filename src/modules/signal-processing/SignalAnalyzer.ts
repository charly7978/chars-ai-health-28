
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
  private readonly DETECTION_TIMEOUT = 20000;
  
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
    // Restore actual score tracking instead of forcing max values
    this.detectorScores.redChannel = Math.max(0, Math.min(1, scores.redChannel)); 
    this.detectorScores.stability = Math.max(0, Math.min(1, scores.stability));
    this.detectorScores.pulsatility = Math.max(0, Math.min(1, scores.pulsatility));
    this.detectorScores.biophysical = Math.max(0, Math.min(1, scores.biophysical));
    this.detectorScores.periodicity = Math.max(0, Math.min(1, scores.periodicity));
    
    // Log actual scores for analysis
    console.log("SignalAnalyzer: Updated detector scores:", {
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
    // Restore real finger detection logic instead of forcing detection
    const currentTime = Date.now();
    
    // Calculate weighted score from detector scores - genuinely reflect actual signal
    const redScore = this.detectorScores.redChannel * 0.25;
    const stabilityScore = this.detectorScores.stability * 0.25;
    const pulsatilityScore = this.detectorScores.pulsatility * 0.2;
    const biophysicalScore = this.detectorScores.biophysical * 0.15;
    const periodicityScore = this.detectorScores.periodicity * 0.15;
    
    const normalizedScore = redScore + stabilityScore + pulsatilityScore + biophysicalScore + periodicityScore;
    
    // Detect finger with proper thresholds
    const detectionThreshold = 0.5; // Moderate threshold for reliable detection
    const isFingerDetected = normalizedScore >= detectionThreshold;
    
    // Update consecutive detection counters
    if (isFingerDetected) {
      this.consecutiveDetections++;
      this.consecutiveNoDetections = 0;
      this.lastDetectionTime = currentTime;
    } else {
      this.consecutiveDetections = 0;
      this.consecutiveNoDetections++;
    }
    
    // Apply hysteresis to prevent detection flickering
    if (!this.isCurrentlyDetected && this.consecutiveDetections >= this.CONFIG.MIN_CONSECUTIVE_DETECTIONS) {
      this.isCurrentlyDetected = true;
    } else if (this.isCurrentlyDetected && 
              (this.consecutiveNoDetections >= this.CONFIG.MAX_CONSECUTIVE_NO_DETECTIONS ||
               currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT)) {
      this.isCurrentlyDetected = false;
    }
    
    // Calculate quality based on weighted scores
    let qualityValue = Math.round(normalizedScore * this.CONFIG.QUALITY_LEVELS);
    
    // Apply quality smoothing with history
    this.qualityHistory.push(qualityValue);
    if (this.qualityHistory.length > this.CONFIG.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    const finalQuality = this.isCurrentlyDetected ? 
      Math.round(this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length) : 0;
    
    const quality = Math.max(0, Math.min(100, (finalQuality / this.CONFIG.QUALITY_LEVELS) * 100));
    
    console.log("SignalAnalyzer: Detection result:", {
      normalizedScore,
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
