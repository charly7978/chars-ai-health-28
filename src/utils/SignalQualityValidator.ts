import { DiagnosticLogger } from './DiagnosticLogger';
import { ProcessedSignal } from '../types/signal';

/**
 * Validador de calidad de señales PPG
 * Verifica que las señales sean procesables y proporciona feedback
 */
export class SignalQualityValidator {
  private logger = DiagnosticLogger.getInstance();
  private signalHistory: number[] = [];
  private qualityHistory: number[] = [];
  private maxHistorySize = 50;
  
  // Umbrales de validación
  private readonly MIN_SIGNAL_VALUE = 0;
  private readonly MAX_SIGNAL_VALUE = 255;
  private readonly MIN_QUALITY_THRESHOLD = 10;
  private readonly GOOD_QUALITY_THRESHOLD = 50;
  private readonly SIGNAL_VARIANCE_THRESHOLD = 5;
  
  /**
   * Validar una señal PPG procesada
   */
  validateSignal(signal: ProcessedSignal): {
    isValid: boolean;
    issues: string[];
    quality: 'poor' | 'fair' | 'good' | 'excellent';
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Validar valores básicos
    if (signal.rawValue < this.MIN_SIGNAL_VALUE || signal.rawValue > this.MAX_SIGNAL_VALUE) {
      issues.push(`Raw value out of range: ${signal.rawValue}`);
      suggestions.push('Verificar iluminación y posición del dedo');
    }
    
    if (signal.filteredValue < this.MIN_SIGNAL_VALUE || signal.filteredValue > this.MAX_SIGNAL_VALUE) {
      issues.push(`Filtered value out of range: ${signal.filteredValue}`);
      suggestions.push('Revisar filtros de procesamiento');
    }
    
    // Validar calidad
    if (signal.quality < this.MIN_QUALITY_THRESHOLD) {
      issues.push(`Quality too low: ${signal.quality}`);
      suggestions.push('Mejorar contacto del dedo con la cámara');
    }
    
    // Validar detección de dedo
    if (!signal.fingerDetected && signal.quality > this.MIN_QUALITY_THRESHOLD) {
      issues.push('Good signal quality but no finger detected');
      suggestions.push('Revisar algoritmo de detección de dedo');
    }
    
    // Validar perfusion index
    if (signal.perfusionIndex !== undefined && signal.perfusionIndex < 0.1) {
      issues.push(`Low perfusion index: ${signal.perfusionIndex}`);
      suggestions.push('Asegurar buena circulación sanguínea');
    }
    
    // Actualizar historial
    this.updateHistory(signal);
    
    // Validar consistencia temporal
    const temporalIssues = this.validateTemporalConsistency();
    issues.push(...temporalIssues.issues);
    suggestions.push(...temporalIssues.suggestions);
    
    // Determinar calidad general
    const quality = this.determineOverallQuality(signal, issues.length);
    
    const isValid = issues.length === 0 || (issues.length <= 2 && signal.quality >= this.MIN_QUALITY_THRESHOLD);
    
    this.logger.debug('SignalQualityValidator', 'Signal validation completed', {
      isValid,
      quality,
      issueCount: issues.length,
      signalQuality: signal.quality,
      fingerDetected: signal.fingerDetected
    });
    
    if (!isValid) {
      this.logger.warn('SignalQualityValidator', 'Signal validation failed', {
        issues,
        signal: {
          rawValue: signal.rawValue,
          filteredValue: signal.filteredValue,
          quality: signal.quality,
          fingerDetected: signal.fingerDetected
        }
      });
    }
    
    return {
      isValid,
      issues,
      quality,
      suggestions
    };
  }
  
  /**
   * Validar que los valores de señal no sean completamente nulos
   */
  validateNonNullSignal(rawValue: number, filteredValue: number): boolean {
    const isNonNull = rawValue > 0 || filteredValue > 0;
    
    if (!isNonNull) {
      this.logger.error('SignalQualityValidator', 'Null signal detected', {
        rawValue,
        filteredValue
      });
    }
    
    return isNonNull;
  }
  
  /**
   * Validar rango fisiológico de la señal
   */
  validatePhysiologicalRange(signal: ProcessedSignal): boolean {
    // Rangos típicos para señales PPG
    const MIN_PHYSIOLOGICAL = 10;
    const MAX_PHYSIOLOGICAL = 200;
    
    const inRange = signal.filteredValue >= MIN_PHYSIOLOGICAL && 
                   signal.filteredValue <= MAX_PHYSIOLOGICAL;
    
    if (!inRange) {
      this.logger.warn('SignalQualityValidator', 'Signal outside physiological range', {
        filteredValue: signal.filteredValue,
        minRange: MIN_PHYSIOLOGICAL,
        maxRange: MAX_PHYSIOLOGICAL
      });
    }
    
    return inRange;
  }
  
  /**
   * Detectar artefactos en la señal
   */
  detectArtifacts(signal: ProcessedSignal): {
    hasArtifacts: boolean;
    artifactTypes: string[];
  } {
    const artifactTypes: string[] = [];
    
    // Detectar cambios bruscos
    if (this.signalHistory.length > 0) {
      const lastSignal = this.signalHistory[this.signalHistory.length - 1];
      const change = Math.abs(signal.filteredValue - lastSignal);
      
      if (change > 50) { // Cambio muy brusco
        artifactTypes.push('sudden_change');
      }
    }
    
    // Detectar señal plana (sin variación)
    if (this.signalHistory.length >= 10) {
      const recentSignals = this.signalHistory.slice(-10);
      const variance = this.calculateVariance(recentSignals);
      
      if (variance < this.SIGNAL_VARIANCE_THRESHOLD) {
        artifactTypes.push('flat_signal');
      }
    }
    
    // Detectar saturación
    if (signal.rawValue >= 250 || signal.filteredValue >= 250) {
      artifactTypes.push('saturation');
    }
    
    const hasArtifacts = artifactTypes.length > 0;
    
    if (hasArtifacts) {
      this.logger.warn('SignalQualityValidator', 'Signal artifacts detected', {
        artifactTypes,
        signalValue: signal.filteredValue
      });
    }
    
    return {
      hasArtifacts,
      artifactTypes
    };
  }
  
  /**
   * Obtener estadísticas de calidad recientes
   */
  getQualityStats(): {
    averageQuality: number;
    qualityTrend: 'improving' | 'stable' | 'declining';
    consistencyScore: number;
  } {
    if (this.qualityHistory.length === 0) {
      return {
        averageQuality: 0,
        qualityTrend: 'stable',
        consistencyScore: 0
      };
    }
    
    const averageQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
    
    // Calcular tendencia
    let qualityTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (this.qualityHistory.length >= 10) {
      const firstHalf = this.qualityHistory.slice(0, 5);
      const secondHalf = this.qualityHistory.slice(-5);
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 5) {
        qualityTrend = 'improving';
      } else if (secondAvg < firstAvg - 5) {
        qualityTrend = 'declining';
      }
    }
    
    // Calcular consistencia
    const variance = this.calculateVariance(this.qualityHistory);
    const consistencyScore = Math.max(0, 100 - variance);
    
    return {
      averageQuality: Math.round(averageQuality),
      qualityTrend,
      consistencyScore: Math.round(consistencyScore)
    };
  }
  
  private updateHistory(signal: ProcessedSignal): void {
    this.signalHistory.push(signal.filteredValue);
    this.qualityHistory.push(signal.quality);
    
    // Mantener tamaño limitado
    if (this.signalHistory.length > this.maxHistorySize) {
      this.signalHistory.shift();
    }
    if (this.qualityHistory.length > this.maxHistorySize) {
      this.qualityHistory.shift();
    }
  }
  
  private validateTemporalConsistency(): {
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    if (this.signalHistory.length < 5) {
      return { issues, suggestions };
    }
    
    // Verificar variabilidad excesiva
    const recentSignals = this.signalHistory.slice(-5);
    const variance = this.calculateVariance(recentSignals);
    
    if (variance > 100) {
      issues.push('High signal variability detected');
      suggestions.push('Mantener el dedo estable sobre la cámara');
    }
    
    // Verificar tendencia de calidad
    const recentQuality = this.qualityHistory.slice(-5);
    const qualityTrend = recentQuality[recentQuality.length - 1] - recentQuality[0];
    
    if (qualityTrend < -20) {
      issues.push('Quality declining rapidly');
      suggestions.push('Verificar posición del dedo y limpieza de la cámara');
    }
    
    return { issues, suggestions };
  }
  
  private determineOverallQuality(signal: ProcessedSignal, issueCount: number): 'poor' | 'fair' | 'good' | 'excellent' {
    if (issueCount > 3 || signal.quality < 20) {
      return 'poor';
    } else if (issueCount > 1 || signal.quality < 40) {
      return 'fair';
    } else if (signal.quality < 70) {
      return 'good';
    } else {
      return 'excellent';
    }
  }
  
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * Resetear historial
   */
  reset(): void {
    this.signalHistory = [];
    this.qualityHistory = [];
    this.logger.info('SignalQualityValidator', 'Signal quality validator reset');
  }
}