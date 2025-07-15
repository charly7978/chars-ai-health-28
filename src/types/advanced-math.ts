/**
 * Tipos e interfaces para el motor de matemáticas avanzadas
 */

export interface FrequencySpectrum {
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
  dominantFrequency: number;
  harmonics: number[];
  spectralPurity: number;
  snr: number;
  powerSpectralDensity: number[];
}

export interface KalmanState {
  state: number[];
  covariance: number[][];
  prediction: number[];
  innovation: number[];
  kalmanGain: number[][];
}

export interface SavitzkyGolayConfig {
  windowSize: number;
  polynomialOrder: number;
  derivative: number;
}

export interface PCAResult {
  eigenValues: number[];
  eigenVectors: number[][];
  principalComponents: number[][];
  explainedVariance: number[];
  cumulativeVariance: number[];
  transformedData: number[][];
}

export interface Peak {
  index: number;
  value: number;
  prominence: number;
  width: number;
  leftBase: number;
  rightBase: number;
  snr: number;
  isPhysiological: boolean;
}

export interface AdvancedMathConfig {
  fftWindowType: 'rectangular' | 'hanning' | 'hamming' | 'blackman';
  kalmanProcessNoise: number;
  kalmanMeasurementNoise: number;
  peakDetectionThreshold: number;
  physiologicalRange: { min: number; max: number };
  spectralAnalysisDepth: number;
}

export interface MathEngineStatistics {
  kalmanStatesCount: number;
  activeFilters: string[];
  memoryUsage: number;
  processingTime: number;
  algorithmsUsed: string[];
}

export interface ComplexNumber {
  real: number;
  imag: number;
}

export interface WindowFunction {
  type: 'rectangular' | 'hanning' | 'hamming' | 'blackman' | 'kaiser';
  parameters?: { [key: string]: number };
}

export interface FilterResponse {
  frequencies: number[];
  magnitude: number[];
  phase: number[];
  groupDelay: number[];
}

export interface SignalQualityMetrics {
  snr: number;
  thd: number; // Total Harmonic Distortion
  coherence: number;
  stationarity: number;
  entropy: number;
}

export interface MathEngineError {
  code: 'INVALID_INPUT' | 'COMPUTATION_FAILED' | 'MEMORY_ERROR' | 'CONVERGENCE_FAILED';
  message: string;
  timestamp: number;
  algorithm: string;
}

export interface PerformanceMetrics {
  algorithmName: string;
  executionTime: number;
  memoryUsed: number;
  inputSize: number;
  complexity: 'O(n)' | 'O(n log n)' | 'O(n²)' | 'O(n³)';
}