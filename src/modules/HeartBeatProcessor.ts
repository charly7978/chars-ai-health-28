export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES (Valores por defecto) ──────────
  private readonly DEFAULT_SAMPLE_RATE = 60;
  private readonly DEFAULT_WINDOW_SIZE = 60;
  private readonly DEFAULT_MIN_BPM = 40;
  private readonly DEFAULT_MAX_BPM = 200;
  private readonly DEFAULT_SIGNAL_THRESHOLD = 0.30;
  private readonly DEFAULT_MIN_CONFIDENCE = 0.70;
  private readonly DEFAULT_DERIVATIVE_THRESHOLD = -0.02;
  private readonly DEFAULT_MIN_PEAK_TIME_MS = 400; // (Corresponde a 150 BPM max)
  private readonly WARMUP_TIME_MS = 3000;

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 5;
  private readonly MOVING_AVERAGE_WINDOW = 2;
  private readonly EMA_ALPHA = 0.4;
  private readonly BASELINE_FACTOR = 1.0;

  // Parámetros de beep y vibración
  private readonly BEEP_DURATION = 450;
  private readonly BEEP_VOLUME = 1.0;
  private readonly MIN_BEEP_INTERVAL_MS = 300;
  private readonly VIBRATION_PATTERN = [60, 40, 100];

  // Auto-reset si la señal es muy baja
  private readonly LOW_SIGNAL_THRESHOLD = 0.05;
  private readonly LOW_SIGNAL_FRAMES = 10;
  private lowSignalCount = 0;

  // ────────── PARÁMETROS ADAPTATIVOS ──────────
  private adaptiveSignalThreshold: number;
  private adaptiveMinConfidence: number;
  private adaptiveDerivativeThreshold: number;

  // Límites para los parámetros adaptativos
  private readonly MIN_ADAPTIVE_SIGNAL_THRESHOLD = 0.15; // No bajar demasiado
  private readonly MAX_ADAPTIVE_SIGNAL_THRESHOLD = 0.6; // No subir demasiado
  private readonly MIN_ADAPTIVE_MIN_CONFIDENCE = 0.55;
  private readonly MAX_ADAPTIVE_MIN_CONFIDENCE = 0.85;
  private readonly MIN_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.05; // Más sensible
  private readonly MAX_ADAPTIVE_DERIVATIVE_THRESHOLD = -0.01; // Menos sensible

  // Control del auto-ajuste
  private readonly ADAPTIVE_TUNING_PEAK_WINDOW = 20; // Nº de picos para evaluar
  private readonly ADAPTIVE_TUNING_LEARNING_RATE = 0.1; // Cuán rápido se ajusta
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
  private readonly BPM_ALPHA = 0.2;
  private peakCandidateIndex: number | null = null; // No usado activamente, pero mantenido por si acaso
  private peakCandidateValue: number = 0; // No usado activamente
  private isArrhythmiaDetected: boolean = false;

  constructor() {
    // Inicializar parámetros adaptativos con los valores por defecto
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
      await this.playTestSound(0.2);
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playTestSound(volume: number = 0.2) {
    if (!this.audioContext) return;
    try {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.6);
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing test sound", error);
    }
  }

  // Modificado: Reproducir sonido de latido con opción de arritmia más sutil y síncrona
  private async playHeartSound(volume: number = this.BEEP_VOLUME, isArrhythmic: boolean = false) {
    if (!this.audioContext || this.isInWarmup()) {
      // console.log("HeartBeatProcessor: No se puede reproducir - AudioContext no disponible o en warmup");
      return;
    }

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      // console.log("HeartBeatProcessor: Demasiado pronto para otro sonido");
      return;
    }

    try {
      // console.log(`HeartBeatProcessor: Reproduciendo sonido de latido ${isArrhythmic ? 'arrítmico (síncrono)' : 'normal'} con volumen:`, volume);
      
      if (navigator.vibrate) {
        navigator.vibrate(this.VIBRATION_PATTERN);
      }

      const currentTime = this.audioContext.currentTime;

      // Primera parte del latido ("LUB")
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
      
      // Segunda parte del latido ("DUB")
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode2 = this.audioContext.createGain();
      
      const dubStartTime = currentTime + 0.1;
      oscillator2.type = 'sine';
      oscillator2.frequency.value = 120;
      
      gainNode2.gain.setValueAtTime(0, dubStartTime);
      gainNode2.gain.linearRampToValueAtTime(volume * 1.2, dubStartTime + 0.03); 
      gainNode2.gain.exponentialRampToValueAtTime(0.001, dubStartTime + 0.2); // DUB dura 0.2s (total 0.1 + 0.2 = 0.3s desde el inicio)
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(this.audioContext.destination);
      
      oscillator2.start(dubStartTime);
      oscillator2.stop(dubStartTime + 0.25); // Asegurar que se detenga
      
      // Tercer sonido para arritmias (superpuesto con el DUB)
      if (isArrhythmic) {
        const oscillator3 = this.audioContext.createOscillator();
        const gainNode3 = this.audioContext.createGain();
        
        oscillator3.type = 'sine'; // Mantenemos 'sine' para un tono claro
        oscillator3.frequency.value = 440; // Frecuencia A4, distintiva del latido base

        // Tiempos para el sonido de arritmia, diseñado para sonar *durante* el DUB
        const arrhythmiaSoundStartTime = dubStartTime + 0.01; // Ligeramente después del inicio del DUB para no solapar el ataque
        const arrhythmiaAttackDuration = 0.02;
        const arrhythmiaSustainDuration = 0.10; // Duración del tono de arritmia
        const arrhythmiaReleaseDuration = 0.05;

        const arrhythmiaAttackEndTime = arrhythmiaSoundStartTime + arrhythmiaAttackDuration;
        const arrhythmiaSustainEndTime = arrhythmiaAttackEndTime + arrhythmiaSustainDuration;
        const arrhythmiaReleaseEndTime = arrhythmiaSustainEndTime + arrhythmiaReleaseDuration;

        gainNode3.gain.setValueAtTime(0, arrhythmiaSoundStartTime);
        // Un volumen ligeramente menor para que se mezcle pero sea distintivo
        gainNode3.gain.linearRampToValueAtTime(volume * 0.65, arrhythmiaAttackEndTime); 
        gainNode3.gain.setValueAtTime(volume * 0.65, arrhythmiaSustainEndTime); // Mantener durante el sustain
        gainNode3.gain.exponentialRampToValueAtTime(0.001, arrhythmiaReleaseEndTime);
        
        oscillator3.connect(gainNode3);
        gainNode3.connect(this.audioContext.destination);
        
        oscillator3.start(arrhythmiaSoundStartTime);
        oscillator3.stop(arrhythmiaReleaseEndTime + 0.01); // Detener poco después de la rampa
        
        // console.log("HeartBeatProcessor: Sonido de arritmia (superpuesto) reproducido");
      }
      
      // console.log("HeartBeatProcessor: Sonido de latido reproducido correctamente");
      this.lastBeepTime = now;
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing heart sound", error);
    }
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

  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number; // Mantener por compatibilidad, aunque no se usa aquí
  } {
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.DEFAULT_WINDOW_SIZE) { // Usar DEFAULT_WINDOW_SIZE
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 30) { // Umbral de buffer mínimo
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0,
      };
    }

    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
    const normalizedValue = smoothed - this.baseline;
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

    // Usar parámetros adaptativos en detectPeak
    const { isPeak, confidence, rawDerivative } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.DEFAULT_MIN_PEAK_TIME_MS) { // Usar DEFAULT_MIN_PEAK_TIME_MS
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;

        this.playHeartSound(0.95, this.isArrhythmiaDetected);
        this.updateBPM();

        // Recopilar datos para auto-ajuste
        this.recentPeakAmplitudes.push(normalizedValue);
        this.recentPeakConfidences.push(confidence);
        if (rawDerivative !== undefined) this.recentPeakDerivatives.push(rawDerivative); // Guardar la derivada real del pico

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
        if (this.peaksSinceLastTuning >= this.ADAPTIVE_TUNING_PEAK_WINDOW) {
          this.performAdaptiveTuning();
          this.peaksSinceLastTuning = 0; // Reiniciar contador
        }
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0, // Mantener por compatibilidad
    };
  }

  // Método para establecer externamente si se detectó una arritmia
  public setArrhythmiaDetected(isDetected: boolean): void {
    this.isArrhythmiaDetected = isDetected;
    // console.log(`HeartBeatProcessor: Estado de arritmia establecido a ${isDetected}`);
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
        console.log("HeartBeatProcessor: auto-reset adaptative parameters (low signal).");
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    // this.peakCandidateIndex = null; // No se usa activamente
    // this.peakCandidateValue = 0; // No se usa activamente
    this.peakConfirmationBuffer = [];
    this.values = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
    rawDerivative?: number; // Devolvemos la derivada para el tuning
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.DEFAULT_MIN_PEAK_TIME_MS) { // Usar DEFAULT_MIN_PEAK_TIME_MS
      return { isPeak: false, confidence: 0 };
    }

    // Usar los umbrales adaptativos
    const isOverThreshold =
      derivative < this.adaptiveDerivativeThreshold && // AJUSTADO
      normalizedValue > this.adaptiveSignalThreshold && // AJUSTADO
      this.lastValue > this.baseline * 0.98; // Condición de estar sobre la línea base

    // La confianza de amplitud se calcula relativa al umbral adaptativo actual
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.adaptiveSignalThreshold * 1.8), 0), // AJUSTADO
      1
    );
    // La confianza de derivada se calcula relativa al umbral adaptativo actual
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.adaptiveDerivativeThreshold * 0.8), 0), // AJUSTADO
      1
    );

    const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

    return { isPeak: isOverThreshold, confidence, rawDerivative: derivative };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) { // Ventana de confirmación
      this.peakConfirmationBuffer.shift();
    }
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / this.peakConfirmationBuffer.length;

    // Usar adaptiveMinConfidence y adaptiveSignalThreshold
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.adaptiveMinConfidence && avgBuffer > this.adaptiveSignalThreshold) { // AJUSTADO
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3];
        if (goingDown1 && goingDown2) {
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
    if (instantBPM >= this.DEFAULT_MIN_BPM && instantBPM <= this.DEFAULT_MAX_BPM) { // Usar DEFAULT_MIN/MAX_BPM
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) { // Historial de BPM para cálculo
        this.bpmHistory.shift();
      }
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0 && rawBPM > 0) { // Inicializar si hay un BPM válido
        this.smoothBPM = rawBPM;
    } else if (rawBPM > 0) { // Solo actualizar si hay un BPM válido
        this.smoothBPM =
            this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    } else if (this.bpmHistory.length === 0) { // Si no hay historial, resetea BPM suave
        this.smoothBPM = 0;
    }
    // Si rawBPM es 0 y smoothBPM no es 0, se mantiene el último smoothBPM conocido por un tiempo
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    // Usar mediana para robustez en el cálculo del BPM actual
    const sortedBPM = [...this.bpmHistory].sort((a,b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    if (sortedBPM.length % 2 === 0) {
        return (sortedBPM[mid-1] + sortedBPM[mid]) / 2;
    }
    return sortedBPM[mid];
  }

  public getFinalBPM(): number { // Este método podría no ser necesario si getSmoothBPM es suficientemente bueno
    if (this.bpmHistory.length < 5) {
      return Math.round(this.getSmoothBPM()); // Devolver el BPM suavizado si no hay suficientes datos
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    // Un recorte más conservador para mantener más datos
    const cut = Math.floor(sorted.length * 0.2); // 20% de cada lado
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) {
        // Si el recorte elimina todos los datos (raro con el 20%), usar el BPM suavizado
        return Math.round(this.getSmoothBPM());
    }
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    // El return original tenía sum / finalSet.length / finalSet.length, lo cual es un error.
    // Debería ser sum / finalSet.length
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
    // this.peakCandidateIndex = null; // No se usa
    // this.peakCandidateValue = 0; // No se usa
    this.lowSignalCount = 0;

    // Resetear parámetros adaptativos y su historial
    this.adaptiveSignalThreshold = this.DEFAULT_SIGNAL_THRESHOLD;
    this.adaptiveMinConfidence = this.DEFAULT_MIN_CONFIDENCE;
    this.adaptiveDerivativeThreshold = this.DEFAULT_DERIVATIVE_THRESHOLD;
    this.recentPeakAmplitudes = [];
    this.recentPeakConfidences = [];
    this.recentPeakDerivatives = [];
    this.peaksSinceLastTuning = 0;
    console.log("HeartBeatProcessor: Full reset including adaptive parameters.");
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    // bpmHistory contiene BPMs, no intervalos RR directamente.
    // Para obtener intervalos RR, necesitaríamos almacenar los tiempos de los picos.
    // Por ahora, devolvemos una representación basada en bpmHistory si es necesario,
    // o se podría modificar para almacenar intervalos directamente.
    const rrIntervals = this.bpmHistory.map(bpm => 60000 / bpm);
    return {
      intervals: rrIntervals, // Esto es una aproximación, idealmente se guardan los intervalos directamente
      lastPeakTime: this.lastPeakTime,
    };
  }

  // ────────── LÓGICA DE AUTO-AJUSTE ADAPTATIVO ──────────
  private performAdaptiveTuning(): void {
    if (this.isInWarmup() || this.recentPeakAmplitudes.length < this.ADAPTIVE_TUNING_PEAK_WINDOW / 2) {
      // No ajustar si estamos en calentamiento o no hay suficientes datos
      return;
    }

    // --- Ajuste de SIGNAL_THRESHOLD ---
    if (this.recentPeakAmplitudes.length > 0) {
      const avgAmplitude = this.recentPeakAmplitudes.reduce((s, v) => s + v, 0) / this.recentPeakAmplitudes.length;
      // Queremos que el umbral sea una fracción de la amplitud media de los picos detectados
      // Por ejemplo, si los picos son de 0.8, un umbral de 0.4 (50%) podría ser bueno.
      // Si los picos son de 0.4, un umbral de 0.2 (50%) podría ser bueno.
      let targetSignalThreshold = avgAmplitude * 0.6; // Apuntar al 60% de la amplitud media del pico

      // Aplicar ajuste gradual (interpolación lineal)
      this.adaptiveSignalThreshold = 
          this.adaptiveSignalThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) +
          targetSignalThreshold * this.ADAPTIVE_TUNING_LEARNING_RATE;
      
      // Limitar dentro del rango permitido
      this.adaptiveSignalThreshold = Math.max(this.MIN_ADAPTIVE_SIGNAL_THRESHOLD, Math.min(this.MAX_ADAPTIVE_SIGNAL_THRESHOLD, this.adaptiveSignalThreshold));
    }

    // --- Ajuste de MIN_CONFIDENCE ---
    if (this.recentPeakConfidences.length > 0) {
      const avgConfidence = this.recentPeakConfidences.reduce((s, v) => s + v, 0) / this.recentPeakConfidences.length;
      let targetMinConfidence = this.adaptiveMinConfidence; // Por defecto no cambiar

      // Si la confianza media es muy alta, podríamos ser un poco más estrictos (subir MIN_CONFIDENCE)
      if (avgConfidence > 0.9 && this.adaptiveMinConfidence < this.MAX_ADAPTIVE_MIN_CONFIDENCE - 0.05) {
        targetMinConfidence = this.adaptiveMinConfidence + 0.02; // Aumento pequeño
      } 
      // Si la confianza media es baja pero los picos se confirman, podríamos relajar un poco
      else if (avgConfidence < 0.75 && avgConfidence > this.MIN_ADAPTIVE_MIN_CONFIDENCE + 0.05 && this.adaptiveMinConfidence > this.MIN_ADAPTIVE_MIN_CONFIDENCE + 0.05) {
         // Solo relajar si la confianza media no es demasiado baja, para evitar falsos positivos
        targetMinConfidence = this.adaptiveMinConfidence - 0.02; // Reducción pequeña
      }
      
      this.adaptiveMinConfidence =
          this.adaptiveMinConfidence * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) +
          targetMinConfidence * this.ADAPTIVE_TUNING_LEARNING_RATE;
      this.adaptiveMinConfidence = Math.max(this.MIN_ADAPTIVE_MIN_CONFIDENCE, Math.min(this.MAX_ADAPTIVE_MIN_CONFIDENCE, this.adaptiveMinConfidence));
    }
    
    // --- Ajuste de DERIVATIVE_THRESHOLD ---
    if (this.recentPeakDerivatives.length > 0) {
        const avgDerivative = this.recentPeakDerivatives.reduce((s,v) => s+v, 0) / this.recentPeakDerivatives.length;
        // El umbral de derivada es negativo. Queremos que sea, por ejemplo, el 50% de la derivada media observada.
        // Si la derivada media es -0.04, un umbral de -0.02 podría ser bueno.
        // Si la derivada media es -0.02, un umbral de -0.01 podría ser bueno.
        let targetDerivativeThreshold = avgDerivative * 0.5; // Apuntar al 50% de la magnitud de la derivada media

        this.adaptiveDerivativeThreshold = 
            this.adaptiveDerivativeThreshold * (1 - this.ADAPTIVE_TUNING_LEARNING_RATE) +
            targetDerivativeThreshold * this.ADAPTIVE_TUNING_LEARNING_RATE;

        // Limitar (recordar que son valores negativos)
        this.adaptiveDerivativeThreshold = Math.max(this.MIN_ADAPTIVE_DERIVATIVE_THRESHOLD, Math.min(this.MAX_ADAPTIVE_DERIVATIVE_THRESHOLD, this.adaptiveDerivativeThreshold));
    }

    // console.log(`HeartBeatProcessor: Adaptive tuning performed. 
    // New Signal Threshold: ${this.adaptiveSignalThreshold.toFixed(3)}, 
    // New Min Confidence: ${this.adaptiveMinConfidence.toFixed(3)},
    // New Derivative Threshold: ${this.adaptiveDerivativeThreshold.toFixed(3)}`);

    // Limpiar buffers para la próxima ventana de ajuste, o no, para que sea un promedio más largo.
    // Por ahora, no los limpiamos para que sea un promedio móvil más largo.
    // Si se quisiera un ajuste basado solo en la última ventana:
    // this.recentPeakAmplitudes = [];
    // this.recentPeakConfidences = [];
    // this.recentPeakDerivatives = [];
  }
}
