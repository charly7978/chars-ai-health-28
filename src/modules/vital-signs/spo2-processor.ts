import { calculateAC, calculateDC, calculatePerfusionIndex } from './utils';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private readonly MEDIAN_BUFFER_SIZE = 5;
  private spo2Buffer: number[] = [];
  private medianBuffer: number[] = [];
  private readonly MIN_PERFUSION_INDEX = 0.4;
  private readonly MIN_AC_VALUE = 5.0;
  private readonly MIN_VALUES_LENGTH = 30;
  private readonly MIN_SIGNAL_INTENSITY = 50;

  public calculateSpO2(values: number[]): number {
    if (values.length < this.MIN_VALUES_LENGTH) {
      this.resetBuffers();
      return 0;
    }

    const dc = calculateDC(values);
    if (dc === 0 || dc < this.MIN_SIGNAL_INTENSITY) { 
      this.resetBuffers();
      return 0;
    }

    const ac = calculateAC(values);
    if (ac < this.MIN_AC_VALUE) {
      this.resetBuffers();
      return 0;
    }

    const stdDev = this.calculateStandardDeviation(values);
    const cv = stdDev / Math.abs(dc);
    
    if (stdDev < 3.0 || cv < 0.08) {
      this.resetBuffers();
      return 0;
    }

    const perfusionIndex = calculatePerfusionIndex(values);
    if (perfusionIndex < this.MIN_PERFUSION_INDEX) {
      this.resetBuffers();
      return 0;
    }
    
    if (!this.checkSignalStability(values)) {
      this.resetBuffers();
      return 0;
    }

    const R = ac / dc;
    const spO2 = Math.round(110 - (25 * R));
    const boundedSpO2 = Math.max(70, Math.min(100, spO2));

    if (boundedSpO2 >= 85 && boundedSpO2 <= 100) {
      this.addToMedianBuffer(boundedSpO2);
    }

    return this.getMedianValue();
  }

  private checkSignalStability(values: number[]): boolean {
    if (values.length < 20) return false;
    
    const derivatives = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    let zeroCrossings = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i-1] < 0 && derivatives[i] >= 0) || 
          (derivatives[i-1] >= 0 && derivatives[i] < 0)) {
        zeroCrossings++;
      }
    }
    
    if (zeroCrossings < 6 || zeroCrossings > 35) {
      return false;
    }
    
    return true;
  }

  private addToMedianBuffer(value: number): void {
    if (value > 0) {
      this.medianBuffer.push(value);
      if (this.medianBuffer.length > this.MEDIAN_BUFFER_SIZE) {
        this.medianBuffer.shift();
      }
    }
  }

  private getMedianValue(): number {
    if (this.medianBuffer.length === 0) {
      return 0;
    }
    
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  private resetBuffers(): void {
    this.spo2Buffer = [];
    this.medianBuffer = [];
  }

  public reset(): void {
    this.resetBuffers();
  }
}
