/**
 * Tipos para el sistema de diagnóstico de flujo de medición
 */

export interface DiagnosticInfo {
  timestamp: number;
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  data?: any;
  stackTrace?: string;
}

export interface ProcessingMetrics {
  framesProcessed: number;
  framesPerSecond: number;
  averageProcessingTime: number;
  signalQuality: number;
  callbackExecutions: number;
  errors: DiagnosticInfo[];
  lastFrameTimestamp: number;
  processingLatency: number;
}

export interface CallbackValidationResult {
  isValid: boolean;
  missingCallbacks: string[];
  validCallbacks: string[];
  timestamp: number;
}

export interface SignalFlowDiagnostic {
  step: string;
  timestamp: number;
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export interface DevicePerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  frameDropRate: number;
  averageLatency: number;
  batteryLevel?: number;
}

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface DiagnosticEvent {
  id: string;
  level: DiagnosticLevel;
  component: string;
  message: string;
  timestamp: number;
  data?: any;
  stackTrace?: string;
}