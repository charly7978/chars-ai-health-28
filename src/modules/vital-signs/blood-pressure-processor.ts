import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private systolicReference: number = 120;
  private diastolicReference: number = 80;
  private calibrationInProgress: boolean = false;
  private calibrationSamples: number[] = [];
  private readonly MIN_CALIBRATION_SAMPLES = 50;

  /**
   * Calculates blood pressure using PPG signal features
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    // Si estamos calibrando, recolectar muestras
    if (this.calibrationInProgress) {
      this.calibrationSamples.push(...values);
      
      if (this.calibrationSamples.length >= this.MIN_CALIBRATION_SAMPLES) {
        this.completeCalibration();
      }
      
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 0, diastolic: 0 };
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    // Calculate real PTT values with improved accuracy
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      if (dt > 200 && dt < 1500) { // Physiologically valid range
        pttValues.push(dt);
      }
    }
    
    // Enhanced weighted PTT calculation
    let pttWeightSum = 0;
    let pttWeightedSum = 0;
    
    pttValues.forEach((val, idx) => {
      const weight = Math.pow((idx + 1) / pttValues.length, 1.5); // Exponential weighting
      pttWeightedSum += val * weight;
      pttWeightSum += weight;
    });

    const calculatedPTT = pttWeightSum > 0 ? pttWeightedSum / pttWeightSum : 600;
    const normalizedPTT = Math.max(300, Math.min(1200, calculatedPTT));
    
    // Enhanced amplitude calculation from signal
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5.5));

    // Calculate pressure using improved physiological model
    const pttFactor = (600 - normalizedPTT) * 0.085;
    const ampFactor = normalizedAmplitude * 0.32;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.55) + (ampFactor * 0.22);

    // Enhanced physiological range enforcement
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    // Maintain realistic pressure differential with improved bounds
    const differential = instantSystolic - instantDiastolic;
    if (differential < 25) {
      instantDiastolic = instantSystolic - 25;
    } else if (differential > 75) {
      instantDiastolic = instantSystolic - 75;
    }

    // Update pressure buffers with new values
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Calculate final smoothed values with enhanced exponential moving average
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let smoothingWeightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      smoothingWeightSum += weight;
    }

    finalSystolic = smoothingWeightSum > 0 ? finalSystolic / smoothingWeightSum : instantSystolic;
    finalDiastolic = smoothingWeightSum > 0 ? finalDiastolic / smoothingWeightSum : instantDiastolic;

    // Calcular presión usando valores de referencia calibrados
    const ac = Math.max(...values) - Math.min(...values);
    const dc = values.reduce((a, b) => a + b, 0) / values.length;
    const ratio = ac / dc;

    // Aplicar factores de calibración
    const systolic = this.systolicReference * (1 + (ratio - 1) * 0.15);
    const diastolic = this.diastolicReference * (1 + (ratio - 1) * 0.1);

    return {
      systolic: Math.round(Math.max(70, Math.min(200, systolic))),
      diastolic: Math.round(Math.max(40, Math.min(130, diastolic)))
    };
  }

  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.calibrationInProgress = false;
    this.calibrationSamples = [];
  }

  public setCalibrationValues(systolic: number, diastolic: number): void {
    this.systolicReference = systolic;
    this.diastolicReference = diastolic;
  }

  public startCalibration(): void {
    this.calibrationInProgress = true;
    this.calibrationSamples = [];
  }

  public isCalibrating(): boolean {
    return this.calibrationInProgress;
  }

  private completeCalibration(): void {
    if (!this.calibrationInProgress || this.calibrationSamples.length < this.MIN_CALIBRATION_SAMPLES) {
      return;
    }

    // Analizar muestras de calibración para ajustar referencias
    const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
    const medianValue = sortedSamples[Math.floor(sortedSamples.length / 2)];
    
    // Ajustar referencias basadas en la mediana de las muestras
    const adjustmentFactor = medianValue / this.systolicReference;
    this.systolicReference = Math.round(this.systolicReference * adjustmentFactor);
    this.diastolicReference = Math.round(this.diastolicReference * adjustmentFactor);

    this.calibrationInProgress = false;
    this.calibrationSamples = [];
  }
}
