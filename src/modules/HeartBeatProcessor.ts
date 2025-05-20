export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES (Valores optimizados) ──────────
  private readonly DEFAULT_SAMPLE_RATE = 60;
  private readonly DEFAULT_WINDOW_SIZE = 60;
  private readonly DEFAULT_MIN_BPM = 30; // Ampliado rango a menor BPM (antes 40)
  private readonly DEFAULT_MAX_BPM = 220; // Ampliado rango a mayor BPM (antes 200)
  private readonly DEFAULT_SIGNAL_THRESHOLD = 0.15; // Reducido para mayor sensibilidad (antes 0.30)
  private readonly DEFAULT_MIN_CONFIDENCE = 0.60; // Reducido para detectar señales más débiles (antes 0.70)
  private readonly DEFAULT_DERIVATIVE_THRESHOLD = -0.01; // Menos restrictivo (antes -0.02)
  private readonly DEFAULT_MIN_PEAK_TIME_MS = 500; // Reducido para detectar pulsos más rápidos (antes 600)
  private readonly WARMUP_TIME_MS = 2000; // Acelerado tiempo de arranque (antes 3000)

  // Parámetros de filtrado mejorados
  private readonly MEDIAN_FILTER_WINDOW = 3; // Reducido para menor latencia (antes 5)
  private readonly MOVING_AVERAGE_WINDOW = 2;
  private readonly EMA_ALPHA = 0.5; // Incrementado para adaptarse más rápido (antes 0.4)
  private readonly BASELINE_FACTOR = 0.8; // Reducido para adaptarse más rápido (antes 1.0)

  // Parámetros de beep y vibración - Actualizados para mejor audibilidad
  private readonly BEEP_DURATION = 450; 
  private readonly BEEP_VOLUME = 1.0; // Volumen máximo
  private readonly MIN_BEEP_INTERVAL_MS = 600; // Reducido para responder más rápido (antes 800)
  private readonly VIBRATION_PATTERN = [40, 20, 60];

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.02; // Más sensible para no descartar señales débiles (antes 0.05)
  private readonly LOW_SIGNAL_FRAMES = 15; // Aumentado para ser más tolerante (antes 10)
  private lowSignalCount = 0;

  // ────────── PARÁMETROS ADAPTATIVOS ──────────
  private adaptiveSignalThreshold: number;
  private adaptiveMinConfidence: number;
  private adaptiveDerivativeThreshold: number;

  // Límites para los parámetros adaptativos - Optimizados para señales débiles
  private readonly MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.08; // Reducido para mayor sensibilidad (antes 0.15)
  private readonly MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.4; // Reducido valor máximo (antes 0.6)
  private readonly MIN_ADAPTIVE_MIN_CONFIDENCE = 0.45; // Reducido para captar señales débiles (antes 0.55)
  private readonly MAX_ADAPTIVE_MIN_CONFIDENCE = 0.80; // Ajustado (antes 0.85)
  private readonly MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.08; // Más sensible (antes -0.05)
  private readonly MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.005; // Más sensible (antes -0.01)

  // ────────── NUEVOS PARÁMETROS PARA PROCESAMIENTO AVANZADO ──────────
  private readonly SIGNAL_BOOST_FACTOR = 1.8; // Amplificación de señal débil
  private readonly PEAK_DETECTION_SENSITIVITY = 0.7; // Mayor sensibilidad a picos
  
  // Control del auto-ajuste
  private readonly ADAPTIVE_TUNING_PEAK_WINDOW = 15; // Reducido para adaptarse más rápido (antes 20)
  private readonly ADAPTIVE_TUNING_LEARNING_RATE = 0.15; // Incrementado (antes 0.1)
  private recentPeakAmplitudes: number[] = [];
  private recentPeakConfidences: number[] = [];
  private recentPeakDerivatives: number[] = [];
  private peaksSinceLastTuning = 0;

  // Variables internas
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private audioContext: AudioContext | null = null;
  private heartSoundOscillator: OscillatorNode | null = null;
  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 0;
  private readonly BPM_ALPHA = 0.3; // Incrementado para adaptarse más rápido (antes 0.2)
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private isArrhythmiaDetected: boolean = false;
  
  // Nuevas variables para mejorar la detección
  private peakValidationBuffer: number[] = [];
  private readonly PEAK_VALIDATION_THRESHOLD = 0.5; // Reducido para mayor sensibilidad (antes 0.6)
  private lastSignalStrength: number = 0; // Para seguimiento de calidad de señal
  private recentSignalStrengths: number[] = []; // Historial de fuerza de señal
  private readonly SIGNAL_STRENGTH_HISTORY = 30; // Tamaño de historial

  constructor() {
    // Inicializar parámetros adaptativos con valores más sensibles
    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;

    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      console.log("HeartBeatProcessor: Audio Context Initialized and resumed");
      
      // Reproducir un sonido de prueba audible para desbloquear el audio
      await this.playTestSound(0.2);
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playTestSound(volume: number = 0.2) {
    if (!this.audioContext) return;
    
    try {
      // console.log("HeartBeatProcessor: Reproduciendo sonido de prueba");
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // Frecuencia A4 - claramente audible
      
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.6);
      
      // console.log("HeartBeatProcessor: Sonido de prueba reproducido");
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing test sound", error);
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

      // LUB - primer sonido del latido (inmediato para mejor sincronización)
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      oscillator1.type = 'sine';
      oscillator1.frequency.value = 120;
      gainNode1.gain.setValueAtTime(0, currentTime);
      gainNode1.gain.linearRampToValueAtTime(volume * 1.2, currentTime + 0.03);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      oscillator1.start(currentTime);
      oscillator1.stop(currentTime + 0.2);

      // DUB - segundo sonido del latido (muy cercano al primero para sincronización)
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode2 = this.audioContext.createGain();
      const dubStartTime = currentTime + 0.08; // Más cercano para mejor sincronización
      oscillator2.type = 'sine';
      oscillator2.frequency.value = 120;
      gainNode2.gain.setValueAtTime(0, dubStartTime);
      gainNode2.gain.linearRampToValueAtTime(volume * 1.2, dubStartTime + 0.03);
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
      }
      this.lastBeepTime = now;
      console.log(`HeartBeatProcessor: Reproduciendo sonido de latido en ${now}, intervalo: ${now - this.lastBeepTime}`);
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
  } {
    // NUEVO: Amplificar señales débiles
    value = this.boostSignal(value);
    
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.DEFAULT_WINDOW_SIZE) { 
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 20) { // Reducido requisito inicial (antes 30)
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0,
      };
    }

    // Baseline tracking más responsivo para señales débiles
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
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
    
    // Detección de picos mejorada para señales débiles
    const peakDetectionResult = this.detectPeak(normalizedValue, smoothDerivative);
    let isPeak = peakDetectionResult.isPeak;
    const confidence = peakDetectionResult.confidence;
    const rawDerivative = peakDetectionResult.rawDerivative;
    
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      // Validación optimizada para señales débiles
      if (timeSinceLastPeak >= this.DEFAULT_MIN_PEAK_TIME_MS) {
        // NUEVO: Validación mejorada con consideración de señal débil
        if (this.validatePeakEnhanced(normalizedValue, confidence)) {
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          
          // Reproducimos el sonido inmediatamente cuando se detecta el pico
          this.playHeartSound(0.95, this.isArrhythmiaDetected);

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
          if (this.peaksSinceLastTuning >= this.ADAPTIVE_TUNING_PEAK_WINDOW / 2) { // Más frecuente (antes ADAPTIVE_TUNING_PEAK_WINDOW)
            this.performAdaptiveTuning();
            this.peaksSinceLastTuning = 0;
          }
        } else {
          console.log(`HeartBeatProcessor: Pico rechazado - confianza insuficiente: ${confidence}`);
          isPeak = false;
        }
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence: this.adjustConfidenceForSignalStrength(confidence),
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0 
    };
  }

  /**
   * NUEVO: Amplificación adaptativa de señal
   * Aplica mayor amplificación a señales más débiles
   */
  private boostSignal(value: number): number {
    if (this.signalBuffer.length < 10) return value;
    
    // Calcular estadísticas de señal reciente
    const recentSignals = this.signalBuffer.slice(-10);
    const avgSignal = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const maxSignal = Math.max(...recentSignals);
    const minSignal = Math.min(...recentSignals);
    const range = maxSignal - minSignal;
    
    // Calcular factor de amplificación inversamente proporcional a la fuerza de la señal
    let boostFactor = this.SIGNAL_BOOST_FACTOR;
    
    if (range < 1.0) {
      // Señal muy débil - amplificar más
      boostFactor = this.SIGNAL_BOOST_FACTOR * 2.5;
    } else if (range < 3.0) {
      // Señal débil - amplificar bastante
      boostFactor = this.SIGNAL_BOOST_FACTOR * 1.8;
    } else if (range > 10.0) {
      // Señal fuerte - amplificar menos
      boostFactor = 1.0;
    }
    
    // Aplicar amplificación no lineal centrada en el promedio
    const centered = value - avgSignal;
    const boosted = avgSignal + (centered * boostFactor);
    
    return boosted;
  }

  /**
   * NUEVO: Seguimiento de fuerza de señal para ajuste de confianza
   */
  private trackSignalStrength(amplitude: number): void {
    this.lastSignalStrength = amplitude;
    this.recentSignalStrengths.push(amplitude);
    
    if (this.recentSignalStrengths.length > this.SIGNAL_STRENGTH_HISTORY) {
      this.recentSignalStrengths.shift();
    }
  }

  /**
   * NUEVO: Ajusta la confianza basada en la fuerza histórica de la señal
   */
  private adjustConfidenceForSignalStrength(confidence: number): number {
    if (this.recentSignalStrengths.length < 5) return confidence;
    
    // Calcular promedio de fuerza de señal
    const avgStrength = this.recentSignalStrengths.reduce((sum, val) => sum + val, 0) / 
                        this.recentSignalStrengths.length;
    
    // Señales muy débiles reciben un pequeño boost de confianza para compensar
    if (avgStrength < 0.1) {
      return Math.min(1.0, confidence * 1.3);
    }
    
    // Señales moderadamente débiles reciben un pequeño boost
    if (avgStrength < 0.2) {
      return Math.min(1.0, confidence * 1.15);
    }
    
    return confidence;
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
    console.log(`HeartBeatProcessor: Estado de arritmia establecido EXTERNMENTE a ${isDetected}`);
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
        this.isArrhythmiaDetected = false; // Asegurar que se resetee aquí también
        console.log("HeartBeatProcessor: auto-reset adaptative parameters and arrhythmia flag (low signal).");
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakConfirmationBuffer = [];
    this.values = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
    rawDerivative?: number; 
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.DEFAULT_MIN_PEAK_TIME_MS) { 
      return { isPeak: false, confidence: 0 };
    }
    
    // Detección mejorada para señales débiles
    const isOverThreshold =
      derivative < this.adaptiveDerivativeThreshold * this.PEAK_DETECTION_SENSITIVITY && 
      normalizedValue > this.adaptiveSignalThreshold * 0.8 && 
      this.lastValue > this.baseline * 0.95; 

    // Cálculo de confianza mejorado para señales débiles
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.adaptiveSignalThreshold * 1.5), 0),  // Menos restrictivo (antes 1.8)
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.adaptiveDerivativeThreshold * 0.6), 0), // Menos restrictivo (antes 0.8)
      1
    );

    // Dar más peso a la derivada para señales débiles
    const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 1.4) / 2;

    return { isPeak: isOverThreshold, confidence, rawDerivative: derivative };
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
    
    // Calcular promedio con más peso a valores más recientes
    let weightedSum = 0;
    let weightSum = 0;
    for (let i = 0; i < this.peakConfirmationBuffer.length; i++) {
      // Dar más peso a valores más recientes
      const weight = 1 + i * 0.5;
      weightedSum += this.peakConfirmationBuffer[i] * weight;
      weightSum += weight;
    }
    const avgBuffer = weightedSum / weightSum;
    
    // Confirmación más sensible para pulsos débiles
    if (isPeak && !this.lastConfirmedPeak && 
        confidence >= this.adaptiveMinConfidence * 0.9 && // Más tolerante (antes sin factor)
        avgBuffer > this.adaptiveSignalThreshold * 0.75) { // Más tolerante (antes sin factor)
      
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Verificar patrón de forma de onda (más tolerante para señales débiles)
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        
        // Para señales muy débiles, solo requerir una pendiente negativa
        if (goingDown1 || confidence > 0.8) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }
    return false;
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

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0 && rawBPM > 0) { 
        this.smoothBPM = rawBPM;
    } else if (rawBPM > 0) { 
        this.smoothBPM =
            this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    } else if (this.bpmHistory.length === 0) { 
        this.smoothBPM = 0;
    }
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    const sortedBPM = [...this.bpmHistory].sort((a,b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    if (sortedBPM.length % 2 === 0) {
        return (sortedBPM[mid-1] + sortedBPM[mid]) / 2;
    }
    return sortedBPM[mid];
  }

  public getFinalBPM(): number { 
    if (this.bpmHistory.length < 5) {
      return Math.round(this.getSmoothBPM()); 
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.floor(sorted.length * 0.2); 
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) {
        return Math.round(this.getSmoothBPM());
    }
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  public reset() {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakConfirmationBuffer = [];
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.smoothedValue = 0;
    this.startTime = Date.now();
    this.lowSignalCount = 0;

    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
    this.recentPeakAmplitudes = [];
    this.recentPeakConfidences = [];
    this.recentPeakDerivatives = [];
    this.peaksSinceLastTuning = 0;
    
    this.isArrhythmiaDetected = false; // Importante resetearla aquí también
    this.peakValidationBuffer = [];
    console.log("HeartBeatProcessor: Full reset including adaptive parameters and arrhythmia flag.");
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    const rrIntervals = this.bpmHistory.map(bpm => 60000 / bpm);
    return {
      intervals: rrIntervals, 
      lastPeakTime: this.lastPeakTime,
    };
  }
  
  private performAdaptiveTuning(): void {
    if (this.isInWarmup() || this.recentPeakAmplitudes.length < this.ADAPTIVE_TUNING_PEAK_WINDOW / 3) {
      return;
    }

    if (this.recentPeakAmplitudes.length > 0) {
      // Sintonización adaptativa mejorada para señales débiles
      const avgAmplitude = this.recentPeakAmplitudes.reduce((s, v) => s + v, 0) / this.recentPeakAmplitudes.length;
      
      // Usar un factor de umbral más bajo para señales más débiles
      let targetSignalThreshold = avgAmplitude * 0.5; // Más sensible (antes 0.6)

      // Actualizar con tasa de aprendizaje adaptativa
      const learningRate = this.ADAPTIVE_TUNING_LEARNING_RATE * 
                          (avgAmplitude < 0.3 ? 1.5 : 1.0); // Aprender más rápido con señales débiles
      
      this.adaptiveSignalThreshold = 
          this.adaptiveSignalThreshold * (1 - learningRate) +
          targetSignalThreshold * learningRate;
      
      this.adaptiveSignalThreshold = Math.max(this.MIN_ADAPTIVE_SIGNAL_THRESHOLD, 
                                    Math.min(this.MAX_ADAPTIVE_SIGNAL_THRESHOLD, this.adaptiveSignalThreshold));
    }

    if (this.recentPeakConfidences.length > 0) {
      const avgConfidence = this.recentPeakConfidences.reduce((s, v) => s + v, 0) / this.recentPeakConfidences.length;
      let targetMinConfidence = this.adaptiveMinConfidence; 

      // Ajuste más agresivo para confianza con señales débiles
      if (avgConfidence > 0.85) {
        targetMinConfidence = this.adaptiveMinConfidence + 0.02; 
      } 
      else if (avgConfidence < 0.7) {
        targetMinConfidence = this.adaptiveMinConfidence - 0.03; // Más agresivo (antes 0.02)
      }
      
      this.adaptiveMinConfidence =
          this.adaptiveMinConfidence * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) +
          targetMinConfidence * this.ADAPTIVE_TUNING_LEARNING_RATE;
      this.adaptiveMinConfidence = Math.max(this.MIN_ADAPTIVE_MIN_CONFIDENCE, 
                                 Math.min(this.MAX_ADAPTIVE_MIN_CONFIDENCE, this.adaptiveMinConfidence));
    }
    
    if (this.recentPeakDerivatives.length > 0) {
        const avgDerivative = this.recentPeakDerivatives.reduce((s,v) => s+v, 0) / this.recentPeakDerivatives.length;
        
        // Ajuste más sensible para derivadas con señales débiles
        let targetDerivativeThreshold = avgDerivative * 0.4; // Más sensible (antes 0.5)

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
                         this.recentSignalStrengths.length).toFixed(3) : "N/A"
    });
  }

  /**
   * NUEVO: Validación mejorada para señales débiles
   */
  private validatePeakEnhanced(peakValue: number, confidence: number): boolean {
    // Agregar el valor al buffer de validación
    this.peakValidationBuffer.push(peakValue);
    if (this.peakValidationBuffer.length > 5) {
      this.peakValidationBuffer.shift();
    }
    
    // Ajustar umbral de confianza basado en historial de fuerza de señal
    let adjustedThreshold = this.PEAK_VALIDATION_THRESHOLD;
    
    if (this.recentSignalStrengths.length > 5) {
      const avgStrength = this.recentSignalStrengths.reduce((sum, val) => sum + val, 0) / 
                          this.recentSignalStrengths.length;
      
      // Reducir umbral para señales débiles
      if (avgStrength < 0.2) {
        adjustedThreshold *= 0.8;
      }
    }
    
    // Para señales débiles pero consistentes, priorizar patrones en lugar de threshold absoluto
    if (confidence < adjustedThreshold && confidence > adjustedThreshold * 0.6) {
      // Si tenemos suficiente historia, verificar patrón consistente
      if (this.bpmHistory.length > 3) {
        const expectedInterval = 60000 / this.getSmoothBPM();
        const now = Date.now();
        
        // Si este pico ocurre aproximadamente cuando esperamos el siguiente latido,
        // es probable que sea válido a pesar de la baja confianza
        if (this.lastPeakTime && 
            now - this.lastPeakTime > expectedInterval * 0.8 &&
            now - this.lastPeakTime < expectedInterval * 1.3) {
          console.log("HeartBeatProcessor: Pico validado por tiempo esperado a pesar de baja confianza");
          return true;
        }
      }
    }
    
    // Si la confianza es muy alta, aceptar inmediatamente
    if (confidence > adjustedThreshold * 1.3) {
      return true;
    }
    
    // Para confianza normal, verificar significancia relativa
    if (confidence >= adjustedThreshold) {
      // Calcular el promedio de los valores recientes con más peso a los más antiguos
      // (para evitar que el pico actual afecte demasiado)
      let weightedSum = 0;
      let weightSum = 0;
      
      for (let i = 0; i < this.peakValidationBuffer.length - 1; i++) {
        const weight = this.peakValidationBuffer.length - 1 - i;
        weightedSum += this.peakValidationBuffer[i] * weight;
        weightSum += weight;
      }
      
      const avgVal = weightSum > 0 ? weightedSum / weightSum : 0;
      
      // El pico debe ser un porcentaje significativo mayor que el promedio
      // Más tolerante para señales débiles
      const isSufficientlyLarge = peakValue > avgVal * 1.10; // Menos restrictivo (antes 1.15)
      
      return isSufficientlyLarge;
    }
    
    return false;
  }
}
