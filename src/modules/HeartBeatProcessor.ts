
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

  // Parámetros de beep y vibración
  private readonly BEEP_DURATION = 450; // Mayor duración para un sonido más completo y realista
  private readonly BEEP_VOLUME = 0.85; // Volumen ajustado
  private readonly MIN_BEEP_INTERVAL_MS = 300;
  private readonly VIBRATION_PATTERN = [60, 40, 100]; // Patrón más natural

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
  private heartSoundBuffer: AudioBuffer | null = null;
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

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      
      if (this.audioContext) {
        // Crear un buffer para un sonido de latido cardíaco realista
        const sampleRate = this.audioContext.sampleRate;
        const bufferSize = Math.floor(sampleRate * 0.8); // 800ms para el sonido completo
        this.heartSoundBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
        
        const channelData = this.heartSoundBuffer.getChannelData(0);
        
        // Diseñar un latido cardíaco realista con sonidos Lub-Dub
        this.createRealisticHeartbeat(channelData, sampleRate);
      }
      
      // Reproducir un sonido de prueba muy bajo volumen solo para desbloquear el audio
      await this.playTestSound(0.005);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private createRealisticHeartbeat(channelData: Float32Array, sampleRate: number) {
    // Sonido Lub (primer tono)
    const lubDuration = Math.floor(sampleRate * 0.15); // 150ms
    const lubStart = 0;
    
    // Sonido Dub (segundo tono)
    const dubDuration = Math.floor(sampleRate * 0.25); // 250ms
    const dubStart = Math.floor(sampleRate * 0.22); // Comienza después de una pequeña pausa
    
    // Crear envolvente para ambos sonidos
    const envLub = this.createEnvelope(lubDuration, 0.02, 0.2, 0.6, 0.2);
    const envDub = this.createEnvelope(dubDuration, 0.03, 0.15, 0.65, 0.17);
    
    // Frecuencias principales para cada componente (muy bajas para un sonido profundo)
    const lubFreq1 = 25; // Frecuencia muy baja para el primer tono
    const lubFreq2 = 15; // Armónico secundario
    const dubFreq1 = 20; // Frecuencia para el segundo tono
    const dubFreq2 = 12; // Armónico secundario más bajo
    
    // Amplitudes y balances para crear un sonido rico pero no agudo
    const lubAmp1 = 0.9;
    const lubAmp2 = 0.5;
    const dubAmp1 = 0.75;
    const dubAmp2 = 0.45;
    
    // Aplicar ruido suave para la textura
    const noiseFactor = 0.08;
    
    // Generar el primer sonido "Lub"
    for (let i = 0; i < lubDuration; i++) {
      const t = i / sampleRate;
      const env = envLub[i];
      
      // Usar formas de onda sinusoidales suaves para evitar clics
      const signal1 = lubAmp1 * Math.sin(2 * Math.PI * lubFreq1 * t);
      const signal2 = lubAmp2 * Math.sin(2 * Math.PI * lubFreq2 * t);
      
      // Añadir ruido suave para textura
      const noise = (Math.random() * 2 - 1) * noiseFactor;
      
      // Combinar señales con la envolvente
      channelData[lubStart + i] = (signal1 + signal2 + noise) * env;
    }
    
    // Generar el segundo sonido "Dub"
    for (let i = 0; i < dubDuration; i++) {
      const t = i / sampleRate;
      const env = envDub[i];
      
      // Usar frecuencias más bajas para el segundo tono
      const signal1 = dubAmp1 * Math.sin(2 * Math.PI * dubFreq1 * t);
      const signal2 = dubAmp2 * Math.sin(2 * Math.PI * dubFreq2 * t);
      
      // Añadir ruido suave para textura
      const noise = (Math.random() * 2 - 1) * noiseFactor * 0.8;
      
      // Combinar señales con la envolvente
      if (dubStart + i < channelData.length) {
        channelData[dubStart + i] = (signal1 + signal2 + noise) * env;
      }
    }
    
    // Aplicar un filtro de suavizado para eliminar cualquier posible clic
    this.smoothBuffer(channelData, 32);
  }

  // Crear una envolvente ADSR (Attack, Decay, Sustain, Release) para sonido suave
  private createEnvelope(size: number, attackRatio: number, decayRatio: number, sustainLevel: number, releaseRatio: number): Float32Array {
    const env = new Float32Array(size);
    
    const attackSamples = Math.floor(size * attackRatio);
    const decaySamples = Math.floor(size * decayRatio);
    const releaseSamples = Math.floor(size * releaseRatio);
    const sustainSamples = size - attackSamples - decaySamples - releaseSamples;
    
    // Fase de ataque (inicio suave)
    for (let i = 0; i < attackSamples; i++) {
      env[i] = i / attackSamples;
    }
    
    // Fase de decay (caída suave hasta el nivel de sustain)
    for (let i = 0; i < decaySamples; i++) {
      env[attackSamples + i] = 1.0 - (1.0 - sustainLevel) * (i / decaySamples);
    }
    
    // Fase de sustain (mantener)
    for (let i = 0; i < sustainSamples; i++) {
      env[attackSamples + decaySamples + i] = sustainLevel;
    }
    
    // Fase de release (final suave)
    for (let i = 0; i < releaseSamples; i++) {
      env[attackSamples + decaySamples + sustainSamples + i] = sustainLevel * (1 - i / releaseSamples);
    }
    
    return env;
  }
  
  // Suavizar el buffer para eliminar clics
  private smoothBuffer(buffer: Float32Array, windowSize: number) {
    const tempBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize/2); j < Math.min(buffer.length, i + windowSize/2); j++) {
        sum += buffer[j];
        count++;
      }
      
      tempBuffer[i] = sum / count;
    }
    
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = tempBuffer[i];
    }
  }

  private async playTestSound(volume: number = 0.005) {
    if (!this.audioContext) return;
    
    try {
      // Usar un tono muy bajo y muy bajo volumen solo para activar el AudioContext
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      oscillator.frequency.setValueAtTime(5, this.audioContext.currentTime); // Frecuencia extremadamente baja
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing test sound", error);
    }
  }

  private async playHeartSound(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      // Vibrar el dispositivo con un patrón similar a un latido cardíaco
      if (navigator.vibrate) {
        navigator.vibrate(this.VIBRATION_PATTERN);
      }

      // Reproducir el sonido de latido cardíaco
      if (this.audioContext && this.heartSoundBuffer) {
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = this.heartSoundBuffer;
        gainNode.gain.value = volume;
        
        // Aplicar un ligero filtro pasabajos para asegurar que no haya altas frecuencias
        const filter = this.audioContext.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 120; // Filtrar frecuencias por encima de 120Hz
        
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start();
      }

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
        this.playHeartSound(0.8); // Aumentado el volumen y cambiado a sonido cardíaco
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
