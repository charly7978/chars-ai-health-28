import { CallbackValidationResult } from '../types/diagnostics';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * Herramienta para diagnosticar problemas en la cadena de callbacks
 * Verifica que todos los callbacks estén correctamente configurados
 */
export class CallbackDiagnostics {
  private logger = DiagnosticLogger.getInstance();
  private callbackExecutions: Map<string, number> = new Map();
  private lastExecutionTimes: Map<string, number> = new Map();
  
  /**
   * Validar que un callback esté definido y sea función
   */
  validateCallback(name: string, callback: any): boolean {
    const isValid = typeof callback === 'function';
    
    this.logger.debug('CallbackDiagnostics', `Validating callback: ${name}`, {
      name,
      isValid,
      type: typeof callback,
      isDefined: callback !== undefined && callback !== null
    });
    
    if (!isValid) {
      this.logger.error('CallbackDiagnostics', `Invalid callback: ${name}`, {
        name,
        type: typeof callback,
        value: callback
      });
    }
    
    return isValid;
  }
  
  /**
   * Registrar ejecución de callback
   */
  recordCallbackExecution(name: string, success: boolean, data?: any): void {
    const timestamp = Date.now();
    const currentCount = this.callbackExecutions.get(name) || 0;
    
    this.callbackExecutions.set(name, currentCount + 1);
    this.lastExecutionTimes.set(name, timestamp);
    
    this.logger.callback(name, success, {
      executionCount: currentCount + 1,
      timestamp,
      data
    });
    
    if (!success) {
      this.logger.error('CallbackDiagnostics', `Callback execution failed: ${name}`, data);
    }
  }
  
  /**
   * Validar cadena completa de callbacks
   */
  validateCallbackChain(callbacks: Record<string, any>): CallbackValidationResult {
    const timestamp = Date.now();
    const missingCallbacks: string[] = [];
    const validCallbacks: string[] = [];
    
    Object.entries(callbacks).forEach(([name, callback]) => {
      if (this.validateCallback(name, callback)) {
        validCallbacks.push(name);
      } else {
        missingCallbacks.push(name);
      }
    });
    
    const isValid = missingCallbacks.length === 0;
    
    this.logger.info('CallbackDiagnostics', 'Callback chain validation completed', {
      isValid,
      validCallbacks,
      missingCallbacks,
      totalCallbacks: Object.keys(callbacks).length
    });
    
    return {
      isValid,
      missingCallbacks,
      validCallbacks,
      timestamp
    };
  }
  
  /**
   * Obtener estadísticas de ejecución de callbacks
   */
  getExecutionStats(): Record<string, { count: number; lastExecution: number }> {
    const stats: Record<string, { count: number; lastExecution: number }> = {};
    
    this.callbackExecutions.forEach((count, name) => {
      stats[name] = {
        count,
        lastExecution: this.lastExecutionTimes.get(name) || 0
      };
    });
    
    return stats;
  }
  
  /**
   * Detectar callbacks que no se han ejecutado recientemente
   */
  detectStaleCallbacks(timeoutMs: number = 5000): string[] {
    const now = Date.now();
    const staleCallbacks: string[] = [];
    
    this.lastExecutionTimes.forEach((lastTime, name) => {
      if (now - lastTime > timeoutMs) {
        staleCallbacks.push(name);
      }
    });
    
    if (staleCallbacks.length > 0) {
      this.logger.warn('CallbackDiagnostics', 'Stale callbacks detected', {
        staleCallbacks,
        timeoutMs
      });
    }
    
    return staleCallbacks;
  }
  
  /**
   * Crear callback wrapper para diagnóstico automático
   */
  wrapCallback<T extends (...args: any[]) => any>(
    name: string, 
    originalCallback: T
  ): T {
    return ((...args: any[]) => {
      try {
        this.logger.debug('CallbackDiagnostics', `Executing callback: ${name}`, {
          name,
          argsCount: args.length
        });
        
        const result = originalCallback(...args);
        
        this.recordCallbackExecution(name, true, {
          argsCount: args.length,
          hasResult: result !== undefined
        });
        
        return result;
      } catch (error) {
        this.recordCallbackExecution(name, false, {
          error: error instanceof Error ? error.message : String(error),
          argsCount: args.length
        });
        
        this.logger.error('CallbackDiagnostics', `Callback execution error: ${name}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        throw error;
      }
    }) as T;
  }
  
  /**
   * Resetear estadísticas
   */
  reset(): void {
    this.callbackExecutions.clear();
    this.lastExecutionTimes.clear();
    this.logger.info('CallbackDiagnostics', 'Callback diagnostics reset');
  }
}