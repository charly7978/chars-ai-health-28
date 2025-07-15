import { CameraAnalysis } from '../lib/cameraAnalysis';

export class VitalSignsProcessor {
  constructor() {
    this.cameraAnalysis = new CameraAnalysis();
    this.isLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.rrIntervals = [];
    this.RR_WINDOW_SIZE = 100;
    this.RMSSD_THRESHOLD = 45;
    this.arrhythmiaDetected = false;
    this.lastPeakTime = null;
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.lastValue = 0;
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }

  detectArrhythmia() {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      console.log("VitalSignsProcessor: Insuficientes intervalos RR para RMSSD", {
        current: this.rrIntervals.length,
        needed: this.RR_WINDOW_SIZE
      });
      return;
    }

    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // Calcular RMSSD con corrección de ruido
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    const correctedRMSSD = this.applyRMSSDCorrection(rmssd);
    
    // Calcular métricas adicionales
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    // Calcular variabilidad de frecuencia cardíaca
    const sdnn = Math.sqrt(recentRR.reduce((sum, rr) => sum + Math.pow(rr - avgRR, 2), 0) / recentRR.length);
    const pnn50 = recentRR.filter((rr, i) => i > 0 && Math.abs(rr - recentRR[i-1]) > 50).length / (recentRR.length - 1);
    
    // Calcular entropía
    const shannonEntropy = this.calculateShannonEntropy(recentRR);
    const sampleEntropy = this.calculateSampleEntropy(recentRR);
    
    console.log("VitalSignsProcessor: Análisis completo de arritmia", {
      timestamp: new Date().toISOString(),
      rmssd,
      correctedRMSSD,
      sdnn,
      pnn50,
      shannonEntropy,
      sampleEntropy,
      avgRR,
      lastRR,
      prematureBeat
    });

    // Determinar estado de arritmia con múltiples métricas
    const newArrhythmiaState = (
      correctedRMSSD > this.RMSSD_THRESHOLD &&
      prematureBeat &&
      (sdnn > 100 || pnn50 > 0.1) &&
      (shannonEntropy > 1.8 || sampleEntropy > 1.4)
    );

    if (newArrhythmiaState !== this.arrhythmiaDetected) {
      this.arrhythmiaDetected = newArrhythmiaState;
      console.log("VitalSignsProcessor: Cambio en estado de arritmia", {
        previousState: !this.arrhythmiaDetected,
        newState: this.arrhythmiaDetected,
        metrics: {
          rmssd: correctedRMSSD,
          sdnn,
          pnn50,
          shannonEntropy,
          sampleEntropy
        }
      });
    }
  }

  applyRMSSDCorrection(rmssd) {
    // Corrección empírica basada en la variabilidad de la frecuencia cardíaca
    return rmssd * 1.05; // Factor de corrección
  }

  calculateShannonEntropy(data) {
    // Implementación de entropía de Shannon
    const probabilities = new Map();
    data.forEach(value => {
      probabilities.set(value, (probabilities.get(value) || 0) + 1);
    });
    
    const entropy = Array.from(probabilities.values())
      .map(count => count / data.length)
      .reduce((sum, p) => sum - p * Math.log2(p), 0);
    
    return entropy;
  }

  calculateSampleEntropy(data) {
    // Implementación de entropía de muestra
    const m = 2; // Dimensión
    const r = 0.2 * this.calculateSD(data); // Tolerancia
    const N = data.length;
    
    let B = 0;
    let A = 0;
    
    for (let i = 0; i < N - m; i++) {
      for (let j = i + 1; j < N - m; j++) {
        if (this.isMatch(data, i, j, m, r)) {
          B++;
          if (this.isMatch(data, i, j, m + 1, r)) {
            A++;
          }
        }
      }
    }
    
    return Math.log(B / A);
  }

  isMatch(data, i, j, m, r) {
    for (let k = 0; k < m; k++) {
      if (Math.abs(data[i + k] - data[j + k]) > r) {
        return false;
      }
    }
    return true;
  }

  calculateSD(data) {
    // Cálculo de desviación estándar
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }

  processFrame(frame) {
    // Procesar el frame con el análisis de cámara
    this.cameraAnalysis.processFrame(frame);

    // Calcular métricas
    const spo2 = this.cameraAnalysis.calculateSpO2();
    const heartRate = this.cameraAnalysis.calculateHeartRate();
    const arrhythmiaDetected = this.cameraAnalysis.detectArrhythmias();

    // Determinar estado de arritmia
    let arrhythmiaStatus = "--";
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.measurementStartTime;

    if (timeSinceStart > 3000) { // 3 segundos de aprendizaje inicial
      this.isLearningPhase = false;
      arrhythmiaStatus = arrhythmiaDetected ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
    }

    return {
      spo2,
      heartRate,
      arrhythmiaStatus
    };
  }

  processHeartBeat() {
    const currentTime = Date.now();
    
    if (this.lastPeakTime === null) {
      this.lastPeakTime = currentTime;
      return;
    }

    const rrInterval = currentTime - this.lastPeakTime;
    this.rrIntervals.push(rrInterval);
    
    console.log("VitalSignsProcessor: Nuevo latido", {
      timestamp: currentTime,
      rrInterval,
      totalIntervals: this.rrIntervals.length
    });

    if (this.rrIntervals.length > 20) {
      this.rrIntervals.shift();
    }

    if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
      this.detectArrhythmia();
    }

    this.lastPeakTime = currentTime;
  }

  BP_BUFFER_SIZE = 10;
  BP_ALPHA = 0.7;

  calculateBloodPressure(values) {
    if (values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = this.localFindPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 120, diastolic: 80 };
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    const pttValues = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);

    const normalizedPTT = Math.max(300, Math.min(1200, weightedPTT));
    const amplitude = this.calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));

    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);

    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }

    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }

    finalSystolic = finalSystolic / weightSum;
    finalDiastolic = finalDiastolic / weightSum;

    console.log("VitalSignsProcessor: Cálculo de presión arterial", {
      instant: {
        systolic: Math.round(instantSystolic),
        diastolic: Math.round(instantDiastolic)
      },
      buffered: {
        systolic: Math.round(finalSystolic),
        diastolic: Math.round(finalDiastolic)
      },
      bufferSize: this.systolicBuffer.length,
      ptt: normalizedPTT,
      amplitude: normalizedAmplitude
    });

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }

  localFindPeaksAndValleys(values) {
    const peakIndices = [];
    const valleyIndices = [];

    for (let i = 2; i < values.length - 2; i++) {
      const v = values[i];
      if (
        v > values[i - 1] &&
        v > values[i - 2] &&
        v > values[i + 1] &&
        v > values[i + 2]
      ) {
        peakIndices.push(i);
      }
      if (
        v < values[i - 1] &&
        v < values[i - 2] &&
        v < values[i + 1] &&
        v < values[i + 2]
      ) {
        valleyIndices.push(i);
      }
    }
    return { peakIndices, valleyIndices };
  }

  calculateAmplitude(values, peaks, valleys) {
    if (peaks.length === 0 || valleys.length === 0) return 0;

    const amps = [];
    const len = Math.min(peaks.length, valleys.length);
    for (let i = 0; i < len; i++) {
      const amp = values[peaks[i]] - values[valleys[i]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
    if (amps.length === 0) return 0;

    const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
    return mean;
  }

  detectPeak(value) {
    const currentTime = Date.now();
    if (this.lastPeakTime === null) {
      if (value > this.PEAK_THRESHOLD) {
        this.lastPeakTime = currentTime;
        return true;
      }
      return false;
    }

    const timeSinceLastPeak = currentTime - this.lastPeakTime;
    if (value > this.PEAK_THRESHOLD && timeSinceLastPeak > 500) {
      this.lastPeakTime = currentTime;
      return true;
    }
    return false;
  }

  calculateStandardDeviation(values) {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSqDiff);
  }

  calculateAC(values) {
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }

  calculateDC(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  applySMAFilter(value) {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }

  reset() {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.isLearningPhase = true;
    this.arrhythmiaDetected = false;
    this.measurementStartTime = Date.now();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    console.log("VitalSignsProcessor: Reset completo");
  }
} 