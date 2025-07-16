import { ProcessedSignal, ProcessingError } from '../types/signal';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * Validador y reparador automático de la cadena de callbacks
 * Asegura que los callbacks estén siempre funcionando correctamente
 */
export class CallbackChainValidator {
  private logger = DiagnosticLogger.getInstance();
  private lastCallbackExecution = 0;
  private callbackTimeoutMs = 5000; // 5 segundos sin callback = problema
  private repairAttempts = 0;
  private maxRepairAttempts = 3;
  
  /**
   * Validar que un procesador tenga callbacks válidos
   */
  validateProcessor(processor: any): {
    isValid: boolean;
    issues: string[];
    repaired: boolean;
  } {
    const issues: string[] = [];
    let repaired = false;
    
    // Verificar onSignalReady
    if (!processor.onSignalReady || typeof processor.onSignalReady !== 'function') {
      issues.push('onSignalReady callback missing or invalid');
      
      if (this.repairAttempts < this.maxRepairAttempts) {
        processor.onSignalReady = this.createEmergencySignalCallback();
        repaired = true;
        this.repairAttempts++;
        
        this.logger.warn('CallbackChainValidator', 'Repaired missing onSignalReady callback', {
          repairAttempt: this.repairAttempts
        });
      }
    }
    
    // Verificar onError
    if (!processor.onError || typeof processor.onError !== 'function') {
      issues.push('onError callback missing or invalid');
      
      if (this.repairAttempts < this.maxRepairAttempts) {
        processor.onError = this.createEmergencyErrorCallback();
        repaired = true;
        this.repairAttempts++;
        
        this.logger.warn('CallbackChainValidator', 'Repaired missing onError callback', {
          repairAttempt: this.repairAttempts
        });
      }
    }
    
    const isValid = issues.length === 0;
    
    this.logger.info('CallbackChainValidator', 'Processor validation completed', {
      isValid,
      issues,
      repaired,
      repairAttempts: this.repairAttempts
    });
    
    return { isValid, issues, repaired };
  }
  
  /**
   * Monitorear la ejecución de callbacks y detectar problemas
   */
  monitorCallbackExecution(): void {
    const now = Date.now();
    
    if (this.lastCallbackExecution > 0 && 
        now - this.lastCallbackExecution > this.callbackTimeoutMs) {
      
      this.logger.error('CallbackChainValidator', 'Callback execution timeout detected', {
        timeSinceLastExecution: now - this.lastCallbackExecution,
        timeoutThreshold: this.callbackTimeoutMs
      });
      
      // Intentar reparación automática
      this.attemptAutomaticRepair();
    }
  }
  
  /**
   * Registrar ejecución exitosa de callback
   */
  recordCallbackExecution(): void {
    this.lastCallbackExecution = Date.now();
  }
  
  /**
   * Crear callback de emergencia para onSignalReady
   */
  private createEmergencySignalCallback(): (signal: ProcessedSignal) => void {
    return (signal: ProcessedSignal) => {
      this.recordCallbackExecution();
      
      this.logger.warn('CallbackChainValidator', 'Emergency signal callback executed', {
        signal: {
          timestamp: new Date(signal.timestamp).toISOString(),
          fingerDetected: signal.fingerDetected,
          quality: signal.quality,
          rawValue: signal.rawValue,
          filteredValue: signal.filteredValue
        }
      });
      
      // Intentar notificar al sistema principal
      this.notifyEmergencySignal(signal);
    };
  }
  
  /**
   * Crear callback de emergencia para onError
   */
  private createEmergencyErrorCallback(): (error: ProcessingError) => void {
    return (error: ProcessingError) => {
      this.logger.error('CallbackChainValidator', 'Emergency error callback executed', {
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date(error.timestamp).toISOString()
        }
      });
      
      // Intentar notificar al sistema principal
      this.notifyEmergencyError(error);
    };
  }
  
  /**
   * Intentar reparación automática del sistema
   */
  private attemptAutomaticRepair(): void {
    if (this.repairAttempts >= this.maxRepairAttempts) {
      this.logger.critical('CallbackChainValidator', 'Maximum repair attempts reached', {
        repairAttempts: this.repairAttempts,
        maxAttempts: this.maxRepairAttempts
      });
      return;
    }
    
    this.logger.info('CallbackChainValidator', 'Attempting automatic repair', {
      repairAttempt: this.repairAttempts + 1
    });
    
    // Resetear contador de tiempo
    this.lastCallbackExecution = Date.now();
    
    // Incrementar intentos de reparación
    this.repairAttempts++;
    
    // Notificar que se necesita reinicialización
    this.notifyRepairNeeded();
  }
  
  /**
   * Notificar señal de emergencia al sistema principal
   */
  private notifyEmergencySignal(signal: ProcessedSignal): void {
    // Intentar usar eventos del DOM para comunicación
    try {
      const event = new CustomEvent('emergencySignal', {
        detail: signal
      });
      window.dispatchEvent(event);
    } catch (error) {
      this.logger.error('CallbackChainValidator', 'Failed to notify emergency signal', error);
    }
  }
  
  /**
   * Notificar error de emergencia al sistema principal
   */
  private notifyEmergencyError(error: ProcessingError): void {
    try {
      const event = new CustomEvent('emergencyError', {
        detail: error
      });
      window.dispatchEvent(event);
    } catch (err) {
      this.logger.error('CallbackChainValidator', 'Failed to notify emergency error', err);
    }
  }
  
  /**
   * Notificar que se necesita reparación
   */
  private notifyRepairNeeded(): void {
    try {
      const event = new CustomEvent('callbackRepairNeeded', {
        detail: {
          repairAttempts: this.repairAttempts,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      this.logger.error('CallbackChainValidator', 'Failed to notify repair needed', error);
    }
  }
  
  /**
   * Resetear el validador
   */
  reset(): void {
    this.lastCallbackExecution = 0;
    this.repairAttempts = 0;
    this.logger.info('CallbackChainValidator', 'Validator reset');
  }
  
  /**
   * Obtener estadísticas del validador
   */
  getStats(): {
    lastCallbackExecution: number;
    repairAttempts: number;
    isHealthy: boolean;
  } {
    const now = Date.now();
    const isHealthy = this.lastCallbackExecution === 0 || 
                     (now - this.lastCallbackExecution) < this.callbackTimeoutMs;
    
    return {
      lastCallbackExecution: this.lastCallbackExecution,
      repairAttempts: this.repairAttempts,
      isHealthy
    };
  }
}