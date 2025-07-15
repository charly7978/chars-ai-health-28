import { HRVMetrics } from './HRVAnalyzer';

export interface ArrhythmiaAnalysis {
  hasArrhythmia: boolean;
  type: ArrhythmiaType;
  confidence: number;
  severity: ArrhythmiaSeverity;
  abnormalBeatsPercentage: number;
  riskScore: number;
  metrics: {
    rmssd: number;
    sdnn: number;
    pnn50: number;
    entropy: number;
  };
}

export enum ArrhythmiaType {
  NONE = 'NONE',
  SINUS_BRADYCARDIA = 'SINUS_BRADYCARDIA',
  SINUS_TACHYCARDIA = 'SINUS_TACHYCARDIA',
  ATRIAL_FIBRILLATION = 'ATRIAL_FIBRILLATION',
  SINUS_ARRHYTHMIA = 'SINUS_ARRHYTHMIA',
  PVC = 'PVC',
}

export class ArrhythmiaDetector {
  private static readonly RR_WINDOW_SIZE = 100;
  private static readonly RMSSD_THRESHOLD = 45;
  private static readonly PNN50_THRESHOLD = 0.1;
  private static readonly SDNN_THRESHOLD = 100;
  
  private rrIntervals: number[] = [];
  private lastAnalysis: ArrhythmiaAnalysis | null = null;
  private hrvAnalyzer: HRVAnalyzer;

  constructor() {
    this.hrvAnalyzer = new HRVAnalyzer();
    return true;
  }

  private calculateSD(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }

  private detectAbnormalBeats(intervals: number[]): number[] {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sd = this.calculateSD(intervals);
    
    return intervals.filter(interval => 
      Math.abs(interval - mean) > 2 * sd || 
      Math.abs(interval - mean) < 0.5 * sd
    );
  }

  private evaluateArrhythmiaSeverity(abnormalBeatsPercentage: number, metrics: HRVMetrics): ArrhythmiaSeverity {
    if (abnormalBeatsPercentage > 20 || metrics.lfhfRatio > 5 || metrics.entropy > 1.5) {
      return ArrhythmiaSeverity.SEVERE;
    } else if (abnormalBeatsPercentage > 10 || metrics.lfhfRatio > 3 || metrics.entropy > 1.2) {
      return ArrhythmiaSeverity.MODERATE;
    } else if (abnormalBeatsPercentage > 5 || metrics.lfhfRatio > 2 || metrics.entropy > 1.0) {
      return ArrhythmiaSeverity.MILD;
    }
    return ArrhythmiaSeverity.NONE;
  }

  private classifyArrhythmiaType(intervals: number[], metrics: HRVMetrics): ArrhythmiaType {
    const meanRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const meanHR = 60000 / meanRR;
    
    if (meanHR < 60) {
      return ArrhythmiaType.SINUS_BRADYCARDIA;
    } else if (meanHR > 100) {
      return ArrhythmiaType.SINUS_TACHYCARDIA;
    } else if (metrics.rmssd > 100 && metrics.pnn50 > 0.3) {
      return ArrhythmiaType.ATRIAL_FIBRILLATION;
    } else if (metrics.sdnn > 100) {
      return ArrhythmiaType.SINUS_ARRHYTHMIA;
    } else if (metrics.entropy > 1.5) {
      return ArrhythmiaType.PVC;
    }
    
    return ArrhythmiaType.NONE;
  }

  private calculateArrhythmiaRiskScore(metrics: HRVMetrics, abnormalBeatsPercentage: number): number {
    const dataQuality = Math.min(1.0, this.rrIntervals.length / 50);
    const hrvConsistency = 1 / (1 + Math.abs(metrics.lfhfRatio - 2));
    const beatConsistency = 1 / (1 + metrics.sdnn / 100);
    const entropyFactor = 1 / (1 + metrics.entropy);
    
    return Math.min(0.95, 
      dataQuality * 0.4 + 
      hrvConsistency * 0.3 + 
      beatConsistency * 0.2 + 
      entropyFactor * 0.1
    );
  }

  private calculateArrhythmiaConfidence(intervals: number[], metrics: HRVMetrics): number {
    const dataQuality = Math.min(1.0, intervals.length / 50);
    const hrvConsistency = 1 / (1 + Math.abs(metrics.lfhfRatio - 2));
    const beatConsistency = 1 / (1 + metrics.sdnn / 100);
    const entropyFactor = 1 / (1 + metrics.entropy);
    
    return Math.min(0.95, 
      dataQuality * 0.4 + 
      hrvConsistency * 0.3 + 
      beatConsistency * 0.2 + 
      entropyFactor * 0.1
    );
  }

  addRRInterval(interval: number): void {
    this.rrIntervals.push(interval);
    if (this.rrIntervals.length > ArrhythmiaDetector.RR_WINDOW_SIZE) {
      this.rrIntervals.shift();
    }
  }

  analyze(): ArrhythmiaAnalysis {
    if (this.rrIntervals.length < ArrhythmiaDetector.RR_WINDOW_SIZE) {
      return {
        hasArrhythmia: false,
        type: ArrhythmiaType.NONE,
        confidence: 0,
        severity: ArrhythmiaSeverity.NONE,
        abnormalBeatsPercentage: 0,
        riskScore: 0,
        metrics: {
          rmssd: 0,
          sdnn: 0,
          pnn50: 0,
          entropy: 0
        }
      };
    }

    const recentRR = this.rrIntervals.slice(-ArrhythmiaDetector.RR_WINDOW_SIZE);
    const metrics = {
      rmssd: this.calculateRMSSD(recentRR),
      sdnn: this.calculateSDNN(recentRR),
      pnn50: this.calculatePNN50(recentRR),
      entropy: this.calculateSampleEntropy(recentRR)
    };

    const abnormalBeats = this.detectAbnormalBeats(recentRR);
    const abnormalBeatsPercentage = (abnormalBeats.length / recentRR.length) * 100;

    const arrhythmiaType = this.classifyArrhythmiaType(recentRR, metrics);
    const severity = this.evaluateArrhythmiaSeverity(abnormalBeatsPercentage, metrics);
    const riskScore = this.calculateArrhythmiaRiskScore(metrics, abnormalBeatsPercentage);
    const confidence = this.calculateArrhythmiaConfidence(recentRR, metrics);

    const analysis: ArrhythmiaAnalysis = {
      hasArrhythmia: arrhythmiaType !== ArrhythmiaType.NONE || severity !== ArrhythmiaSeverity.NONE,
      type: arrhythmiaType,
      confidence,
      severity,
      abnormalBeatsPercentage,
      riskScore,
      metrics
    };

    // Actualizar estado de anomalías consecutivas
    if (analysis.hasArrhythmia && analysis.confidence > 0.7) {
      this.consecutiveAnomalies++;
    } else {
      this.consecutiveAnomalies = 0;
    }

    // Si hay 3 análisis consecutivos con arritmia, confirmar
    if (this.consecutiveAnomalies >= 3 && !this.lastAnalysis?.hasArrhythmia) {
      console.log("ArrhythmiaDetector: Aritmia confirmada por análisis consecutivos", {
        type: analysis.type,
        confidence: analysis.confidence,
        severity: analysis.severity
      });
    }

    this.lastAnalysis = analysis;
    return analysis;
  }

  reset(): void {
    this.rrIntervals = [];
    this.lastAnalysis = null;
    this.consecutiveAnomalies = 0;
    console.log("ArrhythmiaDetector: Reset completo");
  }
}
