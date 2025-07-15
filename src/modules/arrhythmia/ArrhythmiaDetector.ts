import { HRVAnalyzer } from './HRVAnalyzer';
import type { HRVMetrics } from '../../types';
import { ArrhythmiaAnalysis, ArrhythmiaSeverity, ArrhythmiaType } from '../../types';

export class ArrhythmiaDetector {
  private static readonly RR_WINDOW_SIZE = 100;
  private static readonly RMSSD_THRESHOLD = 45;
  private static readonly PNN50_THRESHOLD = 0.1;
  private static readonly SDNN_THRESHOLD = 100;
  private static readonly CONSECUTIVE_ANOMALIES_THRESHOLD = 3;
  private static readonly ABNORMAL_BEATS_THRESHOLD = 10; // 10% de latidos anormales

  private rrIntervals: number[] = [];
  private consecutiveAnomalies: number = 0;
  private lastAnalysis: ArrhythmiaAnalysis | null = null;
  private hrvAnalyzer: HRVAnalyzer;

  constructor() {
    this.hrvAnalyzer = new HRVAnalyzer();
    this.reset();
  }

  addRRInterval(interval: number): void {
    this.rrIntervals.push(interval);
    if (this.rrIntervals.length > ArrhythmiaDetector.RR_WINDOW_SIZE) {
      this.rrIntervals.shift();
    }
    this.hrvAnalyzer.addRRInterval(interval);
  }

  analyze(): ArrhythmiaAnalysis {
    if (this.rrIntervals.length < ArrhythmiaDetector.RR_WINDOW_SIZE) {
      const defaultAnalysis = {
        hasArrhythmia: false,
        type: ArrhythmiaType.NONE,
        severity: ArrhythmiaSeverity.NONE,
        confidence: 0,
        riskScore: 0,
        rmssd: 0,
        sdnn: 0,
        pnn50: 0,
        lfhfRatio: 1,
        entropy: 0
      };
      this.lastAnalysis = defaultAnalysis;
      return defaultAnalysis;
    }

    const metrics = this.hrvAnalyzer.analyze();
    const abnormalBeats = this.detectAbnormalBeats(this.rrIntervals);
    const abnormalBeatsPercentage = (abnormalBeats.length / this.rrIntervals.length) * 100;
    
    const currentAnalysis: ArrhythmiaAnalysis = {
      ...metrics,
      type: this.classifyArrhythmiaType(this.rrIntervals, metrics) as ArrhythmiaType,
      severity: this.determineSeverity(metrics, abnormalBeatsPercentage),
      confidence: this.calculateArrhythmiaConfidence(this.rrIntervals, metrics),
      riskScore: this.calculateArrhythmiaRiskScore(metrics, abnormalBeatsPercentage),
      hasArrhythmia: abnormalBeatsPercentage > ArrhythmiaDetector.ABNORMAL_BEATS_THRESHOLD
    };

    // Actualizar estado de anomalías consecutivas
    if (this.lastAnalysis?.hasArrhythmia && this.lastAnalysis.confidence > 0.7) {
      this.consecutiveAnomalies++;
    } else {
      this.consecutiveAnomalies = 0;
    }

    // Si hay 3 análisis consecutivos con arritmia, confirmar
    if (this.consecutiveAnomalies >= 3 && this.lastAnalysis && !this.lastAnalysis.hasArrhythmia) {
      console.log("ArrhythmiaDetector: Aritmia confirmada por análisis consecutivos", {
        type: currentAnalysis.type,
        confidence: currentAnalysis.confidence,
        severity: currentAnalysis.severity
      });
    }

    this.lastAnalysis = currentAnalysis;
    return currentAnalysis;
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

  private classifyArrhythmiaType(intervals: number[], metrics: HRVMetrics): ArrhythmiaType {
    const meanRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const meanHR = 60000 / meanRR;
    
    if (meanHR < 60) return ArrhythmiaType.SINUS_BRADYCARDIA;
    if (meanHR > 100) return ArrhythmiaType.SINUS_TACHYCARDIA;
    if (metrics.rmssd > 100 && metrics.pnn50 > 0.3) return ArrhythmiaType.ATRIAL_FIBRILLATION;
    if (metrics.sdnn > 100) return ArrhythmiaType.SINUS_ARRHYTHMIA;
    if (metrics.entropy > 1.5) return ArrhythmiaType.PVC;
    
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

  private determineSeverity(metrics: HRVMetrics, abnormalBeatsPercentage: number): ArrhythmiaSeverity {
    let severity = ArrhythmiaSeverity.NONE;
    
    // Evaluar porcentaje de latidos anormales
    if (abnormalBeatsPercentage > 20) {
      severity = ArrhythmiaSeverity.SEVERE;
    } else if (abnormalBeatsPercentage > 10) {
      severity = ArrhythmiaSeverity.MODERATE;
    } else if (abnormalBeatsPercentage > 5) {
      severity = ArrhythmiaSeverity.MINOR;
    }
    
    // Evaluar RMSSD
    if (metrics.rmssd > ArrhythmiaDetector.RMSSD_THRESHOLD) {
      severity = this.increaseSeverity(severity, ArrhythmiaSeverity.MINOR);
    }
    
    // Evaluar PNN50
    if (metrics.pnn50 > ArrhythmiaDetector.PNN50_THRESHOLD) {
      severity = this.increaseSeverity(severity, ArrhythmiaSeverity.MODERATE);
    }
    
    // Evaluar SDNN
    if (metrics.sdnn > ArrhythmiaDetector.SDNN_THRESHOLD) {
      severity = this.increaseSeverity(severity, ArrhythmiaSeverity.SEVERE);
    }
    
    // Evaluar ratio LF/HF
    if (metrics.lfhfRatio > 5) {
      severity = this.increaseSeverity(severity, ArrhythmiaSeverity.MODERATE);
    }
    
    // Evaluar entropía
    if (metrics.entropy > 1.5) {
      severity = this.increaseSeverity(severity, ArrhythmiaSeverity.MINOR);
    }
    
    // Evaluar anomalías consecutivas
    if (severity !== ArrhythmiaSeverity.NONE) {
      this.consecutiveAnomalies++;
      if (this.consecutiveAnomalies >= ArrhythmiaDetector.CONSECUTIVE_ANOMALIES_THRESHOLD) {
        severity = ArrhythmiaSeverity.SEVERE;
      }
    } else {
      this.consecutiveAnomalies = 0;
    }
    
    return severity;
  }
  
  private increaseSeverity(current: ArrhythmiaSeverity, toAdd: ArrhythmiaSeverity): ArrhythmiaSeverity {
    const severityValues = {
      [ArrhythmiaSeverity.NONE]: 0,
      [ArrhythmiaSeverity.MINOR]: 1,
      [ArrhythmiaSeverity.MODERATE]: 2,
      [ArrhythmiaSeverity.SEVERE]: 3
    };
    
    return severityValues[current] >= severityValues[toAdd] 
      ? current 
      : toAdd;
  }

  reset(): void {
    this.rrIntervals = [];
    this.lastAnalysis = null;
    this.consecutiveAnomalies = 0;
    this.hrvAnalyzer.reset();
    console.log("ArrhythmiaDetector: Reset completo");
  }

  getLastAnalysis(): ArrhythmiaAnalysis | null {
    return this.lastAnalysis;
  }
}
