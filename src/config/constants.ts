/**
 * Configuración centralizada de constantes para el procesamiento de señales
 * 
 * Este archivo contiene todas las constantes de configuración utilizadas en la aplicación.
 * Las constantes están organizadas por funcionalidad para facilitar su mantenimiento.
 */

export const SIGNAL_PROCESSING = {
  // Configuración básica de procesamiento
  SAMPLE_RATE: 60,
  WINDOW_SIZE: 40,
  DEFAULT_WINDOW_SIZE: 40,
  
  // Límites fisiológicos
  MIN_BPM: 30,
  MAX_BPM: 220,
  DEFAULT_MIN_BPM: 40,
  DEFAULT_MAX_BPM: 200,
  
  // Umbrales de señal
  SIGNAL_THRESHOLD: 0.02,
  DEFAULT_SIGNAL_THRESHOLD: 0.02,
  MIN_CONFIDENCE: 0.30,
  DEFAULT_MIN_CONFIDENCE: 0.30,
  DERIVATIVE_THRESHOLD: -0.005,
  DEFAULT_DERIVATIVE_THRESHOLD: -0.005,
  
  // Tiempos de espera
  MIN_PEAK_TIME_MS: 300,
  DEFAULT_MIN_PEAK_TIME_MS: 300,
  WARMUP_TIME_MS: 1000,
  
  // Configuración de filtros
  MEDIAN_FILTER_WINDOW: 3,
  MOVING_AVERAGE_WINDOW: 3,
  EMA_ALPHA: 0.5,
  BASELINE_FACTOR: 0.8,
  
  // Tamaño de buffers
  SIGNAL_STRENGTH_HISTORY: 30,
  PEAK_VALIDATION_WINDOW: 5,
  
  // Factores de amplificación
  SIGNAL_BOOST_FACTOR: 1.8,
  PEAK_DETECTION_SENSITIVITY: 0.6,
  
  // Umbrales de calidad
  MIN_QUALITY_THRESHOLD: 10,
  MAX_QUALITY_THRESHOLD: 100,
  
  // Configuración adaptativa
  BPM_ALPHA: 0.3,
  ADAPTIVE_TUNING_LEARNING_RATE: 0.1,
  ADAPTIVE_TUNING_PEAK_WINDOW: 10,
  MIN_ADAPTIVE_SIGNAL_THRESHOLD: 0.01,
  MAX_ADAPTIVE_SIGNAL_THRESHOLD: 0.1,
  MIN_ADAPTIVE_MIN_CONFIDENCE: 0.2,
  MAX_ADAPTIVE_MIN_CONFIDENCE: 0.8,
  MIN_ADAPTIVE_DERIVATIVE_THRESHOLD: -0.1,
  MAX_ADAPTIVE_DERIVATIVE_THRESHOLD: -0.001,
  LOW_SIGNAL_THRESHOLD: 0.01,
  LOW_SIGNAL_FRAMES: 10
} as const;

export const AUDIO = {
  // Configuración de sonido
  BEEP_DURATION: 450,
  BEEP_VOLUME: 1.0,
  MIN_BEEP_INTERVAL_MS: 600,
  VIBRATION_PATTERN: [40, 20, 60] as const,
  
  // Frecuencias de sonido
  HEARTBEAT_FREQUENCY: 150,
  HEARTBEAT_SECOND_FREQUENCY: 120,
  ARRHYTHMIA_FREQUENCY: 440,
  
  // Tiempos de ataque/sostenimiento
  ATTACK_DURATION: 0.03,
  SUSTAIN_DURATION: 0.1,
  RELEASE_DURATION: 0.05
} as const;

export const DETECTION = {
  // Umbrales de detección
  MIN_SIGNAL_STRENGTH: 0.1,
  MAX_SIGNAL_STRENGTH: 10.0,
  
  // Validación de picos
  PEAK_VALIDATION_THRESHOLD: 0.3,
  MIN_CONSECUTIVE_DETECTIONS: 3,
  MAX_CONSECUTIVE_MISSES: 5,
  
  // Umbrales de arritmia
  ARRHYTHMIA_VARIATION_THRESHOLD: 0.2,
  MIN_RR_INTERVAL_MS: 300,
  MAX_RR_INTERVAL_MS: 2000
} as const;

// Tipos de errores

export const ERROR_CODES = {
  // Errores de inicialización
  INIT_ERROR: 'INIT_ERROR',
  AUDIO_INIT_ERROR: 'AUDIO_INIT_ERROR',
  
  // Errores de procesamiento
  FRAME_PROCESSING_ERROR: 'FRAME_PROCESSING_ERROR',
  SIGNAL_PROCESSING_ERROR: 'SIGNAL_PROCESSING_ERROR',
  
  // Errores de validación
  INVALID_SIGNAL: 'INVALID_SIGNAL',
  LOW_SIGNAL_QUALITY: 'LOW_SIGNAL_QUALITY',
  
  // Errores de estado
  INVALID_STATE: 'INVALID_STATE',
  NOT_INITIALIZED: 'NOT_INITIALIZED'
} as const;

// Tipos de eventos
export const EVENT_TYPES = {
  // Eventos de señal
  SIGNAL_RECEIVED: 'SIGNAL_RECEIVED',
  PEAK_DETECTED: 'PEAK_DETECTED',
  ARRHYTHMIA_DETECTED: 'ARRHYTHMIA_DETECTED',
  
  // Eventos de estado
  PROCESSING_STARTED: 'PROCESSING_STARTED',
  PROCESSING_STOPPED: 'PROCESSING_STOPPED',
  CALIBRATION_STARTED: 'CALIBRATION_STARTED',
  CALIBRATION_COMPLETED: 'CALIBRATION_COMPLETED',
  
  // Eventos de error
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  WARNING_OCCURRED: 'WARNING_OCCURRED'
} as const;
