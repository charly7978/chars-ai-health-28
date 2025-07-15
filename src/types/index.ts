export interface ColorData {
  r: number;
  g: number;
  b: number;
}

export interface HRVMetrics {
  rmssd: number;
  sdnn: number;
  pnn50: number;
  lfhfRatio: number;
  entropy: number;
}

export interface ArrhythmiaAnalysis {
  status: 'normal' | 'abnormal';
  type: 'none' | 'atrial_fibrillation' | 'bradycardia' | 'tachycardia';
  severity: number;
  risk: number;
  metrics: HRVMetrics;
}

export interface VitalSigns {
  spo2: number;
  heartRate: number;
  arrhythmia: ArrhythmiaAnalysis | null;
}
