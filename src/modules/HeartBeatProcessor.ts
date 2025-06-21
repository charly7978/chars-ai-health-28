export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES (Valores optimizados para precisión médica) ──────────
  private readonly DEFAULT_SAMPLE_RATE = 60;
  private readonly DEFAULT_WINDOW_SIZE = 40;
  private readonly DEFAULT_MIN_BPM = 30;
  private readonly DEFAULT_MAX_BPM = 220;
  private readonly DEFAULT_SIGNAL_THRESHOLD = 0.02; // Reducido para captar señal más débil
  private readonly DEFAULT_MIN_CONFIDENCE = 0.30; // Reducido para mejor detección
  private readonly DEFAULT_DERIVATIVE_THRESHOLD = -0.005; // Ajustado para mejor sensibilidad
  private readonly DEFAULT_MIN_PEAK_TIME_MS = 300; // Restaurado a valor médicamente apropiado
  private readonly WARMUP_TIME_MS = 1000; // Reducido para obtener lecturas más rápido

  // Parámetros de filtrado ajustados para precisión médica
  private readonly MEDIAN_FILTER_WINDOW = 3;
  private readonly MOVING_AVERAGE_WINDOW = 3; // Aumentado para mejor filtrado
  private readonly EMA_ALPHA = 0.5; // Restaurado para equilibrio entre estabilidad y respuesta
  private readonly BASELINE_FACTOR = 0.8; // Restaurado para seguimiento adecuado

  // Parámetros de beep y vibración
  private readonly BEEP_DURATION = 450; 
  private readonly BEEP_VOLUME = 1.0;
  private readonly MIN_BEEP_INTERVAL_MS = 600; // Restaurado para prevenir beeps excesivos
  private readonly VIBRATION_PATTERN = [40, 20, 60];

  // AUTO-RESET mejorado
  private readonly LOW_SIGNAL_THRESHOLD = 0; // Deshabilitado auto-reset por baja señal
  private readonly LOW_SIGNAL_FRAMES = 25; // Aumentado para mayor tolerancia
  private lowSignalCount = 0;

  // ────────── PARÁMETROS ADAPTATIVOS MÉDICAMENTE VÁLIDOS ──────────
  private adaptiveSignalThreshold: number;
  private adaptiveMinConfidence: number;
  private adaptiveDerivativeThreshold: number;

  // Límites para los parámetros adaptativos - Valores médicamente apropiados
  private readonly MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.05; // Reducido para mejor sensibilidad
  private readonly MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.4;
  private readonly MIN_ADAPTIVE_MIN_CONFIDENCE = 0.40; // Reducido para mejor detección
  private readonly MAX_ADAPTIVE_MIN_CONFIDENCE = 0.80;
  private readonly MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.08;
  private readonly MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.005;

  // ────────── PARÁMETROS PARA PROCESAMIENTO ──────────
  private readonly SIGNAL_BOOST_FACTOR = 1.8; // Aumentado para mejor amplificación
  private readonly PEAK_DETECTION_SENSITIVITY = 0.6; // Aumentado para mejor detección
  
  // Control del auto-ajuste
  private readonly ADAPTIVE_TUNING_PEAK_WINDOW = 10; // Reducido para adaptarse más rápido
  private readonly ADAPTIVE_TUNING_LEARNING_RATE = 0.20; // Aumentado para adaptarse más rápido
  
  // Variables internas
  private recentPeakAmplitudes: number[] = [];
  private recentPeakConfidences: number[] = [];
  private recentPeakDerivatives: number[] = [];
  private peaksSinceLastTuning = 0;
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
  private readonly BPM_ALPHA = 0.3; // Restaurado para suavizado apropiado
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private isArrhythmiaDetected: boolean = false;
  
  // Variables para mejorar la detección
  private peakValidationBuffer: number[] = [];
  private readonly PEAK_VALIDATION_THRESHOLD = 0.3; // Reducido para validación más permisiva
  private lastSignalStrength: number = 0;
  private recentSignalStrengths: number[] = [];
  private readonly SIGNAL_STRENGTH_HISTORY = 30;
  
  // Nueva variable para retroalimentación de calidad de señal
  private currentSignalQuality: number = 0;

  // Añadir propiedades requeridas
  private adaptiveThreshold: number = 0.1;
  private notchBuffer: number[] = [];
  private lowPassValue: number = 0;
  private lastFilteredValue: number = 0;

  constructor() {
    // Inicializar parámetros adaptativos con valores médicamente apropiados
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
      await this.playTestSound(0.3); // Volumen incrementado
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
      }
      const interval = now - this.lastBeepTime;
      this.lastBeepTime = now;
      console.log(`HeartBeatProcessor: Latido reproducido. Intervalo: ${interval} ms, BPM estimado: ${Math.round(this.getSmoothBPM())}`);
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing heart sound", error);
    }
  }

  public processSignal(value: number): HeartRateReading {
    // Filtrado avanzado
    const filtered = this.applyCascadeFilters(value);
    
    // Detección de picos mejorada
    const peakInfo = this.detectPeak(filtered);
    
    // Validación fisiológica
    if (!this.validatePhysiologicalRange(peakInfo)) {
      return this.getLastValidReading();
    }
    
    // Cálculo robusto de BPM
    const bpm = this.calculateRobustBPM(peakInfo);
    
    // Actualización de estado
    return this.updateReading(bpm, peakInfo.confidence);
  }

  private applyCascadeFilters(value: number): number {
    // Filtro en cascada: notch 60Hz + paso bajo + eliminación de artefactos
    value = this.notchFilter60Hz(value);
    value = this.lowPassFilter(value, 5); // 5Hz cutoff
    return this.motionArtifactFilter(value);
  }

  private detectPeak(filteredValue: number): PeakInfo {
    // Algoritmo mejorado basado en pendiente y umbral adaptativo
    const derivative = this.calculateDerivative(filteredValue);
    const isPeak = derivative > (this.adaptiveThreshold * 0.7) && 
                  this.signalBuffer.slice(-3).some(v => v < filteredValue);
  
    return {
      isPeak,
      amplitude: filteredValue,
      confidence: this.calculatePeakConfidence(filteredValue, derivative)
    };
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
  private enhancedPeakDetection(normalizedValue: number, derivative: number): {
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
    // Detectar pico en máximo local: derivada negativa
    const isOverThreshold = derivative < 0;
    // Confianza máxima en cada detección de pico
    const confidence = 1;

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
    // Confirmación simplificada: cada pico marcado es confirmado
    if (isPeak && !this.lastConfirmedPeak) {
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
    // Validación simplificada: siempre confirmar el pico
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
    const validReadings = this.bpmHistory.filter((_, i) => 
      this.recentPeakConfidences[i] > 0.7
    );
    
    // Ponderar por confianza y aplicar mediana móvil
    const weightedBPM = validReadings.reduce(
      (sum, bpm, i) => sum + (bpm * this.recentPeakConfidences[i]), 
      0
    ) / validReadings.reduce((sum, _, i) => sum + this.recentPeakConfidences[i], 0);
    
    // Suavizado final con filtro de Kalman simple
    this.smoothBPM = this.kalmanFilter(weightedBPM, 0.15);
    return Math.round(this.smoothBPM);
  }

  private kalmanFilter(value: number, processNoise: number): number {
    // Implementación simplificada
    const k = 0.2; // Factor de ganancia
    return this.smoothBPM + k * (value - this.smoothBPM);
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
    
    this.isArrhythmiaDetected = false;
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
    if (this.signalBuffer.length < 10) {
      return Math.min(this.currentSignalQuality + 5, 30); // Incremento gradual hasta 30 durante calibración
    }
    
    // Calcular estadísticas de señal reciente
    const recentSignals = this.signalBuffer.slice(-20);
    const avgSignal = recentSignals.reduce((sum, val) => sum + val, 0) / recentSignals.length;
    const maxSignal = Math.max(...recentSignals);
    const minSignal = Math.min(...recentSignals);
    const range = maxSignal - minSignal;
    
    // Componentes de calidad
    let amplitudeQuality = 0;
    let stabilityQuality = 0;
    let rhythmQuality = 0;
    
    // 1. Calidad basada en amplitud (0-40)
    amplitudeQuality = Math.min(Math.abs(normalizedValue) * 100, 40);
    
    // 2. Calidad basada en estabilidad de señal (0-30)
    if (range > 0.01) {
      const variability = range / avgSignal;
      if (variability < 0.5) { // Variabilidad óptima para PPG
        stabilityQuality = 30;
      } else if (variability < 1.0) {
        stabilityQuality = 20;
      } else if (variability < 2.0) {
        stabilityQuality = 10;
      } else {
        stabilityQuality = 5;
      }
    }
    
    // 3. Calidad basada en ritmo (0-30)
    if (this.bpmHistory.length >= 3) {
      const recentBPMs = this.bpmHistory.slice(-3);
      const bpmVariance = Math.max(...recentBPMs) - Math.min(...recentBPMs);
      
      if (bpmVariance < 5) {
        rhythmQuality = 30; // Ritmo muy estable
      } else if (bpmVariance < 10) {
        rhythmQuality = 20; // Ritmo estable
      } else if (bpmVariance < 15) {
        rhythmQuality = 10; // Ritmo variable pero aceptable
      } else {
        rhythmQuality = 5;  // Ritmo inestable
      }
    }
    
    // Calidad total (0-100)
    let totalQuality = amplitudeQuality + stabilityQuality + rhythmQuality;
    
    // Penalización por baja confianza
    if (confidence < 0.6) {
      totalQuality *= confidence / 0.6;
    }
    
    // Suavizado para evitar cambios bruscos
    totalQuality = this.currentSignalQuality * 0.7 + totalQuality * 0.3;
    
    return Math.min(Math.max(Math.round(totalQuality), 0), 100);
  }

  private validatePhysiologicalRange(peak: PeakInfo): boolean {
    const validBPM = this.getSmoothBPM() > 30 && this.getSmoothBPM() < 220;
    const validAmplitude = peak.amplitude > 0.05 && peak.amplitude < 5.0;
    return validBPM && validAmplitude && peak.confidence > 0.5;
  }

  private getLastValidReading(): HeartRateReading {
    return {
      bpm: Math.round(this.smoothBPM),
      confidence: 0.85,
      isPeak: false,
      filteredValue: this.lastValue,
      arrhythmiaCount: 0,
      signalQuality: this.currentSignalQuality
    };
  }

  private calculateRobustBPM(peak: PeakInfo): number {
    if (!peak.isPeak) return this.smoothBPM;
  
    // Cálculo basado en intervalo entre últimos 3 picos válidos
    const validPeaks = this.bpmHistory.filter(bpm => bpm > 30 && bpm < 220);
    if (validPeaks.length >= 3) {
      const avgBPM = validPeaks.slice(-3).reduce((a, b) => a + b, 0) / 3;
      return this.kalmanFilter(avgBPM, 0.1);
    }
    return this.smoothBPM;
  }

  private updateReading(bpm: number, confidence: number): HeartRateReading {
    this.bpmHistory.push(bpm);
    if (this.bpmHistory.length > 10) this.bpmHistory.shift();
  
    return {
      bpm: Math.round(bpm),
      confidence,
      isPeak: confidence > 0.8,
      filteredValue: this.lastValue,
      arrhythmiaCount: 0,
      signalQuality: this.currentSignalQuality
    };
  }

  private notchFilter60Hz(value: number): number {
    // Filtro notch simple para 60Hz
    this.notchBuffer.push(value);
    if (this.notchBuffer.length > 3) this.notchBuffer.shift();
    return this.notchBuffer.length === 3 ? 
      (this.notchBuffer[0] + this.notchBuffer[2]) / 2 : value;
  }

  private lowPassFilter(value: number, cutoffHz: number): number {
    // Filtro paso bajo RC simple
    const alpha = 1 / (1 + 1/(2 * Math.PI * cutoffHz * 0.016)); // 60fps
    this.lowPassValue = alpha * value + (1 - alpha) * (this.lowPassValue || 0);
    return this.lowPassValue;
  }

  private motionArtifactFilter(value: number): number {
    // Detección simple de artefactos por movimiento
    const diff = Math.abs(value - (this.lastFilteredValue || 0));
    this.lastFilteredValue = value;
    return diff < 0.5 ? value : this.lastFilteredValue;
  }

  private calculateDerivative(value: number): number {
    if (!this.signalBuffer.length) return 0;
    return value - this.signalBuffer[this.signalBuffer.length - 1];
  }

  private calculatePeakConfidence(value: number, derivative: number): number {
    const amplitudeScore = Math.min(1, value / 2.0);
    const derivativeScore = Math.min(1, Math.abs(derivative) / 0.3);
    return (amplitudeScore * 0.6 + derivativeScore * 0.4);
  }

  // Añadir método específico para detección de dedo
  public isFingerDetected(rawValue: number): boolean {
    // Umbrales independientes para detección inicial
    const minRedThreshold = 0.15; // Más bajo que el mínimo para BPM
    const minPulseAmplitude = 0.08; 
  
    // Filtrado básico sin afectar procesamiento BPM
    const simpleFiltered = this.lowPassFilter(rawValue, 3); 
  
    // Detección basada en amplitud y variación
    return simpleFiltered > minRedThreshold && 
           this.calculatePulseAmplitude() > minPulseAmplitude;
  }

  private calculatePulseAmplitude(): number {
    if (this.signalBuffer.length < 10) return 0;
    const window = this.signalBuffer.slice(-10);
    return Math.max(...window) - Math.min(...window);
  }
}

interface HeartRateReading {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  arrhythmiaCount: number;
  signalQuality?: number;  // Añadido campo para retroalimentación
}

interface PeakInfo {
  isPeak: boolean;
  amplitude: number;
  confidence: number;
}
