import { calculateAC, calculateDC } from './utils';

export class SpO2Processor {
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];
  private calibrationInProgress: boolean = false;
  private calibrationSamples: number[] = [];
  private readonly MIN_CALIBRATION_SAMPLES = 50;
  private calibrationFactor: number = 1.02;

  public startCalibration(): void {
    this.calibrationInProgress = true;
    this.calibrationSamples = [];
  }

  public isCalibrating(): boolean {
    return this.calibrationInProgress;
  }

  /**
   * Calculates the oxygen saturation (SpO2) from PPG values
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      return 0;
    }

    // Si estamos calibrando, recolectar muestras
    if (this.calibrationInProgress) {
      this.calibrationSamples.push(...values);
      
      if (this.calibrationSamples.length >= this.MIN_CALIBRATION_SAMPLES) {
        this.completeCalibration();
      }
      
      return 0;
    }

    const dc = this.calculateDC(values);
    if (dc === 0) return 0;

    const ac = this.calculateAC(values);
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      return 0;
    }

    const R = (ac / dc) / this.calibrationFactor;
    let spO2 = Math.round(98 - (15 * R));
    
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, Math.max(70, spO2));

    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
    }

    return spO2;
  }

  private completeCalibration(): void {
    if (!this.calibrationInProgress || this.calibrationSamples.length < this.MIN_CALIBRATION_SAMPLES) {
      return;
    }

    // Analizar muestras de calibración para ajustar el factor
    const acValues = [];
    const dcValues = [];
    
    for (let i = 0; i < this.calibrationSamples.length - 30; i += 30) {
      const segment = this.calibrationSamples.slice(i, i + 30);
      acValues.push(this.calculateAC(segment));
      dcValues.push(this.calculateDC(segment));
    }

    // Calcular ratio promedio durante calibración
    const avgRatio = acValues.reduce((sum, ac, i) => sum + (ac / dcValues[i]), 0) / acValues.length;
    
    // Ajustar factor de calibración basado en ratio promedio
    this.calibrationFactor = avgRatio * 1.02; // Factor base multiplicado por ratio promedio

    this.calibrationInProgress = false;
    this.calibrationSamples = [];
  }

  private calculateAC(values: number[]): number {
    return Math.max(...values) - Math.min(...values);
  }

  private calculateDC(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.calibrationInProgress = false;
    this.calibrationSamples = [];
    this.calibrationFactor = 1.02;
  }
}
