
import { calculateAC, calculateDC } from './utils';

export class SpO2Processor {
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_BUFFER_SIZE = 10;
  private readonly MEDIAN_BUFFER_SIZE = 5; // Buffer size for median filter
  private spo2Buffer: number[] = [];
  private medianBuffer: number[] = []; // Buffer for median filtering

  /**
   * Calculates the oxygen saturation (SpO2) from PPG values
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const dc = calculateDC(values);
    if (dc === 0) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const ac = calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 2);
      }
      return 0;
    }

    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    let spO2 = Math.round(98 - (15 * R));
    
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, spO2);

    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
    }

    // Add to median buffer for final filtering
    this.addToMedianBuffer(spO2);
    
    // Return median-filtered result
    return this.getMedianValue();
  }
  
  /**
   * Add value to median buffer and maintain buffer size
   */
  private addToMedianBuffer(value: number): void {
    if (value > 0) {
      this.medianBuffer.push(value);
      if (this.medianBuffer.length > this.MEDIAN_BUFFER_SIZE) {
        this.medianBuffer.shift();
      }
    }
  }
  
  /**
   * Calculate median value from buffer
   */
  private getMedianValue(): number {
    if (this.medianBuffer.length === 0) {
      return 0;
    }
    
    // Create sorted copy of the buffer
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    
    // Calculate median
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.medianBuffer = [];
  }
}
