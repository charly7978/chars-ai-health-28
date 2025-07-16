import { DiagnosticEvent, DiagnosticLevel, DiagnosticInfo } from '../types/diagnostics';

/**
 * Sistema de logging avanzado para diagnóstico del flujo de medición
 * Proporciona logging estructurado con diferentes niveles de severidad
 */
export class DiagnosticLogger {
  private static instance: DiagnosticLogger;
  private events: DiagnosticEvent[] = [];
  private maxEvents = 1000; // Limitar memoria
  private isEnabled = true;
  private logToConsole = true;
  
  private constructor() {}
  
  static getInstance(): DiagnosticLogger {
    if (!DiagnosticLogger.instance) {
      DiagnosticLogger.instance = new DiagnosticLogger();
    }
    return DiagnosticLogger.instance;
  }
  
  /**
   * Log de debug - información detallada para desarrollo
   */
  debug(component: string, message: string, data?: any): void {
    this.log('debug', component, message, data);
  }
  
  /**
   * Log de información - eventos normales del sistema
   */
  info(component: string, message: string, data?: any): void {
    this.log('info', component, message, data);
  }
  
  /**
   * Log de advertencia - situaciones que requieren atención
   */
  warn(component: string, message: string, data?: any): void {
    this.log('warn', component, message, data);
  }
  
  /**
   * Log de error - errores que afectan funcionalidad
   */
  error(component: string, message: string, data?: any): void {
    this.log('error', component, message, data, new Error().stack);
  }
  
  /**
   * Log crítico - errores que impiden el funcionamiento
   */
  critical(component: string, message: string, data?: any): void {
    this.log('critical', component, message, data, new Error().stack);
  }
  
  /**
   * Log específico para flujo de señales PPG
   */
  signalFlow(step: string, success: boolean, data?: any, error?: string): void {
    this.log('info', 'SignalFlow', `${step}: ${success ? 'SUCCESS' : 'FAILED'}`, {
      step,
      success,
      data,
      error
    });
  }
  
  /**
   * Log específico para callbacks
   */
  callback(callbackName: string, executed: boolean, data?: any): void {
    this.log(executed ? 'info' : 'error', 'Callback', `${callbackName}: ${executed ? 'EXECUTED' : 'FAILED'}`, {
      callbackName,
      executed,
      data
    });
  }
  
  /**
   * Log específico para métricas de rendimiento
   */
  performance(component: string, metrics: any): void {
    this.log('info', 'Performance', `${component} metrics`, metrics);
  }
  
  private log(level: DiagnosticLevel, component: string, message: string, data?: any, stackTrace?: string): void {
    if (!this.isEnabled) return;
    
    const event: DiagnosticEvent = {
      id: this.generateId(),
      level,
      component,
      message,
      timestamp: Date.now(),
      data,
      stackTrace
    };
    
    // Añadir al buffer
    this.events.push(event);
    
    // Mantener límite de memoria
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // Log a consola si está habilitado
    if (this.logToConsole) {
      this.logToConsoleFormatted(event);
    }
  }
  
  private logToConsoleFormatted(event: DiagnosticEvent): void {
    const timestamp = new Date(event.timestamp).toISOString();
    const prefix = `[${timestamp}] [${event.level.toUpperCase()}] [${event.component}]`;
    
    switch (event.level) {
      case 'debug':
        console.debug(`${prefix} ${event.message}`, event.data || '');
        break;
      case 'info':
        console.info(`${prefix} ${event.message}`, event.data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${event.message}`, event.data || '');
        break;
      case 'error':
      case 'critical':
        console.error(`${prefix} ${event.message}`, event.data || '');
        if (event.stackTrace) {
          console.error('Stack trace:', event.stackTrace);
        }
        break;
    }
  }
  
  /**
   * Obtener eventos filtrados por nivel
   */
  getEvents(level?: DiagnosticLevel, component?: string, limit?: number): DiagnosticEvent[] {
    let filtered = this.events;
    
    if (level) {
      filtered = filtered.filter(e => e.level === level);
    }
    
    if (component) {
      filtered = filtered.filter(e => e.component === component);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }
  
  /**
   * Obtener resumen de eventos por componente
   */
  getSummary(): Record<string, { total: number; errors: number; warnings: number }> {
    const summary: Record<string, { total: number; errors: number; warnings: number }> = {};
    
    this.events.forEach(event => {
      if (!summary[event.component]) {
        summary[event.component] = { total: 0, errors: 0, warnings: 0 };
      }
      
      summary[event.component].total++;
      
      if (event.level === 'error' || event.level === 'critical') {
        summary[event.component].errors++;
      } else if (event.level === 'warn') {
        summary[event.component].warnings++;
      }
    });
    
    return summary;
  }
  
  /**
   * Exportar logs para análisis
   */
  exportLogs(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      events: this.events,
      summary: this.getSummary()
    }, null, 2);
  }
  
  /**
   * Limpiar logs
   */
  clear(): void {
    this.events = [];
  }
  
  /**
   * Configurar logger
   */
  configure(options: {
    enabled?: boolean;
    logToConsole?: boolean;
    maxEvents?: number;
  }): void {
    if (options.enabled !== undefined) this.isEnabled = options.enabled;
    if (options.logToConsole !== undefined) this.logToConsole = options.logToConsole;
    if (options.maxEvents !== undefined) this.maxEvents = options.maxEvents;
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}