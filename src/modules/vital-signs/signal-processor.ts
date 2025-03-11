
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

  // Stricter finger detection parameters
  private readonly MIN_RED_THRESHOLD = 80;      // Increased from 60 for stronger signal requirement
  private readonly MAX_RED_THRESHOLD = 220;     // Reduced from 230 to avoid saturation
  private readonly RED_DOMINANCE_RATIO = 1.6;   // Increased from 1.35 for clearer red channel isolation
  private readonly MIN_SIGNAL_AMPLITUDE = 6;    // Increased from 4 for better variation
  private readonly MIN_VALID_PIXELS = 150;      // Increased from 100 to require more consistent coverage
  private readonly ROI_SCALE = 0.18;            // Smaller ROI (from 0.20) for more focused detection
  private readonly SIGNAL_MEMORY = 5;
  private readonly HYSTERESIS = 15;             // Increased from 12 for better stability

  // Enhanced signal quality and stability parameters
  private readonly STABILITY_THRESHOLD = 0.80;  // Increased from 0.75
  private readonly MIN_PERFUSION_INDEX = 0.12;  // Increased from 0.08
  private readonly MAX_FRAME_TO_FRAME_VARIATION = 12; // Reduced from 15
  private lastValidDetectionTime: number = 0;
  private consecutiveValidFrames: number = 0;
  private readonly MIN_CONSECUTIVE_FRAMES = 6;  // Increased from 4
  private lastStableValue: number = 0;
  private stableSignalCount: number = 0;
  private readonly MIN_STABLE_SIGNAL_COUNT = 12; // Increased from 10
  private signalBuffer: number[] = [];
  private readonly SIGNAL_BUFFER_SIZE = 30;

  /**
   * Applies a wavelet-based noise reduction followed by Savitzky-Golay filtering
   */
  public applySMAFilter(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      console.warn('SignalProcessor: Invalid input value', value);
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
    
    // Apply denoising and SG filter
    const denoised = this.waveletDenoise(smaValue);
    
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      return this.applySavitzkyGolayFilter(denoised);
    }
    
    return denoised;
  }

  /**
   * Extracts red channel with improved finger detection and stability checks
   */
  private extractRedChannel(imageData: ImageData): number {
    if (!imageData || !imageData.data || imageData.data.length === 0) {
      console.warn('SignalProcessor: Invalid image data');
      return 0;
    }

    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Calculate ROI dimensions with stricter center focus
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * this.ROI_SCALE;
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    let maxRed = 0;
    let minRed = 255;
    let validRegionCount = 0;
    
    // Process ROI pixels with enhanced validation
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        if (i >= 0 && i < data.length - 3) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Stricter red channel validation
          if (r > g * this.RED_DOMINANCE_RATIO && 
              r > b * this.RED_DOMINANCE_RATIO && 
              r >= this.MIN_RED_THRESHOLD && 
              r <= this.MAX_RED_THRESHOLD) {
            
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
            
            // Enhanced regional validation
            if (Math.abs(r - this.lastStableValue) < this.HYSTERESIS) {
              validRegionCount++;
            }
          }
        }
      }
    }
    
    // ROI area calculation for coverage check
    const roiArea = (endX - startX) * (endY - startY);
    
    // Enhanced validation with coverage requirement
    if (pixelCount < this.MIN_VALID_PIXELS || pixelCount / roiArea < 0.35) {
      this.consecutiveValidFrames = 0;
      this.stableSignalCount = 0;
      return 0;
    }
    
    // Also check for contrast - an essential feature of a real finger
    if ((maxRed - minRed) < 20) {
      this.consecutiveValidFrames = 0;
      return 0;
    }
    
    const currentTime = Date.now();
    const avgRed = redSum / pixelCount;
    const signalAmplitude = maxRed - minRed;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Enhanced signal validation with stability checks
    const isValidSignal = 
      avgRed >= this.MIN_RED_THRESHOLD &&
      avgRed <= this.MAX_RED_THRESHOLD &&
      signalAmplitude >= this.MIN_SIGNAL_AMPLITUDE &&
      avgRed > (avgGreen * this.RED_DOMINANCE_RATIO) &&
      avgRed > (avgBlue * this.RED_DOMINANCE_RATIO) &&
      validRegionCount >= (pixelCount * 0.45); // Increased from 0.4 to 0.45 - stricter consistency requirement

    // Buffer management for signal stability analysis
    this.signalBuffer.push(avgRed);
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }

    // Calculate signal stability
    const isStableSignal = this.signalBuffer.length >= 5 && this.calculateSignalStability();

    if (isValidSignal && isStableSignal) {
      this.consecutiveValidFrames++;
      this.lastValidDetectionTime = currentTime;
      this.stableSignalCount++;
      
      // Only return signal after consistent stable detection
      if (this.consecutiveValidFrames >= this.MIN_CONSECUTIVE_FRAMES && 
          this.stableSignalCount >= this.MIN_STABLE_SIGNAL_COUNT) {
        this.lastStableValue = avgRed;
        return avgRed;
      }
    } else {
      // Reset stability counter but maintain brief signal memory
      if (currentTime - this.lastValidDetectionTime < 400) { // Reduced from 500 to 400ms
        return this.lastStableValue;
      }
      this.consecutiveValidFrames = Math.max(0, this.consecutiveValidFrames - 2); // Faster decrease - from 1 to 2
      this.stableSignalCount = Math.max(0, this.stableSignalCount - 2); // Faster stability loss
    }
    
    return 0;
  }

  private calculateStability(): number {
    if (this.ppgValues.length < 2) return 0;
    
    const variations = this.ppgValues.slice(1).map((val, i) => 
      Math.abs(val - this.ppgValues[i])
    );
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    const normalizedStability = Math.max(0, Math.min(1, 1 - (avgVariation / this.MAX_FRAME_TO_FRAME_VARIATION)));
    
    return normalizedStability > this.STABILITY_THRESHOLD ? normalizedStability : 0;
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
  }

  public getPPGValues(): number[] {
    return [...this.ppgValues];
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
    
    // Combined stability check with stricter criteria
    return variance < (mean * 0.08) && // Reduced from 0.1 to 0.08 - require more consistency
           maxVariation < this.MAX_FRAME_TO_FRAME_VARIATION;
  }
}
