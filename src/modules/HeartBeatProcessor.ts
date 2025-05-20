
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 60; //ANTES 3
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40; // 
  private readonly MAX_BPM = 200; // Se mantiene amplio para no perder picos fuera de rango
  private readonly SIGNAL_THRESHOLD = 0.30; //ANTES 40
  private readonly MIN_CONFIDENCE = 0.70;  // 60
  private readonly DERIVATIVE_THRESHOLD = -0.02; // -003
  private readonly MIN_PEAK_TIME_MS = 400; 
  private readonly WARMUP_TIME_MS = 3000; 

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 5; 
  private readonly MOVING_AVERAGE_WINDOW = 2; 
  private readonly EMA_ALPHA = 0.4; 
  private readonly BASELINE_FACTOR = 1.0; 

  // Parámetros de beep y vibración - Actualizados para mejor audibilidad
  private readonly BEEP_DURATION = 450; 
  private readonly BEEP_VOLUME = 1.0; // Volumen máximo
  private readonly MIN_BEEP_INTERVAL_MS = 300;
  private readonly VIBRATION_PATTERN = [60, 40, 100]; 

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.05;
  private readonly LOW_SIGNAL_FRAMES = 10;
  private lowSignalCount = 0;

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
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private isArrhythmiaDetected: boolean = false; // Nuevo: indica si se detectó una arritmia

  constructor() {
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
      console.log("HeartBeatProcessor: Reproduciendo sonido de prueba");
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
      
      console.log("HeartBeatProcessor: Sonido de prueba reproducido");
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing test sound", error);
    }
  }

  // Modificado: Reproducir sonido de latido con opción de arritmia más sutil
  private async playHeartSound(volume: number = this.BEEP_VOLUME, isArrhythmic: boolean = false) {
    if (!this.audioContext || this.isInWarmup()) {
      console.log("HeartBeatProcessor: No se puede reproducir - AudioContext no disponible o en warmup");
      return;
    }

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      console.log("HeartBeatProcessor: Demasiado pronto para otro sonido");
      return;
    }

    try {
      console.log(`HeartBeatProcessor: Reproduciendo sonido de latido ${isArrhythmic ? 'arrítmico' : 'normal'} con volumen:`, volume);
      
      // Vibrar el dispositivo
      if (navigator.vibrate) {
        navigator.vibrate(this.VIBRATION_PATTERN);
      }

      // Primera parte del latido ("LUB")
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.value = 120; // Frecuencia igual al "dub" (120Hz)
      
      gainNode1.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode1.gain.linearRampToValueAtTime(volume * 1.2, this.audioContext.currentTime + 0.03); // Volumen ligeramente aumentado
      gainNode1.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      
      oscillator1.start(this.audioContext.currentTime);
      oscillator1.stop(this.audioContext.currentTime + 0.2);
      
      // Segunda parte del latido ("DUB")
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode2 = this.audioContext.createGain();
      
      oscillator2.type = 'sine';
      oscillator2.frequency.value = 120;
      
      gainNode2.gain.setValueAtTime(0, this.audioContext.currentTime + 0.1);
      gainNode2.gain.linearRampToValueAtTime(volume * 1.2, this.audioContext.currentTime + 0.13); // Volumen ligeramente aumentado
      gainNode2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(this.audioContext.destination);
      
      oscillator2.start(this.audioContext.currentTime + 0.1);
      oscillator2.stop(this.audioContext.currentTime + 0.35);
      
      // Tercer sonido para arritmias (solo si hay arritmia detectada)
      if (isArrhythmic) {
        const oscillator3 = this.audioContext.createOscillator();
        const gainNode3 = this.audioContext.createGain();
        
        // Cambiado a un beep más sutil (sine en vez de sawtooth)
        oscillator3.type = 'sine';
        oscillator3.frequency.value = 440; // Frecuencia estándar de beep (440Hz - A4)
        
        gainNode3.gain.setValueAtTime(0, this.audioContext.currentTime + 0.36); // Inicia después del segundo sonido
        gainNode3.gain.linearRampToValueAtTime(volume * 0.7, this.audioContext.currentTime + 0.38); // Volumen más bajo (70%)
        gainNode3.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
        
        oscillator3.connect(gainNode3);
        gainNode3.connect(this.audioContext.destination);
        
        oscillator3.start(this.audioContext.currentTime + 0.36); // Comienza después de los otros sonidos
        oscillator3.stop(this.audioContext.currentTime + 0.6);
        
        console.log("HeartBeatProcessor: Beep de arritmia reproducido");
      }
      
      console.log("HeartBeatProcessor: Sonido de latido reproducido correctamente");
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
    arrhythmiaCount: number;
  } {
    // Filtros sucesivos para mejorar la señal
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 30) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
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

    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        // Reproducir sonido solo pasando el estado de arritmia cuando realmente está detectada
        console.log("HeartBeatProcessor: Pico detectado, intentando reproducir sonido");
        this.playHeartSound(0.95, this.isArrhythmiaDetected);
        
        this.updateBPM();
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0
    };
  }

  // Método para establecer externamente si se detectó una arritmia
  public setArrhythmiaDetected(isDetected: boolean): void {
    this.isArrhythmiaDetected = isDetected;
    console.log(`HeartBeatProcessor: Estado de arritmia establecido a ${isDetected}`);
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.98;

    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.8), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.8), 0),
      1
    );

    // Aproximación a la confianza final
    const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

    return { isPeak: isOverThreshold, confidence };
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
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / this.peakConfirmationBuffer.length;
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE && avgBuffer > this.SIGNAL_THRESHOLD) {
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
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) {
        this.bpmHistory.shift();
      }
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    if (!trimmed.length) return 0;
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length < 5) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.1);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    if (!finalSet.length) return 0;
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
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
