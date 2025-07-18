import { 
  AUDIO, 
  DETECTION, 
  SIGNAL_PROCESSING,
  ERROR_CODES
} from '../config/constants';
import { logger } from '../utils/logger';

export class HeartBeatProcessor {
  // Referencias a configuraciones centralizadas
  private readonly CONFIG = {
    ...SIGNAL_PROCESSING,
    ...AUDIO,
    ...DETECTION
  };

  // Parámetros adaptativos inicializados con valores por defecto
  private adaptiveSignalThreshold: number = this.CONFIG.SIGNAL_THRESHOLD;
  private adaptiveMinConfidence: number = this.CONFIG.MIN_CONFIDENCE;
  private adaptiveDerivativeThreshold: number = this.CONFIG.DERIVATIVE_THRESHOLD;

  // Control de estado y procesamiento de señal
  private lowSignalCount = 0;
  private recentPeakAmplitudes: number[] = [];
  private recentPeakConfidences: number[] = [];
  private recentPeakDerivatives: number[] = [];
  private peaksSinceLastTuning = 0;
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue = 0;
  private audioContext: AudioContext | null = null;
  private heartSoundOscillator: OscillatorNode | null = null;
  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline = 0;
  private lastValue = 0;
  private values: number[] = [];
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak = false;
  private smoothBPM = 0;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue = 0;
  private isArrhythmiaDetected = false;
  private peakValidationBuffer: number[] = [];
  private lastSignalStrength = 0;
  private recentSignalStrengths: number[] = [];
  private currentSignalQuality = 0;
  private startTime = Date.now();
  
  // Referencia a constantes de configuración
  private get BPM_ALPHA() { return this.CONFIG.BPM_ALPHA; }
  private get PEAK_VALIDATION_THRESHOLD() { return this.CONFIG.PEAK_VALIDATION_THRESHOLD; }
  private get SIGNAL_STRENGTH_HISTORY() { return this.CONFIG.SIGNAL_STRENGTH_HISTORY; }
  private get BEEP_VOLUME() { return this.CONFIG.BEEP_VOLUME; }
  private get MIN_BEEP_INTERVAL_MS() { return this.CONFIG.MIN_BEEP_INTERVAL_MS; }
  private get VIBRATION_PATTERN() { return this.CONFIG.VIBRATION_PATTERN; }
  private get DEFAULT_WINDOW_SIZE() { return this.CONFIG.DEFAULT_WINDOW_SIZE; }
  private get BASELINE_FACTOR() { return this.CONFIG.BASELINE_FACTOR; }
  private get DEFAULT_MIN_PEAK_TIME_MS() { return this.CONFIG.DEFAULT_MIN_PEAK_TIME_MS; }
  private get ADAPTIVE_TUNING_PEAK_WINDOW() { return this.CONFIG.ADAPTIVE_TUNING_PEAK_WINDOW; }
  private get SIGNAL_BOOST_FACTOR() { return this.CONFIG.SIGNAL_BOOST_FACTOR; }
  private get WARMUP_TIME_MS() { return this.CONFIG.WARMUP_TIME_MS; }
  private get MEDIAN_FILTER_WINDOW() { return this.CONFIG.MEDIAN_FILTER_WINDOW; }
  private get MOVING_AVERAGE_WINDOW() { return this.CONFIG.MOVING_AVERAGE_WINDOW; }
  private get DEFAULT_MIN_BPM() { return this.CONFIG.DEFAULT_MIN_BPM; }
  private get DEFAULT_MAX_BPM() { return this.CONFIG.DEFAULT_MAX_BPM; }
  private get ADAPTIVE_TUNING_LEARNING_RATE() { return this.CONFIG.ADAPTIVE_TUNING_LEARNING_RATE; }
  private get MIN_ADAPTIVE_SIGNAL_THRESHOLD() { return this.CONFIG.MIN_ADAPTIVE_SIGNAL_THRESHOLD; }
  private get MAX_ADAPTIVE_SIGNAL_THRESHOLD() { return this.CONFIG.MAX_ADAPTIVE_SIGNAL_THRESHOLD; }
  private get MIN_ADAPTIVE_MIN_CONFIDENCE() { return this.CONFIG.MIN_ADAPTIVE_MIN_CONFIDENCE; }
  private get MAX_ADAPTIVE_MIN_CONFIDENCE() { return this.CONFIG.MAX_ADAPTIVE_MIN_CONFIDENCE; }
  private get MIN_ADAPTIVE_DERIVATIVE_THRESHOLD() { return this.CONFIG.MIN_ADAPTIVE_DERIVATIVE_THRESHOLD; }
  private get MAX_ADAPTIVE_DERIVATIVE_THRESHOLD() { return this.CONFIG.MAX_ADAPTIVE_DERIVATIVE_THRESHOLD; }
  private get PEAK_DETECTION_SENSITIVITY() { return this.CONFIG.PEAK_DETECTION_SENSITIVITY; }
  private get EMA_ALPHA() { return this.CONFIG.EMA_ALPHA; }
  private get LOW_SIGNAL_THRESHOLD() { return this.CONFIG.LOW_SIGNAL_THRESHOLD; }
  private get LOW_SIGNAL_FRAMES() { return this.CONFIG.LOW_SIGNAL_FRAMES; }
  private get DEFAULT_SIGNAL_THRESHOLD() { return this.CONFIG.DEFAULT_SIGNAL_THRESHOLD; }
  private get DEFAULT_MIN_CONFIDENCE() { return this.CONFIG.DEFAULT_MIN_CONFIDENCE; }
  private get DEFAULT_DERIVATIVE_THRESHOLD() { return this.CONFIG.DEFAULT_DERIVATIVE_THRESHOLD; }
  
  // Inicializar parámetros del filtro de Kalman
  private P_kalman: number = 1.0; // Covarianza del error estimado
  private X_kalman: number = 0; // Valor estimado
  private K_kalman: number = 0; // Ganancia de Kalman

  constructor() {
    this.initAudio();
    logger.info('HeartBeatProcessor inicializado', { 
      config: {
        sampleRate: this.CONFIG.SAMPLE_RATE,
        minBPM: this.CONFIG.MIN_BPM,
        maxBPM: this.CONFIG.MAX_BPM
      }
    });
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        logger.info('Contexto de audio reanudado');
      }
      logger.info('Contexto de audio inicializado correctamente');
    } catch (error) {
      logger.error('Error al inicializar el audio', error);
      throw new Error(ERROR_CODES.AUDIO_INIT_ERROR);
    }
  }

  private async playHeartSound(volume: number = this.BEEP_VOLUME, playArrhythmiaTone: boolean) {
    if (!this.audioContext || this.isInWarmup()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      console.log("HeartBeatProcessor: Ignorando beep - demasiado cerca del anterior", now - this.lastBeepTime);
      return;
    }

    try {
      if (navigator.vibrate) {
        navigator.vibrate(this.VIBRATION_PATTERN);
      }

      const currentTime = this.audioContext.currentTime;

      // Sonidos de latido mejorados - más claramente audibles
      // LUB - primer sonido del latido
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      oscillator1.type = 'sine';
      oscillator1.frequency.value = 150;
      gainNode1.gain.setValueAtTime(0, currentTime);
      gainNode1.gain.linearRampToValueAtTime(volume * 1.5, currentTime + 0.03);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      oscillator1.start(currentTime);
      oscillator1.stop(currentTime + 0.2);

      // DUB - segundo sonido del latido
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode2 = this.audioContext.createGain();
      const dubStartTime = currentTime + 0.08;
      oscillator2.type = 'sine';
      oscillator2.frequency.value = 120;
      gainNode2.gain.setValueAtTime(0, dubStartTime);
      gainNode2.gain.linearRampToValueAtTime(volume * 1.5, dubStartTime + 0.03);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, dubStartTime + 0.15);
      oscillator2.connect(gainNode2);
      gainNode2.connect(this.audioContext.destination);
      oscillator2.start(dubStartTime);
      oscillator2.stop(dubStartTime + 0.20);
      
      if (playArrhythmiaTone) {
        const oscillator3 = this.audioContext.createOscillator();
        const gainNode3 = this.audioContext.createGain();
        oscillator3.type = 'sine';
        oscillator3.frequency.value = 440;

        // El sonido de arritmia ahora suena inmediatamente después de los latidos principales
        const arrhythmiaSoundStartTime = dubStartTime + 0.05;
        const arrhythmiaAttackDuration = 0.02;
        const arrhythmiaSustainDuration = 0.10;
        const arrhythmiaReleaseDuration = 0.05;
        const arrhythmiaAttackEndTime = arrhythmiaSoundStartTime + arrhythmiaAttackDuration;
        const arrhythmiaSustainEndTime = arrhythmiaAttackEndTime + arrhythmiaSustainDuration;
        const arrhythmiaReleaseEndTime = arrhythmiaSustainEndTime + arrhythmiaReleaseDuration;

        gainNode3.gain.setValueAtTime(0, arrhythmiaSoundStartTime);
        gainNode3.gain.linearRampToValueAtTime(volume * 0.65, arrhythmiaAttackEndTime);
        gainNode3.gain.setValueAtTime(volume * 0.65, arrhythmiaSustainEndTime);
        gainNode3.gain.exponentialRampToValueAtTime(0.001, arrhythmiaReleaseEndTime);
        oscillator3.connect(gainNode3);
        gainNode3.connect(this.audioContext.destination);
        oscillator3.start(arrhythmiaSoundStartTime);
        oscillator3.stop(arrhythmiaReleaseEndTime + 0.01);
        
        // Reseteamos la bandera después de reproducir el sonido de arritmia
        this.isArrhythmiaDetected = false;
      } else {
        // Play a single, quick "thump" sound for normal heartbeat
        if (Date.now() - this.lastBeepTime > this.MIN_BEEP_INTERVAL_MS) {
          this.lastBeepTime = Date.now();
        }
      }
      const interval = now - this.lastBeepTime;
      console.log(`HeartBeatProcessor: Latido reproducido. Intervalo: ${interval} ms, BPM estimado: ${Math.round(this.getSmoothBPM())}`);
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing heart sound", error);
    }
  }

  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
    signalQuality?: number;  // Añadido campo para retroalimentación
  } {
    // Aplicar amplificación razonable
    value = this.boostSignal(value);
    
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);
    
    // Variable filteredValue definida explícitamente
    const filteredValue = smoothed;

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.DEFAULT_WINDOW_SIZE) { 
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 20) { // Requisito apropiado para evaluación
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: filteredValue, // Usando la variable correctamente definida
        arrhythmiaCount: 0,
        signalQuality: 0
      };
    }

    // Baseline tracking
    this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
    const normalizedValue = smoothed - this.baseline;
    
    // Seguimiento de fuerza de señal
    this.trackSignalStrength(Math.abs(normalizedValue));
    
    // Auto-reset con umbral adaptativo para señales débiles
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;
    
    // Obtener la ventana más reciente de la señal para análisis de pico
    const latestSignalWindow = this.signalBuffer.slice(
        Math.max(0, this.signalBuffer.length - this.DEFAULT_WINDOW_SIZE / 2),
        this.signalBuffer.length
    );

    // Detección de picos médicamente válida
    const peakDetectionResult = this.enhancedPeakDetection(normalizedValue, smoothDerivative, latestSignalWindow);
    let isPeak = peakDetectionResult.isPeak;
    const confidence = peakDetectionResult.confidence;
    const rawDerivative = peakDetectionResult.rawDerivative;
    
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Calcular calidad de señal actual basada en varios factores (0-100)
    this.currentSignalQuality = this.calculateSignalQuality(normalizedValue, confidence);

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      // Validación médicamente apropiada
      if (timeSinceLastPeak >= this.DEFAULT_MIN_PEAK_TIME_MS && confidence >= this.adaptiveMinConfidence) {
        // Validación estricta según criterios médicos
        if (this.validatePeak(normalizedValue, confidence)) {
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          
          // Reproducir sonido y actualizar estado
          this.playHeartSound(1.0, this.isArrhythmiaDetected);

          this.updateBPM();

          // Actualizar historial para sintonización adaptativa
          this.recentPeakAmplitudes.push(normalizedValue);
          this.recentPeakConfidences.push(confidence);
          if (rawDerivative !== undefined) this.recentPeakDerivatives.push(rawDerivative);

          if (this.recentPeakAmplitudes.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
            this.recentPeakAmplitudes.shift();
          }
          if (this.recentPeakConfidences.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
            this.recentPeakConfidences.shift();
          }
          if (this.recentPeakDerivatives.length > this.ADAPTIVE_TUNING_PEAK_WINDOW) {
            this.recentPeakDerivatives.shift();
          }
          
          this.peaksSinceLastTuning++;
          if (this.peaksSinceLastTuning >= Math.floor(this.ADAPTIVE_TUNING_PEAK_WINDOW / 2)) {
            this.performAdaptiveTuning();
            this.peaksSinceLastTuning = 0;
          }
        } else {
          console.log(`HeartBeatProcessor: Pico rechazado - confianza insuficiente: ${confidence}`);
          isPeak = false;
        }
      }
    }
    
    // Retornar resultado con nuevos parámetros
    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence: isPeak ? 0.95 : this.adjustConfidenceForSignalStrength(0.6),
      isPeak: isPeak,
      filteredValue: filteredValue, // Usando la variable correctamente definida
      arrhythmiaCount: 0,
      signalQuality: this.currentSignalQuality // Retroalimentación de calidad
    };
  }
  
  /**
   * Amplificación adaptativa de señal - limitada a niveles médicamente válidos
   */
  private boostSignal(value: number): number {
    if (this.signalBuffer.length < 10) return value * this.SIGNAL_BOOST_FACTOR;
    
    // Calcular estadísticas de señal reciente
    const recentSignals = this.signalBuffer.slice(-10);
    const avgSignal = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const maxSignal = Math.max(...recentSignals);
    const minSignal = Math.min(...recentSignals);
    const range = maxSignal - minSignal;
    
    // Calcular factor de amplificación proporcional a la fuerza de la señal
    let boostFactor: number;
    
    if (range < 1.0) {
      // Señal débil - amplificar moderadamente
      boostFactor = Number((this.SIGNAL_BOOST_FACTOR * 1.8).toFixed(2)); // Más amplificación para señales débiles
    } else if (range < 3.0) {
      // Señal moderada - amplificar ligeramente
      boostFactor = Number((this.SIGNAL_BOOST_FACTOR * 1.4).toFixed(2));
    } else if (range > 10.0) {
      // Señal fuerte - no amplificar
      boostFactor = 1.0;
    } else {
      // Usar el valor por defecto
      boostFactor = this.SIGNAL_BOOST_FACTOR;
    }
    
    // Aplicar amplificación lineal centrada en el promedio
    const centered = value - avgSignal;
    const boosted = avgSignal + (centered * boostFactor);
    
    return boosted;
  }

  /**
   * Seguimiento de fuerza de señal para ajuste de confianza
   */
  private trackSignalStrength(amplitude: number): void {
    this.lastSignalStrength = amplitude;
    this.recentSignalStrengths.push(amplitude);
    
    if (this.recentSignalStrengths.length > this.SIGNAL_STRENGTH_HISTORY) {
      this.recentSignalStrengths.shift();
    }
  }

  /**
   * Ajuste de confianza basado en fuerza histórica de señal
   */
  private adjustConfidenceForSignalStrength(confidence: number): number {
    if (this.recentSignalStrengths.length < 5) return confidence;
    
    // Calcular promedio de fuerza de señal
    const avgStrength = this.recentSignalStrengths.reduce((sum, val) => sum + val, 0) / 
                        this.recentSignalStrengths.length;
    
    // Señales muy débiles reducen la confianza
    if (avgStrength < 0.1) {
      return Math.min(1.0, confidence * 0.8);
    }
    
    return Math.min(1.0, confidence);
  }

  private isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  private medianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  private calculateEMA(value: number): number {
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  public setArrhythmiaDetected(isDetected: boolean): void {
    this.isArrhythmiaDetected = isDetected;
    console.log(`HeartBeatProcessor: Estado de arritmia establecido a ${isDetected}`);
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
        // También reseteamos los parámetros adaptativos a sus valores por defecto
        this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
        this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
        this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
        this.isArrhythmiaDetected = false;
        console.log("HeartBeatProcessor: auto-reset adaptative parameters and arrhythmia flag (low signal).");
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1); // Reducción gradual
    }
  }

  private resetDetectionStates() {
    // No resetear lastPeakTime para mantener continuidad de detecciones
    this.lastConfirmedPeak = false;
    this.peakConfirmationBuffer = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  /**
   * Detección de picos mejorada para señales con validación médica
   */
  private enhancedPeakDetection(normalizedValue: number, derivative: number, latestSignalWindow: number[]): {
    isPeak: boolean;
    confidence: number;
    rawDerivative?: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    // 1. Validación de tiempo básica (previene múltiples picos por el mismo pulso)
    if (timeSinceLastPeak < this.DEFAULT_MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // 2. Detección inicial de candidato a pico basada en el umbral de la derivada
    // Un pico se detecta cuando la derivada pasa por cero y se vuelve negativa (el punto más alto del ascenso)
    const isPeakCandidate = derivative < this.adaptiveDerivativeThreshold; // Ajustado por el umbral adaptativo

    if (!isPeakCandidate) {
      return { isPeak: false, confidence: 0 };
    }

    // 3. Confirmación del pico - verificar si es realmente un máximo local en una ventana pequeña
    // Necesitamos al menos 3 puntos para determinar si es un máximo local (anterior, actual, siguiente)
    if (this.signalBuffer.length < 3) {
        return { isPeak: false, confidence: 0 };
    }
    const currentIndex = this.signalBuffer.length - 1;
    const currentValue = this.signalBuffer[currentIndex];
    const prevValue = this.signalBuffer[currentIndex - 1];
    const nextValue = normalizedValue; // El valor actual ya es el 'siguiente' si estamos procesando en tiempo real

    // Confirmar que el valor actual (o el último en el buffer) es un máximo local
    const isLocalMax = currentValue > prevValue && currentValue > nextValue;

    if (!isLocalMax) {
        return { isPeak: false, confidence: 0 };
    }

    // 4. Calcular confianza inicial basada en la prominencia del pico y la amplitud
    let currentConfidence = 0;
    if (latestSignalWindow.length > 0) {
      const minInWindow = Math.min(...latestSignalWindow);
      const peakProminence = currentValue - minInWindow; // Usar currentValue ya que es el pico confirmado
      const avgAmplitude = latestSignalWindow.reduce((s, v) => s + v, 0) / latestSignalWindow.length;

      // Confianza basada en la prominencia relativa a la señal promedio y el valor absoluto
      if (peakProminence > (avgAmplitude * 0.15) && currentValue > this.adaptiveSignalThreshold) { // Aumentar requisito de prominencia
        currentConfidence = Math.min(1, peakProminence * this.PEAK_DETECTION_SENSITIVITY); // Sensibilidad ya ajustada
      }
    }

    // Aplicar confianza mínima adaptativa para la detección
    if (currentConfidence < this.adaptiveMinConfidence) {
      return { isPeak: false, confidence: 0 };
    }

    return { isPeak: true, confidence: currentConfidence, rawDerivative: derivative };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    // Confirmación mejorada: Un pico se confirma si es detectado y la confianza supera un umbral.
    // Esto es crucial para la estabilidad de la detección.
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.adaptiveMinConfidence) {
      this.lastConfirmedPeak = true;
      return true;
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }
    return false;
  }

  /**
   * Validación de picos basada estrictamente en criterios médicos
   */
  private validatePeak(peakValue: number, confidence: number): boolean {
    // Se requiere que la confianza del pico sea al menos el umbral mínimo adaptativo
    if (confidence < this.adaptiveMinConfidence) {
      console.log(`HeartBeatProcessor: Pico rechazado en validación - confianza (${confidence.toFixed(2)}) debajo del umbral adaptativo (${this.adaptiveMinConfidence.toFixed(2)}).`);
      return false;
    }

    // Asegurar que el pico tiene una amplitud mínima fisiológica esperada
    // `peakValue` es el valor normalizado del pico
    if (peakValue < this.DEFAULT_SIGNAL_THRESHOLD * 0.5) { // Un umbral más estricto para la validez fisiológica
      console.log(`HeartBeatProcessor: Pico rechazado en validación - amplitud (${peakValue.toFixed(3)}) demasiado baja.`);
      return false;
    }

    // La validación pasa si las condiciones anteriores se cumplen
    return true;
  }

  private updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    if (instantBPM >= this.DEFAULT_MIN_BPM && instantBPM <= this.DEFAULT_MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) {
        this.bpmHistory.shift();
      }
    }
  }

  public getSmoothBPM(): number {
    if (this.bpmHistory.length < 3) return 0;
    
    // Filtrado adaptativo basado en confianza
    // Se asegura que recentPeakConfidences tenga la misma longitud que bpmHistory
    const validReadings = this.bpmHistory.filter((_, i) => 
      this.recentPeakConfidences.length > i && this.recentPeakConfidences[i] >= this.adaptiveMinConfidence
    );
    
    const validConfidences = this.recentPeakConfidences.filter((_, i) => 
        this.bpmHistory.length > i && this.recentPeakConfidences[i] >= this.adaptiveMinConfidence
    );

    if (validReadings.length === 0 || validConfidences.length === 0) return 0;

    // Ponderar por confianza y aplicar mediana móvil
    const weightedBPM = validReadings.reduce(
      (sum, bpm, i) => sum + (bpm * validConfidences[i]), 
      0
    ) / validConfidences.reduce((sum, confidence) => sum + confidence, 0);
    
    // Suavizado final con filtro de Kalman simple
    this.smoothBPM = this.kalmanFilter(weightedBPM, 0.15);
    return Math.round(this.smoothBPM);
  }

  private kalmanFilter(value: number, processNoise: number): number {
    // Implementación simplificada del filtro de Kalman para un suavizado más responsivo
    // Ajustar Q (ruido del proceso) para mayor adaptabilidad, y R (ruido de la medición) para suavizado
    const R_measurementNoise = 0.05; // Más bajo para suavizar más la entrada
    const Q_processNoise = processNoise; // Controlado por el parámetro de entrada

    // Predicción
    this.P_kalman = this.P_kalman + Q_processNoise;

    // Actualización
    this.K_kalman = this.P_kalman / (this.P_kalman + R_measurementNoise);
    this.X_kalman = this.X_kalman + this.K_kalman * (value - this.X_kalman);
    this.P_kalman = (1 - this.K_kalman) * this.P_kalman;

    return this.X_kalman;
  }

  public getFinalBPM(): number { 
    if (this.bpmHistory.length < 5) {
      // Si no hay suficiente historial, usamos el BPM suavizado del Kalman
      return Math.round(this.getSmoothBPM()); 
    }
    
    // Filtrar el historial de BPM por encima de la confianza mínima adaptativa
    const filteredBPMHistory = this.bpmHistory.filter((_, i) => 
      this.recentPeakConfidences.length > i && this.recentPeakConfidences[i] >= this.adaptiveMinConfidence
    );

    if (filteredBPMHistory.length === 0) { 
        return Math.round(this.getSmoothBPM());
    }

    // Mediana robusta para un BPM final
    const sorted = [...filteredBPMHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    let finalBPM = 0;
    if (sorted.length % 2 === 0) {
        finalBPM = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        finalBPM = sorted[mid];
    }

    return Math.round(finalBPM);
  }

  /**
   * Resets all processor state to initial values
   * @param fullReset If true, resets adaptive parameters and learning state
   */
  reset(fullReset: boolean = true) {
    const resetStartTime = performance.now();
    
    // Clear all data buffers
    this.values = [];
    this.bpmHistory = [];
    this.peakConfirmationBuffer = [];
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakValidationBuffer = [];
    this.recentSignalStrengths = [];
    
    // Reset timing and state variables
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.startTime = Date.now();
    this.lowSignalCount = 0;
    this.peaksSinceLastTuning = 0;
    
    // Reset signal processing state
    this.baseline = 0;
    this.lastValue = 0;
    this.smoothedValue = 0;
    this.currentSignalQuality = 0;
    this.lastSignalStrength = 0;
    
    // Reset peak detection state
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.isArrhythmiaDetected = false;
    
    if (fullReset) {
      // Reset adaptive parameters to defaults
      this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
      this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
      this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
      
      // Clear learning buffers
      this.recentPeakAmplitudes = [];
      this.recentPeakConfidences = [];
      this.recentPeakDerivatives = [];
      
      // Reset Kalman filter with safe initial values
      this.P_kalman = 1.0;
      this.X_kalman = 0;
      this.K_kalman = 0;
      
      console.log('HeartBeatProcessor: Full reset performed', {
        resetDuration: performance.now() - resetStartTime,
        adaptiveParams: {
          signalThreshold: this.adaptiveSignalThreshold,
          minConfidence: this.adaptiveMinConfidence,
          derivativeThreshold: this.adaptiveDerivativeThreshold
        }
      });
    } else {
      console.log('HeartBeatProcessor: Soft reset performed', {
        resetDuration: performance.now() - resetStartTime
      });
    }
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    // Filtrar intervalos RR basados en la confianza de los picos correspondientes
    const rrIntervals: number[] = [];
    for (let i = 0; i < this.bpmHistory.length; i++) {
        if (this.recentPeakConfidences.length > i && this.recentPeakConfidences[i] >= this.adaptiveMinConfidence) {
            rrIntervals.push(60000 / this.bpmHistory[i]);
        }
    }
    return {
      intervals: rrIntervals, 
      lastPeakTime: this.lastPeakTime,
    };
  }
  
  /**
   * Sintonización adaptativa médicamente apropiada
   */
  private performAdaptiveTuning(): void {
    if (this.isInWarmup() || this.recentPeakAmplitudes.length < 4) { // Reducido para adaptación más rápida
      return;
    }

    if (this.recentPeakAmplitudes.length > 0) {
      // Calcular estadísticas sobre picos recientes
      const avgAmplitude = this.recentPeakAmplitudes.reduce((s, v) => s + v, 0) / this.recentPeakAmplitudes.length;
      
      // Umbral adaptativo basado en amplitud promedio - más sensible
      let targetSignalThreshold = avgAmplitude * 0.45; // Reducido para mayor sensibilidad

      // Tasa de aprendizaje aumentada
      const learningRate = this.ADAPTIVE_TUNING_LEARNING_RATE;
      
      // Actualización gradual
      this.adaptiveSignalThreshold = 
          this.adaptiveSignalThreshold * (1 - learningRate) +
          targetSignalThreshold * learningRate;
      
      // Asegurar límites seguros
      this.adaptiveSignalThreshold = Math.max(this.MIN_ADAPTIVE_SIGNAL_THRESHOLD, 
                                    Math.min(this.MAX_ADAPTIVE_SIGNAL_THRESHOLD, this.adaptiveSignalThreshold));
    }

    if (this.recentPeakConfidences.length > 0) {
      const avgConfidence = this.recentPeakConfidences.reduce((s, v) => s + v, 0) / this.recentPeakConfidences.length;
      let targetMinConfidence = this.adaptiveMinConfidence; 

      // Reducción más agresiva para señales débiles
      if (avgConfidence < 0.5) { // Señal débil
        targetMinConfidence = this.adaptiveMinConfidence - 0.08; // Reducción más agresiva
      }
      // Sólo incrementar el umbral si la confianza es consistentemente alta
      else if (avgConfidence > 0.80 && this.recentSignalStrengths.length > 5) {
        const avgStrength = this.recentSignalStrengths.reduce((s, v) => s + v, 0) / this.recentSignalStrengths.length;
        if (avgStrength > 0.25) { // Más permisivo para señales
          targetMinConfidence = this.adaptiveMinConfidence + 0.01;
        }
      }
      
      this.adaptiveMinConfidence =
          this.adaptiveMinConfidence * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) +
          targetMinConfidence * this.ADAPTIVE_TUNING_LEARNING_RATE;
          
      this.adaptiveMinConfidence = Math.max(this.MIN_ADAPTIVE_MIN_CONFIDENCE, 
                                 Math.min(this.MAX_ADAPTIVE_MIN_CONFIDENCE, this.adaptiveMinConfidence));
    }
    
    if (this.recentPeakDerivatives.length > 0) {
        const avgDerivative = this.recentPeakDerivatives.reduce((s,v) => s+v, 0) / this.recentPeakDerivatives.length;
        
        // Umbral de derivada ultra-sensible
        let targetDerivativeThreshold = avgDerivative * 0.25; // Más sensible (antes 0.3)

        this.adaptiveDerivativeThreshold = 
            this.adaptiveDerivativeThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) +
            targetDerivativeThreshold * this.ADAPTIVE_TUNING_LEARNING_RATE;

        this.adaptiveDerivativeThreshold = Math.max(this.MIN_ADAPTIVE_DERIVATIVE_THRESHOLD, 
                                        Math.min(this.MAX_ADAPTIVE_DERIVATIVE_THRESHOLD, this.adaptiveDerivativeThreshold));
    }
    
    console.log("HeartBeatProcessor: Adaptive tuning updated", {
      signalThreshold: this.adaptiveSignalThreshold.toFixed(3),
      minConfidence: this.adaptiveMinConfidence.toFixed(3),
      derivativeThreshold: this.adaptiveDerivativeThreshold.toFixed(3),
      avgSignalStrength: this.recentSignalStrengths.length > 0 ? 
                        (this.recentSignalStrengths.reduce((s,v) => s+v, 0) / 
                         this.recentSignalStrengths.length).toFixed(3) : "N/A",
      currentSignalQuality: this.currentSignalQuality
    });
  }
  
  // Método público para obtener la calidad de señal actual
  public getSignalQuality(): number {
    return this.currentSignalQuality;
  }

  /**
   * Calcula la calidad de la señal actual basado en múltiples factores
   * @param normalizedValue Valor normalizado de la señal actual
   * @param confidence Confianza de la detección actual
   * @returns Valor de calidad entre 0-100
   */
  private calculateSignalQuality(normalizedValue: number, confidence: number): number {
    // Si no hay suficientes datos para una evaluación precisa
    if (this.signalBuffer.length < this.DEFAULT_WINDOW_SIZE / 2) {
      return Math.min(this.currentSignalQuality + 5, 30); // Incremento gradual hasta 30 durante calibración
    }
    
    // Calcular estadísticas de señal reciente
    const recentSignals = this.signalBuffer.slice(-this.DEFAULT_WINDOW_SIZE); // Usar una ventana más grande para estadísticas más estables
    const avgSignal = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const maxSignal = Math.max(...recentSignals);
    const minSignal = Math.min(...recentSignals);
    const peakToPeakAmplitude = maxSignal - minSignal;
    
    // Componentes de calidad
    let amplitudeQuality = 0;
    let stabilityQuality = 0;
    let rhythmQuality = 0;
    let perfusionQuality = 0;
    let motionArtifactPenalty = 0;

    // 1. Calidad basada en Amplitud del Pulso (Perfusividad) (0-30)
    // Usar la amplitud pico a pico como indicador de perfusión
    if (avgSignal > 0 && peakToPeakAmplitude > 0) {
        const perfusionIndex = peakToPeakAmplitude / avgSignal;
        perfusionQuality = Math.min(30, perfusionIndex * 200); // Escalar a 30, ajustar el multiplicador según sea necesario
    }

    // 2. Calidad basada en Estabilidad de señal (Ruido y Drift) (0-25)
    // Usar la desviación estándar o la variabilidad de la señal
    const stdDev = Math.sqrt(recentSignals.reduce((sum, val) => sum + Math.pow(val - avgSignal, 2), 0) / recentSignals.length);
    if (stdDev < 0.01 * avgSignal) { // Poco ruido
        stabilityQuality = 25;
    } else if (stdDev < 0.03 * avgSignal) {
        stabilityQuality = 15;
    } else {
        stabilityQuality = 5;
    }

    // 3. Calidad basada en Ritmo y Consistencia de Latidos (0-25)
    if (this.bpmHistory.length >= 5) { // Requiere más historial de BPM para una evaluación de ritmo robusta
      const recentBPMs = this.bpmHistory.slice(-5);
      const bpmStdDev = Math.sqrt(recentBPMs.reduce((sum, val) => sum + Math.pow(val - (recentBPMs.reduce((a,b)=>a+b,0)/recentBPMs.length), 2), 0) / recentBPMs.length);

      if (bpmStdDev < 2) { // Ritmo muy estable
          rhythmQuality = 25;
      } else if (bpmStdDev < 5) {
          rhythmQuality = 15;
      } else {
          rhythmQuality = 5;
      }
    }

    // 4. Penalización por Artefactos de Movimiento (0-20)
    // Evaluar cambios rápidos en la señal que no son picos cardiacos
    if (this.signalBuffer.length > 5) { // Comparar el valor actual con el valor suavizado reciente
        const lastFewSignals = this.signalBuffer.slice(-5);
        const avgLastFew = lastFewSignals.reduce((s, v) => s + v, 0) / lastFewSignals.length;
        if (Math.abs(normalizedValue - avgLastFew) > peakToPeakAmplitude * 0.5) { // Si el valor actual se desvía significativamente
            motionArtifactPenalty = 10; // Aplicar una penalización
        }
    }


    let totalQuality = perfusionQuality + stabilityQuality + rhythmQuality - motionArtifactPenalty;
    
    // Penalización por baja confianza general de detección de picos
    totalQuality *= confidence; // Escalar directamente por la confianza para la calidad general

    // Asegurar límites
    totalQuality = Math.min(Math.max(Math.round(totalQuality), 0), 100);

    // Suavizado para evitar cambios bruscos en la calidad reportada
    this.currentSignalQuality = this.currentSignalQuality * 0.7 + totalQuality * 0.3; // Suavizado EMA
    
    return Math.round(this.currentSignalQuality);
  }
}
