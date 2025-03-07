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

  // Improved finger detection parameters
  private readonly MIN_RED_THRESHOLD = 50;      // Minimum red value for finger detection
  private readonly MAX_RED_THRESHOLD = 245;     // Maximum red value (avoid saturation)
  private readonly RED_DOMINANCE_RATIO = 1.3;   // Red must be 30% higher than other channels
  private readonly MIN_SIGNAL_AMPLITUDE = 3;    // Minimum required signal variation
  private readonly MIN_VALID_PIXELS = 100;      // Minimum pixels for valid detection
  private readonly ROI_SCALE = 0.3;            // 30% of center area for Region of Interest

  // Signal quality parameters
  private readonly STABILITY_THRESHOLD = 0.7;   // Higher threshold for stability
  private readonly MIN_PERFUSION_INDEX = 0.08;  // Minimum perfusion index for good quality
  private readonly MAX_FRAME_TO_FRAME_VARIATION = 15; // Maximum allowed variation between frames

  /**
   * Applies a wavelet-based noise reduction followed by Savitzky-Golay filtering
   */
  public applySMAFilter(value: number): number {
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
   * Extracts red channel with improved finger detection
   */
  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Calculate ROI dimensions
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * this.ROI_SCALE;
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    let maxRed = 0;
    let minRed = 255;
    
    // Process ROI pixels
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Enhanced red dominance check
        if (r > g * this.RED_DOMINANCE_RATIO && r > b * this.RED_DOMINANCE_RATIO) {
          redSum += r;
          greenSum += g;
          blueSum += b;
          pixelCount++;
          
          maxRed = Math.max(maxRed, r);
          minRed = Math.min(minRed, r);
        }
      }
    }
    
    // Improved validation checks
    if (pixelCount < this.MIN_VALID_PIXELS) {
      return 0;
    }
    
    const avgRed = redSum / pixelCount;
    const signalAmplitude = maxRed - minRed;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Enhanced validation criteria
    const isValidSignal = 
      avgRed >= this.MIN_RED_THRESHOLD &&
      avgRed <= this.MAX_RED_THRESHOLD &&
      signalAmplitude >= this.MIN_SIGNAL_AMPLITUDE &&
      avgRed > (avgGreen * this.RED_DOMINANCE_RATIO) &&
      avgRed > (avgBlue * this.RED_DOMINANCE_RATIO);
    
    return isValidSignal ? avgRed : 0;
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
    const recentValues = this.ppgValues.slice(-this.SG_COEFFS.length);
    let filteredValue = 0;
    
    for (let i = 0; i < this.SG_COEFFS.length; i++) {
      filteredValue += recentValues[i] * this.SG_COEFFS[i];
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
}
