export enum ArrhythmiaSeverity {
  NONE = 'NONE',
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE'
}

export enum ArrhythmiaType {
  NONE = 'NONE',
  SINUS_BRADYCARDIA = 'SINUS_BRADYCARDIA',
  SINUS_TACHYCARDIA = 'SINUS_TACHYCARDIA',
  ATRIAL_FIBRILLATION = 'ATRIAL_FIBRILLATION',
  SINUS_ARRHYTHMIA = 'SINUS_ARRHYTHMIA',
  PVC = 'PVC'
}

export interface HRVMetrics {
  rmssd: number;
  sdnn: number;
  pnn50: number;
  lfhfRatio: number;
  entropy: number;
}

export interface ArrhythmiaAnalysis {
  hasArrhythmia: boolean;
  type: ArrhythmiaType;
  severity: ArrhythmiaSeverity;
  confidence: number;
  riskScore: number;
  rmssd: number;
  sdnn: number;
  pnn50: number;
  lfhfRatio: number;
  entropy: number;
  status?: string;
  risk?: string;
  metrics?: HRVMetrics;
}

export interface ColorData {
  r: number;
  g: number;
  b: number;
  confidence: number;
}

export interface VitalSigns {
  spo2: number;
  heartRate: number;
  arrhythmiaStatus: string;
}
