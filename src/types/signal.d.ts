import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;
  apneaStatus?: {
    isDetected: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    count: number;
  };
  concussionStatus?: {
    score: number;
    pupilResponseTime: number;
    pupilSize: number;
  };
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

export interface SignalProcessor {
  initialize: () => Promise<void>;
  start: () => void;
  stop: () => void;
  calibrate: () => Promise<boolean>;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}

// Nuevas interfaces para las características específicas
export interface ApneaDetectionResult {
  isDetected: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  count: number;
  breathingPattern: number[];
}

export interface ConcussionDetectionResult {
  score: number;
  pupilResponseTime: number;
  pupilSize: number;
  lightResponse: number;
  symmetry: number;
}
