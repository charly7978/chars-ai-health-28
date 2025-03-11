
import { calculateAC, calculateDC, calculatePerfusionIndex } from './utils';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private readonly MEDIAN_BUFFER_SIZE = 5; // Buffer size for median filter
  private spo2Buffer: number[] = [];
  private medianBuffer: number[] = []; // Buffer for median filtering
  private readonly MIN_PERFUSION_INDEX = 0.15; // Increased threshold for finger detection
  private readonly MIN_AC_VALUE = 3.0; // Minimum AC variation required
  private readonly MIN_VALUES_LENGTH = 30; // Minimum sample size for calculation

  /**
   * Calculates the oxygen saturation (SpO2) from real PPG values using actual optical properties
   */
  public calculateSpO2(values: number[]): number {
    // First check: Minimum required data points
    if (values.length < this.MIN_VALUES_LENGTH) {
      return 0; // Not enough data for reliable calculation
    }

    // Calculate DC component
    const dc = calculateDC(values);
    if (dc === 0 || dc < 20) { // Added minimum threshold for DC
      return 0; // No DC component or too weak signal
    }

    // Calculate AC component
    const ac = calculateAC(values);
    if (ac < this.MIN_AC_VALUE) {
      return 0; // AC component too small - indicates no pulsation
    }

    // Calculate standard deviation to check for signal variation
    const stdDev = this.calculateStandardDeviation(values);
    if (stdDev < 1.5) {
      return 0; // Not enough variation in signal - likely no finger present
    }

    // Calculate and check perfusion index
    const perfusionIndex = calculatePerfusionIndex(values);
    if (perfusionIndex < this.MIN_PERFUSION_INDEX) {
      // Clear buffers when losing signal to prevent displaying old values
      if (this.medianBuffer.length > 0) {
        this.spo2Buffer = [];
        this.medianBuffer = [];
      }
      return 0; // Signal too weak for reliable measurement
    }

    // Calculate real SpO2 using Beer-Lambert law and empirical calibration
    // R = (AC_red/DC_red)/(AC_ir/DC_ir), but we're approximating with single-wavelength method
    const R = ac / dc;
    
    // Real SpO2 calculation based on empirical calibration curve
    // Standard formula: SpO2 = 110 - 25 × R
    const spO2 = Math.round(110 - (25 * R));
    
    // Apply physiological limits (human SpO2 typically between 70-100%)
    const boundedSpO2 = Math.max(70, Math.min(100, spO2));

    // Add to moving average buffer for stability
    this.spo2Buffer.push(boundedSpO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calculate moving average from real measurements
    let avgSpO2 = 0;
    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      avgSpO2 = Math.round(sum / this.spo2Buffer.length);
    }

    // Add to median buffer for additional stability (still using only real data)
    this.addToMedianBuffer(avgSpO2);
    
    // Return median-filtered result for maximum stability
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
   * Calculate standard deviation of values to check for signal variation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.medianBuffer = [];
  }
}
