import { CameraAnalysis } from '../lib/cameraAnalysis';

export class VitalSignsProcessor {
  private cameraAnalysis: CameraAnalysis;
  private isLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private rrIntervals: number[] = [];
  private RR_WINDOW_SIZE: number = 100;
  private RMSSD_THRESHOLD: number = 45;
  private arrhythmiaDetected: boolean = false;
  private lastPeakTime: number | null = null;
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private spo2Buffer: number[] = [];
  private lastValue: number = 0;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];

  constructor() {
    this.cameraAnalysis = new CameraAnalysis();
  }

  private detectArrhythmia() {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      console.log("VitalSignsProcessor: Insuficientes intervalos RR para RMSSD", {
        current: this.rrIntervals.length,
        needed: this.RR_WINDOW_SIZE
      });
      return;
    }

    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    console.log("VitalSignsProcessor: Análisis RMSSD", {
      timestamp: new Date().toISOString(),
      rmssd,
      threshold: this.RMSSD_THRESHOLD,
      recentRR,
      avgRR,
      lastRR,
      prematureBeat
    });

    const newArrhythmiaState = rmssd > this.RMSSD_THRESHOLD && prematureBeat;

    if (newArrhythmiaState !== this.arrhythmiaDetected) {
      this.arrhythmiaDetected = newArrhythmiaState;
      console.log("VitalSignsProcessor: Cambio en estado de arritmia", {
        previousState: !this.arrhythmiaDetected,
        newState: this.arrhythmiaDetected,
        cause: {
          rmssdExceeded: rmssd > this.RMSSD_THRESHOLD,
          prematureBeat,
          rmssdValue: rmssd
        }
      });
    }
  }

  public async processFrame(frame: ImageBitmap): Promise<{
    spo2: number;
    heartRate: number;
    arrhythmiaStatus: string;
  }> {
    // Procesar el frame con el análisis de cámara
    this.cameraAnalysis.processFrame(frame);

    // Calcular métricas
    const spo2 = await this.cameraAnalysis.calculateSpO2();
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

  private processHeartBeat() {
    const currentTime = Date.now();
    
    if (this.lastPeakTime === null) {
      this.lastPeakTime = currentTime;
      return;
    }

    const rrInterval = currentTime - this.lastPeakTime;
    this.rrIntervals.push(rrInterval);
    this.lastPeakTime = currentTime;

    // Mantener solo los últimos RR_WINDOW_SIZE intervalos
    if (this.rrIntervals.length > this.RR_WINDOW_SIZE) {
      this.rrIntervals.shift();
    }

    if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
      this.detectArrhythmia();
    }
  }

  private calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    const maxIndex = values.indexOf(Math.max(...values));
    const minIndex = values.indexOf(Math.min(...values));
    
    const systolic = values[maxIndex];
    const diastolic = values[minIndex];
    
    return {
      systolic,
      diastolic
    };
  }

  private calculateAC(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateDC(values);
    return Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length);
  }

  private calculateDC(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  public reset(): void {
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
