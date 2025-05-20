
/**
 * Clase para validación de señales biofísicamente plausibles
 * Aplica restricciones fisiológicas a las señales PPG
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
 */
export class BiophysicalValidator {
  private lastPulsatilityValues: number[] = [];
  private readonly MAX_PULSATILITY_HISTORY = 30;
  private readonly MIN_PULSATILITY = 0.1; // Increased threshold for more accurate detection
  private readonly MAX_PULSATILITY = 8.0;
  private lastRawValues: number[] = []; // Raw values for trend analysis
  private lastTimeStamps: number[] = []; // Timestamps for temporal analysis
  private readonly MEASUREMENTS_PER_SECOND = 30; // Assumed frame rate

  // Biophysical normal ranges for PPG signals
  private readonly PHYSIOLOGICAL_RANGES = {
    redToGreen: { min: 1.0, max: 3.5, weight: 0.4 }, // More restrictive
    redToBlue: { min: 1.0, max: 4.0, weight: 0.3 }, // More restrictive
    redValue: { min: 25, max: 230, weight: 0.3 } // Higher minimum threshold
  };

  constructor() {
    // Initialize pulsatility history
    this.reset();
  }

  /**
   * Calculates signal pulsatility index based on recent variations
   * @param value Current filtered signal value
   * @returns Normalized pulsatility index between 0-1
   */
  calculatePulsatilityIndex(value: number): number {
    const currentTime = Date.now();
    
    // Add to history
    this.lastPulsatilityValues.push(value);
    this.lastRawValues.push(value);
    this.lastTimeStamps.push(currentTime);
    
    // Mantener tamaño limitado
    if (this.lastPulsatilityValues.length > this.MAX_PULSATILITY_HISTORY) {
      this.lastPulsatilityValues.shift();
      this.lastRawValues.shift();
      this.lastTimeStamps.shift();
    }
    
    // If not enough values, return conservative pulsatility
    if (this.lastPulsatilityValues.length < 12) {
      return 0.2; // More conservative initial value
    }
    
    // Calculate variability (difference between recent max and min)
    const max = Math.max(...this.lastPulsatilityValues);
    const min = Math.min(...this.lastPulsatilityValues);
    const mean = this.lastPulsatilityValues.reduce((sum, val) => sum + val, 0) / 
                 this.lastPulsatilityValues.length;
    
    // Avoid division by zero
    if (Math.abs(mean) < 0.001) {
      return 0.0; // No signal
    }
    
    // IMPROVEMENT 1: Calculate pulsatility index based on variations, more stringent
    const rawPulsatility = (max - min) / Math.abs(mean);
    
    // IMPROVEMENT 2: Enhanced frequency analysis specifically for cardiac rhythms
    const freqScore = this.analyzeCardiacFrequency();
    
    // IMPROVEMENT 3: Normalize to range 0-1 with more stringent criteria
    let normalizedPulsatility = Math.max(0, Math.min(1, 
      (rawPulsatility - this.MIN_PULSATILITY) / 
      (this.MAX_PULSATILITY - this.MIN_PULSATILITY)
    ));
    
    // IMPROVEMENT 4: Apply cross-validation between pulsatility and frequency
    // Only consider high pulsatility valid if frequency analysis confirms cardiac rhythm
    if (normalizedPulsatility > 0.7 && freqScore < 0.3) {
      normalizedPulsatility *= 0.5; // Penalize high variability not matching cardiac patterns
    }
    
    // Apply frequency confidence
    normalizedPulsatility = normalizedPulsatility * 0.6 + freqScore * 0.4;
    
    return normalizedPulsatility;
  }
  
  /**
   * Analyzes signal frequency to detect patterns compatible with cardiac rhythm
   * Enhanced to only detect frequencies in human heart rate range (40-180 BPM)
   * @returns Score 0-1 based on compatibility with cardiac rhythm
   */
  private analyzeCardiacFrequency(): number {
    if (this.lastTimeStamps.length < 15 || this.lastRawValues.length < 15) {
      return 0.0; // Not enough data to analyze
    }
    
    // Advanced peak detection with validation
    const peaks: number[] = [];
    const peakTimes: number[] = [];
    const valleyTimes: number[] = [];
    
    // First, identify potential peaks
    for (let i = 3; i < this.lastRawValues.length - 3; i++) {
      const current = this.lastRawValues[i];
      
      // Check if this point is higher than surrounding points
      if (current > this.lastRawValues[i-1] && 
          current > this.lastRawValues[i-2] && 
          current > this.lastRawValues[i+1] && 
          current > this.lastRawValues[i+2]) {
        
        peaks.push(i);
        peakTimes.push(this.lastTimeStamps[i]);
      }
      
      // Also identify valleys for rhythm analysis
      if (current < this.lastRawValues[i-1] && 
          current < this.lastRawValues[i-2] && 
          current < this.lastRawValues[i+1] && 
          current < this.lastRawValues[i+2]) {
        
        valleyTimes.push(this.lastTimeStamps[i]);
      }
    }
    
    // Calculate peak-to-peak intervals
    const intervals: number[] = [];
    for (let i = 1; i < peakTimes.length; i++) {
      intervals.push(peakTimes[i] - peakTimes[i-1]);
    }
    
    // No intervals detected
    if (intervals.length === 0) return 0.0;
    
    // Calculate average interval and convert to BPM
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const estimatedBPM = 60000 / avgInterval;
    
    // Calculate interval consistency (lower variation means more consistent rhythm)
    let intervalVariation = 0;
    for (const interval of intervals) {
      intervalVariation += Math.abs(interval - avgInterval) / avgInterval;
    }
    intervalVariation /= intervals.length;
    
    // Only consider valid heart rates between 40-180 BPM
    // with strong penalty for ranges outside physiological norms
    let bpmScore = 0;
    if (estimatedBPM >= 40 && estimatedBPM <= 180) {
      // Strongest confidence in normal range (50-120 BPM)
      if (estimatedBPM >= 50 && estimatedBPM <= 120) {
        bpmScore = 1.0;
      } else {
        // Reduced confidence for extreme but still physiological ranges
        bpmScore = 0.7;
      }
    } else if (estimatedBPM > 30 && estimatedBPM < 200) {
      // Very low confidence in borderline physiological ranges
      bpmScore = 0.2;
    } else {
      // Non-physiological ranges get zero score
      bpmScore = 0;
    }
    
    // Calculate regularity score (lower intervalVariation is better)
    const regularityScore = intervalVariation < 0.2 ? 
                           1.0 : Math.max(0, 1 - (intervalVariation - 0.2) * 2);
    
    // Calculate peak-valley alternation score (proper cardiac signal alternates)
    let alternationScore = 0;
    if (peaks.length >= 3 && valleyTimes.length >= 3) {
      let properAlternations = 0;
      let totalChecks = 0;
      
      // Check for proper peak-valley-peak alternation pattern
      for (let i = 0; i < peakTimes.length - 1; i++) {
        const peakTime = peakTimes[i];
        const nextPeakTime = peakTimes[i+1];
        
        // Find if there's a valley between these peaks
        const hasValleyBetween = valleyTimes.some(vt => vt > peakTime && vt < nextPeakTime);
        
        if (hasValleyBetween) {
          properAlternations++;
        }
        totalChecks++;
      }
      
      alternationScore = totalChecks > 0 ? properAlternations / totalChecks : 0;
    }
    
    // Final frequency score combines BPM validity, regularity, and alternation pattern
    const frequencyScore = bpmScore * 0.5 + regularityScore * 0.3 + alternationScore * 0.2;
    
    // Return final score with strong penalties for non-cardiac patterns
    return Math.pow(frequencyScore, 1.5); // Exponential weighting favors clear cardiac signals
  }

  /**
   * Validates if signal parameters are within biophysically plausible ranges
   * @param redValue Mean red channel value
   * @param rToGRatio Red/green ratio
   * @param rToBRatio Red/blue ratio
   * @returns Biophysical plausibility score (0-1)
   */
  validateBiophysicalRange(redValue: number, rToGRatio: number, rToBRatio: number): number {
    // Validate absolute red level (must be in reasonable range)
    const redValueScore = this.calculateRangeScore(
      redValue,
      this.PHYSIOLOGICAL_RANGES.redValue.min,
      this.PHYSIOLOGICAL_RANGES.redValue.max
    );
    
    // Validate red/green ratio (key hemoglobin characteristic)
    const rToGScore = this.calculateRangeScore(
      rToGRatio,
      this.PHYSIOLOGICAL_RANGES.redToGreen.min,
      this.PHYSIOLOGICAL_RANGES.redToGreen.max
    );
    
    // Validate red/blue ratio (another hemoglobin characteristic)
    const rToBScore = this.calculateRangeScore(
      rToBRatio,
      this.PHYSIOLOGICAL_RANGES.redToBlue.min,
      this.PHYSIOLOGICAL_RANGES.redToBlue.max
    );
    
    // IMPROVEMENT: Add cross-validation between color ratios
    // Both ratios should be consistent with each other
    let crossValidationScore = 1.0;
    const ratioCorrelation = Math.abs(rToGRatio - rToBRatio) / Math.max(rToGRatio, rToBRatio);
    
    // Strong penalty for inconsistent ratios - indicates non-blood signal sources
    if (ratioCorrelation > 0.4) {
      crossValidationScore = 0.5;
    }
    
    // More severe penalty for extremely divergent ratios
    if (ratioCorrelation > 0.7) {
      crossValidationScore = 0.2;
    }
    
    // Strict red threshold enforcement - below minimum is definitive rejection
    if (redValue < this.PHYSIOLOGICAL_RANGES.redValue.min) {
      return 0.0;
    }
    
    // Calculate weighted score with new cross-validation component
    const weightedScore = 
      redValueScore * this.PHYSIOLOGICAL_RANGES.redValue.weight +
      rToGScore * this.PHYSIOLOGICAL_RANGES.redToGreen.weight +
      rToBScore * this.PHYSIOLOGICAL_RANGES.redToBlue.weight;
    
    // Apply cross-validation penalty
    return weightedScore * crossValidationScore;
  }

  /**
   * Calculates a score based on whether a value is within range
   * with smooth transition at boundaries
   */
  private calculateRangeScore(value: number, min: number, max: number): number {
    // If in optimal range
    if (value >= min && value <= max) {
      return 1.0;
    }
    
    // If below minimum, calculate score with gradient
    if (value < min) {
      const distance = min - value;
      const range = min * 0.5; // Allow deviation up to 50% below (more strict)
      
      return Math.max(0, 1 - (distance / range));
    }
    
    // If above maximum, calculate score with gradient
    const distance = value - max;
    const range = max * 0.5; // Allow deviation up to 50% above (more strict)
    
    return Math.max(0, 1 - (distance / range));
  }

  /**
   * Reset the validator state
   */
  reset(): void {
    this.lastPulsatilityValues = [];
    this.lastRawValues = [];
    this.lastTimeStamps = [];
  }
}
