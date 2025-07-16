import { ProcessingMetrics, DevicePerformanceMetrics } from '../types/diagnostics';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * Monitor para el rendimiento del procesamiento de frames
 * Mide FPS, latencia y detecta frames perdidos
 */
export class FrameProcessingMonitor {
  private logger = DiagnosticLogger.getInstance();
  private frameTimestamps: number[] = [];
  private processingTimes: number[] = [];
  private callbackExecutions = 0;
  private errors: any[] = [];
  private lastFrameTime = 0;
  private targetFPS = 30;
  private maxHistorySize = 100;
  
  // Métricas de rendimiento
  private startTime = Date.now();
  private totalFrames = 0;
  private droppedFrames = 0;
  
  /**
   * Registrar inicio de procesamiento de frame
   */
  startFrameProcessing(): number {
    const timestamp = Date.now();
    this.frameTimestamps.push(timestamp);
    
    // Mantener historial limitado
    if (this.frameTimestamps.length > this.maxHistorySize) {
      this.frameTimestamps.shift();
    }
    
    this.totalFrames++;
    
    // Detectar frames perdidos
    if (this.lastFrameTime > 0) {
      const expectedInterval = 1000 / this.targetFPS;
      const actualInterval = timestamp - this.lastFrameTime;
      
      if (actualInterval > expectedInterval * 1.5) {
        this.droppedFrames++;
        this.logger.warn('FrameProcessingMonitor', 'Frame drop detected', {
          expectedInterval,
          actualInterval,
          droppedFrames: this.droppedFrames
        });
      }
    }
    
    this.lastFrameTime = timestamp;
    return timestamp;
  }
  
  /**
   * Registrar fin de procesamiento de frame
   */
  endFrameProcessing(startTimestamp: number, success: boolean = true): void {
    const endTime = Date.now();
    const processingTime = endTime - startTimestamp;
    
    this.processingTimes.push(processingTime);
    
    // Mantener historial limitado
    if (this.processingTimes.length > this.maxHistorySize) {
      this.processingTimes.shift();
    }
    
    if (success) {
      this.logger.debug('FrameProcessingMonitor', 'Frame processed successfully', {
        processingTime,
        timestamp: endTime
      });
    } else {
      this.logger.error('FrameProcessingMonitor', 'Frame processing failed', {
        processingTime,
        timestamp: endTime
      });
    }
    
    // Log métricas cada 30 frames
    if (this.totalFrames % 30 === 0) {
      this.logCurrentMetrics();
    }
  }
  
  /**
   * Registrar ejecución de callback
   */
  recordCallbackExecution(): void {
    this.callbackExecutions++;
    this.logger.debug('FrameProcessingMonitor', 'Callback executed', {
      totalExecutions: this.callbackExecutions
    });
  }
  
  /**
   * Registrar error
   */
  recordError(error: any): void {
    this.errors.push({
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Mantener historial limitado de errores
    if (this.errors.length > 50) {
      this.errors.shift();
    }
    
    this.logger.error('FrameProcessingMonitor', 'Processing error recorded', {
      error: error instanceof Error ? error.message : String(error),
      totalErrors: this.errors.length
    });
  }
  
  /**
   * Calcular FPS actual
   */
  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;
    
    const recentFrames = this.frameTimestamps.slice(-10); // Últimos 10 frames
    if (recentFrames.length < 2) return 0;
    
    const timeSpan = recentFrames[recentFrames.length - 1] - recentFrames[0];
    const fps = ((recentFrames.length - 1) * 1000) / timeSpan;
    
    return Math.round(fps * 10) / 10; // Redondear a 1 decimal
  }
  
  /**
   * Calcular latencia promedio
   */
  getAverageLatency(): number {
    if (this.processingTimes.length === 0) return 0;
    
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.processingTimes.length) * 10) / 10;
  }
  
  /**
   * Obtener métricas completas
   */
  getMetrics(): ProcessingMetrics {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    return {
      framesProcessed: this.totalFrames,
      framesPerSecond: this.getCurrentFPS(),
      averageProcessingTime: this.getAverageLatency(),
      signalQuality: 0, // Se actualizará desde el procesador de señales
      callbackExecutions: this.callbackExecutions,
      errors: this.errors.map(e => ({
        timestamp: e.timestamp,
        component: 'FrameProcessor',
        status: 'error' as const,
        message: e.error,
        data: e.stack
      })),
      lastFrameTimestamp: this.lastFrameTime,
      processingLatency: this.getAverageLatency()
    };
  }
  
  /**
   * Obtener métricas de rendimiento del dispositivo
   */
  getDeviceMetrics(): DevicePerformanceMetrics {
    const fps = this.getCurrentFPS();
    const frameDropRate = this.totalFrames > 0 ? (this.droppedFrames / this.totalFrames) * 100 : 0;
    
    return {
      cpuUsage: this.estimateCPUUsage(),
      memoryUsage: this.estimateMemoryUsage(),
      frameDropRate,
      averageLatency: this.getAverageLatency(),
      batteryLevel: this.getBatteryLevel()
    };
  }
  
  /**
   * Detectar si el rendimiento es bajo
   */
  isPerformanceLow(): boolean {
    const fps = this.getCurrentFPS();
    const latency = this.getAverageLatency();
    const frameDropRate = this.totalFrames > 0 ? (this.droppedFrames / this.totalFrames) * 100 : 0;
    
    const lowPerformance = fps < 15 || latency > 100 || frameDropRate > 10;
    
    if (lowPerformance) {
      this.logger.warn('FrameProcessingMonitor', 'Low performance detected', {
        fps,
        latency,
        frameDropRate
      });
    }
    
    return lowPerformance;
  }
  
  /**
   * Sugerir optimizaciones basadas en métricas
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const fps = this.getCurrentFPS();
    const latency = this.getAverageLatency();
    const frameDropRate = this.totalFrames > 0 ? (this.droppedFrames / this.totalFrames) * 100 : 0;
    
    if (fps < 15) {
      suggestions.push('Reducir FPS objetivo para mejorar estabilidad');
    }
    
    if (latency > 100) {
      suggestions.push('Optimizar algoritmos de procesamiento');
    }
    
    if (frameDropRate > 10) {
      suggestions.push('Implementar buffer de frames para suavizar procesamiento');
    }
    
    if (this.errors.length > 10) {
      suggestions.push('Revisar manejo de errores en procesamiento');
    }
    
    return suggestions;
  }
  
  private logCurrentMetrics(): void {
    const metrics = this.getMetrics();
    this.logger.performance('FrameProcessingMonitor', metrics);
  }
  
  private estimateCPUUsage(): number {
    // Estimación basada en latencia de procesamiento
    const avgLatency = this.getAverageLatency();
    const expectedLatency = 1000 / this.targetFPS;
    
    return Math.min(100, (avgLatency / expectedLatency) * 50);
  }
  
  private estimateMemoryUsage(): number {
    // Estimación basada en historial mantenido
    const baseUsage = 10; // MB base
    const historyUsage = (this.frameTimestamps.length + this.processingTimes.length) * 0.001;
    
    return baseUsage + historyUsage;
  }
  
  private getBatteryLevel(): number | undefined {
    // Intentar obtener nivel de batería si está disponible
    if ('getBattery' in navigator) {
      // Esta API está deprecated pero puede estar disponible
      return undefined;
    }
    return undefined;
  }
  
  /**
   * Resetear métricas
   */
  reset(): void {
    this.frameTimestamps = [];
    this.processingTimes = [];
    this.callbackExecutions = 0;
    this.errors = [];
    this.lastFrameTime = 0;
    this.startTime = Date.now();
    this.totalFrames = 0;
    this.droppedFrames = 0;
    
    this.logger.info('FrameProcessingMonitor', 'Metrics reset');
  }
  
  /**
   * Configurar FPS objetivo
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.logger.info('FrameProcessingMonitor', `Target FPS set to ${fps}`);
  }
}