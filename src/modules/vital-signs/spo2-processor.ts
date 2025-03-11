
import { calculateAC, calculateDC, calculatePerfusionIndex } from './utils';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private readonly MEDIAN_BUFFER_SIZE = 5;
  private spo2Buffer: number[] = [];
  private medianBuffer: number[] = [];
  private readonly MIN_PERFUSION_INDEX = 0.2; // Reduced from 0.4
  private readonly MIN_AC_VALUE = 3.0; // Reduced from 5.0
  private readonly MIN_VALUES_LENGTH = 20; // Reduced from 30
  private readonly MIN_SIGNAL_INTENSITY = 30; // Reduced from 50
  private fingerDetected: boolean = false;
  private consecutiveValidReadings: number = 0;
  private readonly MIN_CONSECUTIVE_READINGS = 2;

  public calculateSpO2(values: number[], isFingerDetected?: boolean): number {
    // First, update finger detection state
    if (isFingerDetected !== undefined) {
      this.fingerDetected = isFingerDetected;
    }
    
    // If no finger is detected, immediately return 0
    if (!this.fingerDetected) {
      this.resetBuffers();
      this.consecutiveValidReadings = 0;
      return 0;
    }

    if (values.length < this.MIN_VALUES_LENGTH) {
      return this.handleInvalidReading("Insufficient data points");
    }

    const dc = calculateDC(values);
    if (dc === 0 || dc < this.MIN_SIGNAL_INTENSITY) { 
      return this.handleInvalidReading("Signal intensity too low");
    }

    const ac = calculateAC(values);
    if (ac < this.MIN_AC_VALUE) {
      return this.handleInvalidReading("AC value too low");
    }

    const stdDev = this.calculateStandardDeviation(values);
    const cv = stdDev / Math.abs(dc);
    
    // Make this check more lenient
    if (stdDev < 2.0 || cv < 0.05) {
      return this.handleInvalidReading("Signal variation too low");
    }

    const perfusionIndex = calculatePerfusionIndex(values);
    if (perfusionIndex < this.MIN_PERFUSION_INDEX) {
      return this.handleInvalidReading("Perfusion index too low");
    }
    
    if (!this.checkSignalStability(values)) {
      return this.handleInvalidReading("Signal not stable");
    }

    // Valid reading detected, increment consecutive counter
    this.consecutiveValidReadings++;

    const R = ac / dc;
    const spO2 = Math.round(110 - (25 * R));
    const boundedSpO2 = Math.max(70, Math.min(100, spO2));

    if (boundedSpO2 >= 85 && boundedSpO2 <= 100) {
      this.addToMedianBuffer(boundedSpO2);
    }

    return this.getMedianValue();
  }

  private handleInvalidReading(reason: string): number {
    // Only reset buffers if we've had multiple invalid readings
    this.consecutiveValidReadings = 0;
    console.log(`Invalid SpO2 reading: ${reason}`);
    
    // Return the last known good value if we have one
    if (this.medianBuffer.length > 0) {
      return this.getMedianValue();
    }
    
    return 0;
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
    
    // Make this check more lenient (was 6-35, now 4-40)
    if (zeroCrossings < 4 || zeroCrossings > 40) {
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
    // Don't clear the median buffer immediately to maintain some stability
    // in case of momentary finger removal
  }

  public reset(): void {
    this.resetBuffers();
    this.medianBuffer = []; // Only clear median buffer on explicit reset
    this.fingerDetected = false;
    this.consecutiveValidReadings = 0;
  }
  
  public setFingerDetection(detected: boolean): void {
    this.fingerDetected = detected;
    if (!detected) {
      // Give some grace period before clearing all data
      setTimeout(() => {
        if (!this.fingerDetected) {
          this.resetBuffers();
          this.medianBuffer = [];
          this.consecutiveValidReadings = 0;
        }
      }, 1000);
    }
  }
}
