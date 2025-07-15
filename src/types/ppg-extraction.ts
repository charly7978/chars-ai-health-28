/**
 * Tipos e interfaces para extracción de señales PPG
 */

export interface PPGSignal {
  red: number[];
  green: number[];
  blue: number[];
  infrared: number[]; // Simulado basado en análisis espectral
  timestamp: number[];
  samplingRate: number;
  // Componentes derivados
  acComponent: number[];
  dcComponent: number[];
  pulsatileIndex: number[];
  qualityIndex: number[];
}

export interface PulseWaveform {
  systolicPeak: number;
  dicroticNotch: number;
  diastolicPeak: number;
  pulseAmplitude: number;
  pulseWidth: number;
  riseTime: number;
  fallTime: number;
  augmentationIndex: number;
  reflectionIndex: number;
}

export interface SpectralAnalysis {
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
  dominantFrequency: number;
  harmonics: number[];
  spectralPurity: number;
  snr: number;
}

export interface PPGExtractionConfig {
  samplingRate: number;
  windowSize: number;
  overlapRatio: number;
  filterOrder: number;
  cutoffFrequencies: { low: number; high: number };
  spectralAnalysisDepth: number;
  qualityThreshold: number;
  enableAdaptiveFiltering: boolean;
}

export interface PPGExtractionResult {
  signal: PPGSignal;
  pulseWaveform: PulseWaveform | null;
  spectralAnalysis: SpectralAnalysis;
  qualityMetrics: {
    snr: number;
    perfusionIndex: number;
    signalQuality: number;
    artifactLevel: number;
  };
  timestamp: number;
  frameId: string;
}

export interface BeerLambertCoefficients {
  HbO2_RED: number;    // Oxihemoglobina a 660nm
  Hb_RED: number;      // Hemoglobina desoxigenada a 660nm
  HbO2_IR: number;     // Oxihemoglobina a 940nm
  Hb_IR: number;       // Hemoglobina desoxigenada a 940nm
}

export interface PhysiologicalRanges {
  HEART_RATE: { min: number; max: number };
  PERFUSION_INDEX: { min: number; max: number };
  AC_DC_RATIO: { min: number; max: number };
}

export interface CalibrationData {
  baselineIntensity: { red: number; green: number; blue: number };
  isCalibrated: boolean;
  calibrationFrames: number;
}

export interface PPGQualityMetrics {
  snr: number;
  perfusionIndex: number;
  signalQuality: number;
  artifactLevel: number;
  temporalStability: number;
  spectralCoherence: number;
}

export interface HemodynamicParameters {
  systolicBP: number;
  diastolicBP: number;
  meanArterialPressure: number;
  pulseWaveVelocity: number;
  augmentationIndex: number;
  reflectionCoefficient: number;
}

export interface PPGExtractionError {
  code: 'INSUFFICIENT_FRAMES' | 'CALIBRATION_FAILED' | 'SIGNAL_TOO_NOISY' | 'EXTRACTION_FAILED';
  message: string;
  timestamp: number;
  frameCount?: number;
}

export interface PPGStatistics {
  isCalibrated: boolean;
  calibrationProgress: number;
  signalBufferSize: number;
  frameHistorySize: number;
  lastSignalQuality: number;
  averageHeartRate: number;
  signalStability: number;
}