/**
 * Tipos e interfaces para el motor de matemáticas avanzadas
 */

export interface Complex {
  real: number;
  imag: number;
}

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

export interface Peak {
  index: number;
  value: number;
  prominence: number;
  width: number;
  leftBase: number;
  rightBase: number;
  isPhysiological: boolean;
}

export interface KalmanState {
  x: number[]; // Estado estimado
  P: number[][]; // Matriz de covarianza del error
  F: number[][]; // Matriz de transición de estado
  H: number[][]; // Matriz de observación
  Q: number[][]; // Ruido del proceso
  R: number[][]; // Ruido de medición
  K: number[][]; // Ganancia de Kalman
}

export interface PCAResult {
  eigenvalues: number[];
  eigenvectors: number[][];
  principalComponents: number[][];
  explainedVariance: number[];
  cumulativeVariance: number[];
  transformedData: number[][];
}

export interface SavitzkyGolayConfig {
  windowSize: number;
  polynomialOrder: number;
  derivative: number; // 0 = suavizado, 1 = primera derivada, 2 = segunda derivada
}

export interface MathEngineConfig {
  fftWindowType: 'rectangular' | 'hanning' | 'hamming' | 'blackman';
  kalmanProcessNoise: number;
  kalmanMeasurementNoise: number;
  peakDetectionMinDistance: number;
  peakDetectionMinHeight: number;
  physiologicalFreqRange: { min: number; max: number };
  samplingRate: number;
}

export interface FFTAnalysisOptions {
  windowType?: 'rectangular' | 'hanning' | 'hamming' | 'blackman';
  zeroPadding?: boolean;
  detrend?: boolean;
  normalize?: boolean;
}

export interface KalmanFilterOptions {
  processNoise?: number;
  measurementNoise?: number;
  initialState?: number[];
  initialCovariance?: number[][];
}

export interface PeakDetectionOptions {
  minHeight?: number;
  minDistance?: number;
  minProminence?: number;
  maxPeaks?: number;
  physiologicalValidation?: boolean;
}

export interface MathEngineStatistics {
  kalmanStatesCount: number;
  sgCoefficientsCount: number;
  fftCacheSize: number;
  memoryUsage: number;
  operationsCount: {
    fft: number;
    kalman: number;
    savitzkyGolay: number;
    pca: number;
    peakDetection: number;
  };
  averageProcessingTimes: {
    fft: number;
    kalman: number;
    savitzkyGolay: number;
    pca: number;
    peakDetection: number;
  };
}

export interface SignalQualityMetrics {
  snr: number;
  thd: number; // Total Harmonic Distortion
  coherence: number;
  stationarity: number;
  entropy: number;
}

export interface SpectralFeatures {
  centroidFrequency: number;
  spectralRolloff: number;
  spectralFlux: number;
  spectralFlatness: number;
  bandwidthFrequency: number;
}

export interface TimeSeriesFeatures {
  mean: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  entropy: number;
  autocorrelation: number[];
  crossCorrelation?: number[];
}

export interface WaveletTransformResult {
  coefficients: number[][];
  scales: number[];
  frequencies: number[];
  timeLocalization: number[];
  energyDistribution: number[][];
}

export interface FilterResponse {
  frequencies: number[];
  magnitude: number[];
  phase: number[];
  groupDelay: number[];
}

export interface MathEngineError {
  code: 'INVALID_INPUT' | 'COMPUTATION_ERROR' | 'MEMORY_ERROR' | 'CONFIGURATION_ERROR';
  message: string;
  timestamp: number;
  operation: string;
  parameters?: Record<string, any>;
}

export interface MatrixOperationResult {
  result: number[][];
  determinant?: number;
  rank?: number;
  condition?: number;
  eigenvalues?: number[];
  eigenvectors?: number[][];
}

export interface OptimizationResult {
  solution: number[];
  objectiveValue: number;
  iterations: number;
  converged: boolean;
  gradientNorm: number;
}

export interface InterpolationResult {
  interpolatedValues: number[];
  method: 'linear' | 'cubic' | 'spline' | 'polynomial';
  coefficients?: number[];
  error?: number;
}

export interface RegressionResult {
  coefficients: number[];
  rSquared: number;
  residuals: number[];
  standardError: number;
  pValues?: number[];
  confidenceIntervals?: Array<[number, number]>;
}

export interface ClusteringResult {
  labels: number[];
  centroids: number[][];
  inertia: number;
  silhouetteScore: number;
  iterations: number;
}

export interface DimensionalityReductionResult {
  transformedData: number[][];
  components: number[][];
  explainedVariance: number[];
  reconstruction: number[][];
  reconstructionError: number;
}

export interface AnomalyDetectionResult {
  anomalies: number[];
  scores: number[];
  threshold: number;
  method: 'isolation_forest' | 'one_class_svm' | 'local_outlier_factor';
}

export interface CrossValidationResult {
  scores: number[];
  meanScore: number;
  standardDeviation: number;
  folds: number;
  method: 'k_fold' | 'stratified' | 'time_series';
}

export interface FeatureSelectionResult {
  selectedFeatures: number[];
  scores: number[];
  ranking: number[];
  method: 'univariate' | 'recursive' | 'lasso' | 'mutual_info';
}

export interface ModelValidationResult {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  rocCurve?: { fpr: number[]; tpr: number[]; auc: number };
}

export interface TimeFrequencyAnalysis {
  timeAxis: number[];
  frequencyAxis: number[];
  spectrogram: number[][];
  instantaneousFrequency: number[];
  instantaneousAmplitude: number[];
}

export interface AdaptiveFilterResult {
  filteredSignal: number[];
  coefficients: number[][];
  error: number[];
  convergence: boolean;
  finalMSE: number;
}

export interface NonlinearAnalysisResult {
  lyapunovExponent: number;
  correlationDimension: number;
  entropy: number;
  recurrenceRate: number;
  deterministicChaos: boolean;
}