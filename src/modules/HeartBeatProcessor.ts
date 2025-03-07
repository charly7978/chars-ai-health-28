export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 220; // Aumentado para permitir más rango
  private readonly SIGNAL_THRESHOLD = 0.20; // Reducido aún más para mayor sensibilidad
  private readonly MIN_CONFIDENCE = 0.30; // Reducido aún más para capturar más picos
  private readonly DERIVATIVE_THRESHOLD = -0.01; // Menos restrictivo para detectar más cambios
  private readonly MIN_PEAK_TIME_MS = 250; // Reducido para permitir frecuencias más altas
  private readonly WARMUP_TIME_MS = 1500; // Reducido para comenzar antes

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 3; 
  private readonly MOVING_AVERAGE_WINDOW = 3; 
  private readonly EMA_ALPHA = 0.5; // Aumentado para seguir más rápido los cambios
  private readonly BASELINE_FACTOR = 0.95; // Ajustado para un seguimiento más rápido
  private readonly MEDIAN_BPM_BUFFER_SIZE = 5; // Reducido para responder más rápido a cambios

  // Parámetros de beep
  private readonly BEEP_PRIMARY_FREQUENCY = 880; 
  private readonly BEEP_SECONDARY_FREQUENCY = 440; 
  private readonly BEEP_DURATION = 80; 
  private readonly BEEP_VOLUME = 0.9; 
  private readonly MIN_BEEP_INTERVAL_MS = 250; // Reducido para permitir beeps más frecuentes

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.015; // Reducido para mayor sensibilidad
  private readonly LOW_SIGNAL_FRAMES = 20; // Aumentado para mayor estabilidad
  private lowSignalCount = 0;

  // Factores de corrección para el BPM
  private readonly BPM_ADJUSTMENT_FACTOR = 1.08; // Factor para compensar subestimaciones
  private readonly MIN_ACCEPTABLE_BPM = 55; // BPM mínimo considerado normal en reposo

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
  private readonly BPM_ALPHA = 0.35; // Aumentado para responder más rápido a cambios
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private audioInitialized: boolean = false; // Para controlar si el audio está inicializado
  private beepSoundEnabled: boolean = true; // Control para activar/desactivar sonido
  private debugEnabled: boolean = true; // Para mostrar mensajes de depuración

  // Parámetros de arritmia
  private readonly RR_HISTORY_SIZE = 8; // Tamaño del historial de intervalos RR
  private readonly PREMATURE_BEAT_THRESHOLD = 0.85; // % del intervalo RR promedio para considerar prematuro
  private readonly LATE_BEAT_THRESHOLD = 1.15; // % del intervalo RR promedio para considerar tardío
  private readonly MORPHOLOGY_DIFFERENCE_THRESHOLD = 0.3; // Diferencia en morfología para considerar anormal
  private readonly MIN_RR_HISTORY = 3; // Mínimo de intervalos RR para comenzar detección
  private readonly ARRHYTHMIA_CONFIDENCE_THRESHOLD = 0.75; // Confianza mínima para marcar arritmia

  // Variables para arritmias
  private rrIntervalHistory: number[] = [];
  private beatMorphologyHistory: number[][] = [];
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTime: number = 0;
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 500; // Tiempo mínimo entre arritmias
  private currentBeatMorphology: number[] = [];
  private isCurrentBeatArrhythmic: boolean = false;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      // Intentamos crear un AudioContext nuevo solo si no existe
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Aseguramos que el contexto esté en estado 'running'
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Hacemos un beep muy silencioso para asegurarnos que todo funciona
      await this.playBeep(0.01);
      this.audioInitialized = true;
      console.log("HeartBeatProcessor: Audio Context Initialized successfully");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
      // Si falla, intentaremos inicializarlo en la próxima detección de pico
      this.audioInitialized = false;
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    // Si el sonido está desactivado, no hacemos nada
    if (!this.beepSoundEnabled) return;
    
    // Inicializar audio si no se ha hecho
    if (!this.audioContext || this.audioContext.state === 'suspended') {
      await this.initAudio();
    }
    
    // Verificar si estamos en periodo de warmup o si el beep anterior fue muy reciente
    const now = Date.now();
    if (this.isInWarmup() || now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return;
    }

    try {
      if (!this.audioContext) {
        console.error("HeartBeatProcessor: Cannot play beep - AudioContext not available");
        return;
      }
      
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
      if (this.debugEnabled) {
        console.log("HeartBeatProcessor: Beep played successfully");
      }
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
      // Intentar reinicializar el audio para la próxima vez
      this.audioInitialized = false;
    }
  }

  /**
   * Activa o desactiva el sonido del beep
   */
  public toggleBeepSound(enabled: boolean) {
    this.beepSoundEnabled = enabled;
    console.log(`HeartBeatProcessor: Beep sound ${enabled ? 'enabled' : 'disabled'}`);
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
    isArrhythmia: boolean;
  } {
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    // Actualizar morfología del latido actual
    this.updateBeatMorphology(smoothed);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 8) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: this.arrhythmiaCount,
        isArrhythmia: false
      };
    }

    this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
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

    let isArrhythmia = false;

    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        // Actualizar intervalos RR y detectar arritmias
        if (this.lastPeakTime) {
          const rrInterval = now - this.lastPeakTime;
          this.updateRRIntervals(rrInterval);
          isArrhythmia = this.detectArrhythmia(rrInterval, confidence);
          
          if (isArrhythmia) {
            // Incrementar contador solo si ha pasado suficiente tiempo desde la última arritmia
            if (now - this.lastArrhythmiaTime >= this.MIN_ARRHYTHMIA_INTERVAL_MS) {
              this.arrhythmiaCount++;
              this.lastArrhythmiaTime = now;
              if (this.debugEnabled) {
                console.log(`HeartBeatProcessor: Arrhythmia detected! Count: ${this.arrhythmiaCount}`);
              }
            }
          }
        }

        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        if (!this.isInWarmup()) {
          this.playBeep(0.7);
        }
        
        this.updateBPM();
        
        // Guardar morfología del latido si es confirmado
        if (this.currentBeatMorphology.length > 0) {
          this.beatMorphologyHistory.push([...this.currentBeatMorphology]);
          if (this.beatMorphologyHistory.length > this.RR_HISTORY_SIZE) {
            this.beatMorphologyHistory.shift();
          }
          this.currentBeatMorphology = [];
        }
      }
    }

    let currentBPM = this.getSmoothBPM();
    
    if (currentBPM > 0) {
      currentBPM = currentBPM * this.BPM_ADJUSTMENT_FACTOR;
      
      if (currentBPM < this.MIN_ACCEPTABLE_BPM && currentBPM > this.MIN_BPM) {
        const adjustment = (this.MIN_ACCEPTABLE_BPM - currentBPM) * 0.5;
        currentBPM += adjustment;
      }
    }
    
    if (currentBPM > 0) {
      this.addToBpmMedianBuffer(Math.round(currentBPM));
    }
    
    const medianBPM = this.calculateBpmMedian();
    
    if (medianBPM > 0 && this.debugEnabled) {
      console.log(`HeartBeatProcessor: BPM=${medianBPM}, rawBPM=${currentBPM.toFixed(1)}, isPeak=${isConfirmedPeak}, confidence=${confidence.toFixed(2)}, normVal=${normalizedValue.toFixed(2)}, isArrhythmia=${isArrhythmia}`);
    }

    return {
      bpm: medianBPM,
      confidence,
      isPeak: isConfirmedPeak,
      filteredValue: smoothed,
      arrhythmiaCount: this.arrhythmiaCount,
      isArrhythmia
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
    // Implementación más sensible del detector de picos
    let isPeak = false;
    let confidence = 0;

    // Verificamos que la señal esté por encima del umbral
    if (normalizedValue > this.SIGNAL_THRESHOLD) {
      // Si la derivada es negativa, estamos en una posible caída después del pico
      if (derivative < this.DERIVATIVE_THRESHOLD) {
        // Si ya tenemos un candidato a pico, actualizamos si este es mejor
        if (this.peakCandidateIndex !== null && 
            this.peakCandidateValue < normalizedValue) {
          this.peakCandidateValue = normalizedValue;
        } 
        // Si no tenemos candidato, este es un nuevo candidato
        else if (this.peakCandidateIndex === null) {
          this.peakCandidateIndex = this.signalBuffer.length - 1;
          this.peakCandidateValue = normalizedValue;
        }
      }
    } 
    // Si ya tenemos un candidato y la señal ha bajado, confirmamos el pico
    else if (this.peakCandidateIndex !== null && 
             normalizedValue < this.peakCandidateValue * 0.65) { // Umbral de confirmación reducido
      isPeak = true;
      // Confianza proporcional a la amplitud del pico
      confidence = Math.min(1, 
                           Math.max(this.MIN_CONFIDENCE, 
                                    this.peakCandidateValue / (this.SIGNAL_THRESHOLD * 1.8)));
      
      // Reseteamos para el próximo pico
      this.peakCandidateIndex = null;
      this.peakCandidateValue = 0;
    }

    return { isPeak, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Si no es un pico o la confianza es muy baja, rechazamos
    if (!isPeak || confidence < this.MIN_CONFIDENCE) {
      return false;
    }
    
    // Necesitamos evitar detectar el mismo pico múltiples veces
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;
    
    // Si ha pasado muy poco tiempo desde el último pico, lo rechazamos
    // Reducimos este tiempo para permitir más detecciones
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS * 0.7) {
      return false;
    }

    // Si ya confirmamos un pico recientemente, evitamos un falso positivo
    if (this.lastConfirmedPeak) {
      // Calculamos el tiempo esperado basado en el BPM actual o un valor por defecto
      const expectedNextPeakTime = this.lastPeakTime ? 
        (60000 / (this.getSmoothBPM() || 90)) : this.MIN_PEAK_TIME_MS;
      
      // Rechazamos si es muy pronto para otro pico (dejamos más margen)
      if (timeSinceLastPeak < expectedNextPeakTime * 0.35) {
        return false;
      }
    }
    
    // El pico es válido, lo confirmamos
    this.lastConfirmedPeak = true;
    
    // Después de un tiempo volvemos a permitir nuevos picos
    setTimeout(() => {
      this.lastConfirmedPeak = false;
    }, this.MIN_PEAK_TIME_MS * 0.6); // Reducido para permitir más detecciones

    return true;
  }

  private updateBPM() {
    const bpm = this.calculateCurrentBPM();
    if (bpm > 0) {
      this.bpmHistory.push(bpm);
      if (this.bpmHistory.length > 5) {
        this.bpmHistory.shift();
      }
      
      // Actualizar BPM con media ponderada
      if (this.smoothBPM === 0) {
        this.smoothBPM = bpm; // Inicialización
      } else {
        this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + bpm * this.BPM_ALPHA;
      }
    }
  }

  private getSmoothBPM(): number {
    // Si no hay historial, devuelve el BPM calculado directamente
    if (this.bpmHistory.length === 0) {
      return this.calculateCurrentBPM();
    }
    
    return this.smoothBPM > 0 ? this.smoothBPM : 0;
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
    
    // Si tenemos pocos valores, usamos el máximo en lugar de la mediana
    // para evitar subestimar el BPM durante la fase inicial
    if (this.bpmMedianBuffer.length <= 2) {
      return Math.max(...this.bpmMedianBuffer);
    }
    
    // Crear copia ordenada del buffer
    const sorted = [...this.bpmMedianBuffer].sort((a, b) => a - b);
    
    // Usar un valor ligeramente más alto que la mediana estricta
    // para compensar posibles subestimaciones
    const mid = Math.floor(sorted.length / 2);
    const upperMid = Math.ceil(sorted.length * 0.6); // Ligeramente por encima de la mediana
    
    if (sorted.length % 2 === 0) {
      // Promedio ponderado dando más peso al valor más alto
      return Math.round((sorted[mid - 1] * 0.4 + sorted[mid] * 0.6));
    } else {
      // Usar un valor ligeramente superior a la mediana
      return Math.round(sorted[mid] * 0.4 + sorted[upperMid] * 0.6);
    }
  }

  private calculateCurrentBPM(): number {
    if (!this.previousPeakTime || !this.lastPeakTime) return 0;

    const rrInterval = this.lastPeakTime - this.previousPeakTime;
    if (rrInterval <= 0) return 0;

    // Calcular BPM a partir del intervalo RR
    const rawBpm = 60000 / rrInterval;

    // Filtrado por rango fisiológico ampliado
    if (rawBpm < this.MIN_BPM || rawBpm > this.MAX_BPM) {
      return 0;
    }

    return rawBpm;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length === 0) return 0;

    // Dar más peso a los valores más altos para evitar subestimaciones
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    // Usar el 60% superior de los valores
    const highValues = sorted.slice(Math.floor(sorted.length * 0.4));
    
    if (highValues.length === 0) return sorted[Math.floor(sorted.length / 2)];

    // Calcular promedio de los valores más altos
    const sum = highValues.reduce((a, b) => a + b, 0);
    return Math.round(sum / highValues.length);
  }

  /**
   * Activa o desactiva los mensajes de depuración
   */
  public toggleDebug(enabled: boolean) {
    this.debugEnabled = enabled;
    console.log(`HeartBeatProcessor: Debug ${enabled ? 'enabled' : 'disabled'}`);
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
    this.rrIntervalHistory = [];
    this.beatMorphologyHistory = [];
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
    this.currentBeatMorphology = [];
    this.isCurrentBeatArrhythmic = false;
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

  private updateBeatMorphology(value: number): void {
    // Mantener un buffer de la forma de onda del latido actual
    this.currentBeatMorphology.push(value);
    if (this.currentBeatMorphology.length > this.WINDOW_SIZE / 2) {
      this.currentBeatMorphology.shift();
    }
  }

  private updateRRIntervals(interval: number): void {
    this.rrIntervalHistory.push(interval);
    if (this.rrIntervalHistory.length > this.RR_HISTORY_SIZE) {
      this.rrIntervalHistory.shift();
    }
  }

  private detectArrhythmia(currentRRInterval: number, confidence: number): boolean {
    // Si no tenemos suficiente historial o la confianza es baja, no detectamos arritmia
    if (this.rrIntervalHistory.length < this.MIN_RR_HISTORY || 
        confidence < this.ARRHYTHMIA_CONFIDENCE_THRESHOLD) {
      return false;
    }

    // Calcular el promedio de los intervalos RR previos
    const previousIntervals = this.rrIntervalHistory.slice(0, -1);
    const avgRR = previousIntervals.reduce((a, b) => a + b, 0) / previousIntervals.length;

    // Detectar latidos prematuros o tardíos
    const isPrematurely = currentRRInterval < avgRR * this.PREMATURE_BEAT_THRESHOLD;
    const isLate = currentRRInterval > avgRR * this.LATE_BEAT_THRESHOLD;

    // Analizar morfología si hay suficiente historial
    let morphologyDifferent = false;
    if (this.beatMorphologyHistory.length > 0 && this.currentBeatMorphology.length > 0) {
      const avgMorphology = this.calculateAverageMorphology();
      const currentDifference = this.calculateMorphologyDifference(
        this.currentBeatMorphology,
        avgMorphology
      );
      morphologyDifferent = currentDifference > this.MORPHOLOGY_DIFFERENCE_THRESHOLD;
    }

    // Considerar arritmia si el intervalo es anormal o la morfología es diferente
    return (isPrematurely || isLate || morphologyDifferent);
  }

  private calculateAverageMorphology(): number[] {
    const length = Math.min(...this.beatMorphologyHistory.map(beat => beat.length));
    const avgMorphology = new Array(length).fill(0);

    for (let i = 0; i < length; i++) {
      let sum = 0;
      let count = 0;
      for (const beat of this.beatMorphologyHistory) {
        if (i < beat.length) {
          sum += beat[i];
          count++;
        }
      }
      avgMorphology[i] = sum / count;
    }

    return avgMorphology;
  }

  private calculateMorphologyDifference(beat1: number[], beat2: number[]): number {
    const length = Math.min(beat1.length, beat2.length);
    let sumSquaredDiff = 0;
    let maxVal1 = Math.max(...beat1);
    let maxVal2 = Math.max(...beat2);
    
    // Normalizar para comparar formas independientemente de la amplitud
    const normFactor = maxVal2 / maxVal1;
    
    for (let i = 0; i < length; i++) {
      const diff = (beat1[i] * normFactor) - beat2[i];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / length);
  }
}
