export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200; // Se mantiene amplio para no perder picos fuera de rango
  private readonly SIGNAL_THRESHOLD = 0.40; 
  private readonly MIN_CONFIDENCE = 0.60;
  private readonly DERIVATIVE_THRESHOLD = -0.03; 
  private readonly MIN_PEAK_TIME_MS = 400; 
  private readonly WARMUP_TIME_MS = 3000; 

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 3; 
  private readonly MOVING_AVERAGE_WINDOW = 3; 
  private readonly EMA_ALPHA = 0.4; 
  private readonly BASELINE_FACTOR = 1.0; 
  private readonly MEDIAN_BPM_BUFFER_SIZE = 7; // Tamaño del buffer para mediana final del BPM

  // Parámetros de beep
  private readonly BEEP_PRIMARY_FREQUENCY = 880; 
  private readonly BEEP_SECONDARY_FREQUENCY = 440; 
  private readonly BEEP_DURATION = 80; 
  private readonly BEEP_VOLUME = 0.9; 
  private readonly MIN_BEEP_INTERVAL_MS = 300;

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.03;
  private readonly LOW_SIGNAL_FRAMES = 10;
  private lowSignalCount = 0;

  // Variables internas
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private audioContext: AudioContext | null = null;
  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private bpmMedianBuffer: number[] = []; // Buffer para mediana del BPM final
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private peakConfirmationBuffer: number[] = []; // Para confirmar picos con valores numéricos
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 0;
  private readonly BPM_ALPHA = 0.2;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();

      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.BEEP_SECONDARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Envelope del sonido principal
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Envelope del sonido secundario
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.3,
        this.audioContext.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      primaryOscillator.start();
      secondaryOscillator.start();

      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);

      this.lastBeepTime = now;
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
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
        this.playBeep(0.12); // Suena beep cuando se confirma pico
        this.updateBPM();
      }
    }
    
    // Obtener BPM actual con suavizado
    const currentBPM = this.getSmoothBPM();
    
    // Añadir al buffer de mediana para estabilizar el resultado final
    if (currentBPM > 0) {
      this.addToBpmMedianBuffer(Math.round(currentBPM));
    }
    
    // Calcular la mediana final para obtener un valor más estable
    const medianBPM = this.calculateBpmMedian();

    return {
      bpm: medianBPM,
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0
    };
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
    // Implementa un detector de picos basado en valor y derivada
    let isPeak = false;
    let confidence = 0;

    // Sólo consideramos picos cuando el valor normalizado es positivo
    // Y la derivada se vuelve negativa (cambio de pendiente)
    if (normalizedValue > this.SIGNAL_THRESHOLD && derivative < this.DERIVATIVE_THRESHOLD) {
      // Si ya hay un candidato a pico, comprobamos si este es mejor
      if (
        this.peakCandidateIndex !== null &&
        this.peakCandidateValue < normalizedValue
      ) {
        // Nuevo máximo para el pico candidato
        this.peakCandidateValue = normalizedValue;
      } else if (this.peakCandidateIndex === null) {
        // Nuevo candidato a pico
        this.peakCandidateIndex = this.signalBuffer.length - 1;
        this.peakCandidateValue = normalizedValue;
      }
    } else if (this.peakCandidateIndex !== null) {
      // Si ya pasamos el pico y la señal empieza a bajar significativamente
      if (normalizedValue < this.peakCandidateValue * 0.6) {
        isPeak = true;
        // Confianza proporcional a la amplitud normalizada
        confidence = Math.min(
          1,
          Math.max(this.MIN_CONFIDENCE, this.peakCandidateValue * 0.8)
        );
        // Reseteamos el candidato a pico
        this.peakCandidateIndex = null;
        this.peakCandidateValue = 0;
      }
    }

    return { isPeak, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Añade al buffer de confirmación - usamos el valor normalizado como un número
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 3) {
      this.peakConfirmationBuffer.shift();
    }

    // Necesitamos al menos confianza mínima
    if (confidence < this.MIN_CONFIDENCE && normalizedValue < this.SIGNAL_THRESHOLD) {
      return false;
    }

    // Si este pico es verdadero y tenemos suficiente información
    if (isPeak && this.peakConfirmationBuffer.length >= 3) {
      // Confirmamos solo si no hubo confirmación inmediatamente anterior
      // para evitar falsos positivos por ruido
      const previousConfirmedPeak = this.lastConfirmedPeak;
      
      // Verificamos que la forma de la señal sea consistente con un pico
      const len = this.peakConfirmationBuffer.length;
      const goingDown = this.peakConfirmationBuffer[len-1] < this.peakConfirmationBuffer[len-2];

      const confirmed = isPeak && !previousConfirmedPeak && goingDown;
      this.lastConfirmedPeak = confirmed;
      return confirmed;
    }

    this.lastConfirmedPeak = false;
    return false;
  }

  private updateBPM() {
    const bpm = this.calculateCurrentBPM();
    if (bpm > 0) {
      this.bpmHistory.push(bpm);
      if (this.bpmHistory.length > 5) {
        this.bpmHistory.shift();
      }
      this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + bpm * this.BPM_ALPHA;
    }
  }

  private getSmoothBPM(): number {
    // Si no hay historial, devuelve el BPM calculado directamente
    if (this.bpmHistory.length === 0) {
      return this.calculateCurrentBPM();
    }
    
    // Calcula el promedio ponderado dando más peso a los valores recientes
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.bpmHistory.length; i++) {
      const weight = Math.pow(1.5, i); // Peso exponencial
      weightedSum += this.bpmHistory[this.bpmHistory.length - 1 - i] * weight;
      weightSum += weight;
    }
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }
  
  /**
   * Añadir valor al buffer de mediana del BPM y mantener tamaño limitado
   */
  private addToBpmMedianBuffer(bpm: number): void {
    if (bpm < this.MIN_BPM || bpm > this.MAX_BPM) return; // Ignorar valores fuera de rango fisiológico
    
    this.bpmMedianBuffer.push(bpm);
    if (this.bpmMedianBuffer.length > this.MEDIAN_BPM_BUFFER_SIZE) {
      this.bpmMedianBuffer.shift();
    }
  }
  
  /**
   * Calcular la mediana del BPM para el resultado final
   */
  private calculateBpmMedian(): number {
    if (this.bpmMedianBuffer.length === 0) return 0;
    
    // Crear copia ordenada del buffer
    const sorted = [...this.bpmMedianBuffer].sort((a, b) => a - b);
    
    // Calcular mediana
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      return sorted[mid];
    }
  }

  private calculateCurrentBPM(): number {
    if (!this.previousPeakTime || !this.lastPeakTime) return 0;

    const rrInterval = this.lastPeakTime - this.previousPeakTime;
    if (rrInterval <= 0) return 0;

    const rawBpm = 60000 / rrInterval;

    // Filtrado por rango fisiológico
    if (rawBpm < this.MIN_BPM || rawBpm > this.MAX_BPM) {
      return 0;
    }

    return rawBpm;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length === 0) return 0;

    // Descartar valores extremos
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const withoutExtremes = sorted.slice(
      Math.floor(sorted.length * 0.1),
      Math.ceil(sorted.length * 0.9)
    );

    if (withoutExtremes.length === 0) return sorted[Math.floor(sorted.length / 2)];

    // Calcular promedio de valores no extremos
    const sum = withoutExtremes.reduce((a, b) => a + b, 0);
    return Math.round(sum / withoutExtremes.length);
  }

  public reset() {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.values = [];
    this.bpmHistory = [];
    this.bpmMedianBuffer = [];
    this.peakConfirmationBuffer = [];
    this.smoothedValue = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lastConfirmedPeak = false;
    this.startTime = Date.now();
    this.smoothBPM = 0;
    this.lowSignalCount = 0;
    console.log("HeartBeatProcessor: reset called");
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    // Calculate RR intervals from peak times
    const intervals: number[] = [];
    // Here we would calculate the actual intervals from peak history
    // For now, just provide the current RR interval if available
    if (this.previousPeakTime && this.lastPeakTime) {
      intervals.push(this.lastPeakTime - this.previousPeakTime);
    }
    
    return {
      intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
