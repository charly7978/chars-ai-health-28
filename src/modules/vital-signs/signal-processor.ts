
import { calculateAC, calculateDC } from './utils';

/**
 * Enhanced Signal Processor based on advanced biomedical signal processing techniques
 */
export class SignalProcessor {
  private readonly SMA_WINDOW = 5;
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 300;
  private readonly SG_COEFFS = [0.2, 0.3, 0.5, 0.7, 1.0, 0.7, 0.5, 0.3, 0.2];
  private readonly SG_NORM = 4.4;
  private readonly WAVELET_THRESHOLD = 0.03;
  private readonly BASELINE_FACTOR = 0.92;
  private baselineValue: number = 0;

  // Parámetros originales restaurados
  private readonly MIN_RED_THRESHOLD = 50;     // Umbral mínimo reducido
  private readonly MAX_RED_THRESHOLD = 220;    
  private readonly RED_DOMINANCE_RATIO = 1.20; // Ratio reducido
  private readonly MIN_SIGNAL_AMPLITUDE = 4;   // Amplitud mínima reducida
  private readonly MIN_VALID_PIXELS = 100;     // Menos píxeles requeridos
  private readonly ROI_SCALE = 0.15;           
  private readonly SIGNAL_MEMORY = 5;          // Mayor memoria de señal
  private readonly HYSTERESIS = 8;             

  // Parámetros de calidad de señal ajustados
  private readonly STABILITY_THRESHOLD = 0.70;  // Menor estabilidad requerida
  private readonly MIN_PERFUSION_INDEX = 0.10;  // Índice de perfusión reducido
  private readonly MAX_FRAME_TO_FRAME_VARIATION = 40; // Mayor variación permitida
  private lastValidDetectionTime: number = 0;
  private consecutiveValidFrames: number = 0;
  private readonly MIN_CONSECUTIVE_FRAMES = 4;  // Menos frames requeridos
  private lastStableValue: number = 0;
  private stableSignalCount: number = 0;
  private readonly MIN_STABLE_SIGNAL_COUNT = 10; // Menos señales estables requeridas
  private signalBuffer: number[] = [];
  private readonly SIGNAL_BUFFER_SIZE = 30;
  private fingerDetectedState: boolean = false; // Estado de detección de dedo

  /**
   * Applies a wavelet-based noise reduction followed by Savitzky-Golay filtering
   */
  public applySMAFilter(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      console.warn('SignalProcessor: Invalid input value', value);
      return 0;
    }

    // If value is effectively zero, we're not getting real signal
    if (Math.abs(value) < 0.1) {
      this.handleSignalLoss();
      return 0;
    }

    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    // Initialize baseline value if needed
    if (this.baselineValue === 0 && this.ppgValues.length > 0) {
      this.baselineValue = value;
    } else {
      // Adaptive baseline tracking
      this.baselineValue = this.baselineValue * this.BASELINE_FACTOR + 
                          value * (1 - this.BASELINE_FACTOR);
    }
    
    // Apply SMA filter
    const smaBuffer = this.ppgValues.slice(-this.SMA_WINDOW);
    const smaValue = smaBuffer.reduce((a, b) => a + b, 0) / smaBuffer.length;
    
    // Check if this is just noise (should have some variation in real PPG)
    if (this.ppgValues.length > 10) {
      const lastTen = this.ppgValues.slice(-10);
      const stdDev = this.calculateStandardDeviation(lastTen);
      if (stdDev < 0.8 && value > 1.0) { // Umbral reducido
        this.handleSignalLoss();
        return 0;
      }
    }
    
    // Apply denoising and SG filter
    const denoised = this.waveletDenoise(smaValue);
    
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(denoised);
    }
    
    return denoised;
  }

  /**
   * Handle loss of signal by resetting state
   */
  private handleSignalLoss(): void {
    this.fingerDetectedState = false;
    this.consecutiveValidFrames = 0;
    this.stableSignalCount = 0;
    this.lastStableValue = 0;
  }

  /**
   * Calculate standard deviation for a set of values
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Simplified wavelet denoising based on soft thresholding
   */
  private waveletDenoise(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return this.baselineValue;
    }

    const normalizedValue = value - this.baselineValue;
    
    if (Math.abs(normalizedValue) < this.WAVELET_THRESHOLD) {
      return this.baselineValue;
    }
    
    const sign = normalizedValue >= 0 ? 1 : -1;
    const denoisedValue = sign * (Math.abs(normalizedValue) - this.WAVELET_THRESHOLD);
    
    return this.baselineValue + denoisedValue;
  }

  /**
   * Implements Savitzky-Golay filtering
   */
  private applySavitzkyGolayFilter(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return 0;
    }

    const recentValues = this.ppgValues.slice(-this.SG_COEFFS.length);
    let filteredValue = 0;
    
    for (let i = 0; i < this.SG_COEFFS.length; i++) {
      if (i < recentValues.length) {
        filteredValue += recentValues[i] * this.SG_COEFFS[i];
      }
    }
    
    return filteredValue / this.SG_NORM;
  }

  public reset(): void {
    this.ppgValues = [];
    this.baselineValue = 0;
    this.fingerDetectedState = false;
    this.consecutiveValidFrames = 0;
    this.stableSignalCount = 0;
    this.signalBuffer = [];
    this.lastStableValue = 0;
  }

  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }

  /**
   * Explicitly check if finger is detected based on current signal quality
   */
  public isFingerDetected(): boolean {
    return this.fingerDetectedState && this.consecutiveValidFrames >= this.MIN_CONSECUTIVE_FRAMES;
  }

  /**
   * Enhanced signal stability calculation
   */
  private calculateSignalStability(): boolean {
    if (this.signalBuffer.length < 5) return false;
    
    // Calculate moving statistics
    const recentValues = this.signalBuffer.slice(-5);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calculate variance
    const variance = recentValues.reduce((acc, val) => {
      const diff = val - mean;
      return acc + (diff * diff);
    }, 0) / recentValues.length;
    
    // Check frame-to-frame variations
    const maxVariation = Math.max(...recentValues.slice(1).map((val, i) => 
      Math.abs(val - recentValues[i])
    ));
    
    // Combined stability check
    return variance < (mean * 0.1) && // Low variance relative to signal
           maxVariation < this.MAX_FRAME_TO_FRAME_VARIATION;
  }
}
