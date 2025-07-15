/**
 * Tipos e interfaces para procesamiento de imagen en tiempo real
 */

export interface ColorChannels {
  red: number[];
  green: number[];
  blue: number[];
  alpha?: number[];
  // Canales derivados
  luminance: number[];
  chrominanceU: number[];
  chrominanceV: number[];
}

export interface OpticalDensity {
  redOD: number[];
  greenOD: number[];
  blueOD: number[];
  averageOD: number;
  odRatio: number; // Ratio para análisis espectral
}

export interface FingerDetection {
  isPresent: boolean;
  confidence: number;
  coverage: number; // Porcentaje de área cubierta
  textureScore: number;
  edgeScore: number;
  colorConsistency: number;
  quality: number;
  area: number;
  position: { x: number; y: number; width: number; height: number };
}

export interface QualityMetrics {
  snr: number; // Signal-to-Noise Ratio
  contrast: number;
  sharpness: number;
  illumination: number;
  stability: number;
  overallQuality: number; // Score compuesto 0-100
}

export interface ProcessedFrame {
  timestamp: number;
  colorChannels: ColorChannels;
  opticalDensity: OpticalDensity;
  fingerDetection: FingerDetection;
  qualityMetrics: QualityMetrics;
  stabilizationOffset: { x: number; y: number };
  frameId: string;
}

export interface ImageProcessingConfig {
  roiSize: { width: number; height: number };
  roiPosition: { x: number; y: number };
  enableStabilization: boolean;
  qualityThreshold: number;
  textureAnalysisDepth: number;
  colorSpaceConversion: 'RGB' | 'XYZ' | 'Lab' | 'YUV';
}

export interface GLCMFeatures {
  contrast: number;
  homogeneity: number;
  energy: number;
  correlation: number;
  entropy: number;
}

export interface EdgeDetectionResult {
  magnitude: number[];
  direction: number[];
  maxMagnitude: number;
  averageMagnitude: number;
}

export interface ColorSpaceTransform {
  transform: (r: number, g: number, b: number) => { x: number; y: number; z: number };
  inverse: (x: number, y: number, z: number) => { r: number; g: number; b: number };
}

export interface StabilizationResult {
  imageData: ImageData;
  offset: { x: number; y: number };
  confidence: number;
  method: 'lucas-kanade' | 'cross-correlation' | 'phase-correlation';
}

export interface TextureAnalysisResult {
  glcmFeatures: GLCMFeatures;
  localBinaryPattern: number[];
  textureEnergy: number;
  textureHomogeneity: number;
  overallTextureScore: number;
}

export interface SkinDetectionResult {
  isSkin: boolean;
  confidence: number;
  colorModel: 'rgb' | 'hsv' | 'ycbcr';
  skinPixelRatio: number;
}

export interface ImageProcessingError {
  code: 'INVALID_IMAGE_DATA' | 'PROCESSING_FAILED' | 'INSUFFICIENT_QUALITY' | 'CONFIGURATION_ERROR';
  message: string;
  timestamp: number;
  frameId?: string;
}

export interface ProcessingPerformanceMetrics {
  frameProcessingTime: number;
  averageProcessingTime: number;
  framesPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
}