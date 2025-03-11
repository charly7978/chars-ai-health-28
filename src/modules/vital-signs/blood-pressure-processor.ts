
/**
 * Advanced Blood Pressure Processor based on PPG signal analysis
 * Implements cutting-edge techniques to extract maximum information from PPG waveforms
 * with physiologically plausible but expanded measurement ranges
 */
import { calculateAmplitude, findPeaksAndValleys, calculateSlope, calculateAreaUnderCurve } from './utils';

export class BloodPressureProcessor {
  // Expanded physiological ranges
  private readonly MIN_SYSTOLIC = 10; // Expanded minimum (normal is ~90)
  private readonly MAX_SYSTOLIC = 350; // Expanded maximum (normal is ~180)
  private readonly MIN_DIASTOLIC = 10; // Expanded minimum (normal is ~60)
  private readonly MAX_DIASTOLIC = 250; // Expanded maximum (normal is ~110)
  
  // Advanced processing parameters
  private readonly PPG_WINDOW_SIZE = 300; // 10 seconds at 30fps
  private readonly PTT_BUFFER_SIZE = 15;
  private readonly AMPLITUDE_BUFFER_SIZE = 15;
  private readonly FEATURE_BUFFER_SIZE = 10;
  private readonly FINAL_BP_BUFFER_SIZE = 12;
  
  // Statistical processing parameters
  private readonly MEDIAN_WEIGHT = 0.35;
  private readonly CONTINUOUS_WEIGHT = 0.65;
  private readonly BASELINE_ADAPTATION_RATE = 0.05;
  
  // Measurement state
  private ppgBuffer: number[] = [];
  private pttValues: number[] = [];
  private amplitudeValues: number[] = [];
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private finalSystolicBuffer: number[] = [];
  private finalDiastolicBuffer: number[] = [];
  private lastPeakTime: number = 0;
  private baselineSystolic: number = 120;
  private baselineDiastolic: number = 80;
  private lastMeasurementTime: number = 0;
  private processingActive: boolean = false;
  private measurementCompleted: boolean = false;
  private finalSystolic: number = 0;
  private finalDiastolic: number = 0;
  
  // Advanced feature extraction buffers
  private dicroticNotchTimes: number[] = [];
  private systolicRiseSlopes: number[] = [];
  private diastolicDecayRates: number[] = [];
  private areaRatios: number[] = [];

  constructor() {
    this.lastMeasurementTime = Date.now();
  }
  
  /**
   * Enhanced blood pressure calculation using comprehensive PPG waveform analysis
   * Extracts multiple features that correlate with blood pressure according to research
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30 || this.measurementCompleted) {
      return {
        systolic: this.finalSystolic,
        diastolic: this.finalDiastolic
      };
    }

    // Update main signal buffer
    this.updatePPGBuffer(values);
    
    // Extract comprehensive waveform features
    const features = this.extractAdvancedFeatures(this.ppgBuffer);
    if (!features.valid) {
      return this.getCurrentEstimate();
    }
    
    // Multi-parametric BP estimation using multiple features
    const bpEstimate = this.multiParametricBPEstimation(features);
    
    // Process and update running estimates
    this.updateBPBuffers(bpEstimate.systolic, bpEstimate.diastolic);
    
    // Calculate current best estimate
    const currentEstimate = this.calculateCurrentEstimate();
    
    return currentEstimate;
  }
  
  /**
   * Completes the measurement and finalizes the BP calculation
   * Applies additional statistical processing for the final result
   */
  public completeMeasurement(): {
    systolic: number;
    diastolic: number;
  } {
    if (this.measurementCompleted || this.systolicBuffer.length < 5) {
      return {
        systolic: this.finalSystolic,
        diastolic: this.finalDiastolic
      };
    }
    
    // Apply final statistical processing
    const medianSystolic = this.calculateMedian(this.systolicBuffer);
    const medianDiastolic = this.calculateMedian(this.diastolicBuffer);
    
    // Calculate weighted average with recent measurements
    const recentSystolic = this.systolicBuffer.slice(-5);
    const recentDiastolic = this.diastolicBuffer.slice(-5);
    
    let weightedSumSys = 0;
    let weightedSumDia = 0;
    let weightSum = 0;
    
    for (let i = 0; i < recentSystolic.length; i++) {
      const weight = Math.pow(1.2, i);
      weightedSumSys += recentSystolic[i] * weight;
      weightedSumDia += recentDiastolic[i] * weight;
      weightSum += weight;
    }
    
    const weightedSystolic = weightSum > 0 ? weightedSumSys / weightSum : medianSystolic;
    const weightedDiastolic = weightSum > 0 ? weightedSumDia / weightSum : medianDiastolic;
    
    // Combine both methods for final result
    this.finalSystolic = Math.round(medianSystolic * this.MEDIAN_WEIGHT + weightedSystolic * (1 - this.MEDIAN_WEIGHT));
    this.finalDiastolic = Math.round(medianDiastolic * this.MEDIAN_WEIGHT + weightedDiastolic * (1 - this.MEDIAN_WEIGHT));
    
    // Ensure final values are within allowed expanded range
    this.finalSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, this.finalSystolic));
    this.finalDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, this.finalDiastolic));
    
    // Mark measurement as completed
    this.measurementCompleted = true;
    
    return {
      systolic: this.finalSystolic,
      diastolic: this.finalDiastolic
    };
  }
  
  /**
   * Reset the processor for a new measurement
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.pttValues = [];
    this.amplitudeValues = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.finalSystolicBuffer = [];
    this.finalDiastolicBuffer = [];
    this.dicroticNotchTimes = [];
    this.systolicRiseSlopes = [];
    this.diastolicDecayRates = [];
    this.areaRatios = [];
    this.lastPeakTime = 0;
    this.processingActive = false;
    this.measurementCompleted = false;
    this.finalSystolic = 0;
    this.finalDiastolic = 0;
  }
  
  /**
   * Updates the PPG signal buffer with new values
   */
  private updatePPGBuffer(newValues: number[]): void {
    // Append new values to buffer
    this.ppgBuffer = [...this.ppgBuffer, ...newValues];
    
    // Trim buffer to maintain window size
    if (this.ppgBuffer.length > this.PPG_WINDOW_SIZE) {
      this.ppgBuffer = this.ppgBuffer.slice(-this.PPG_WINDOW_SIZE);
    }
  }
  
  /**
   * Extracts multiple advanced features from the PPG waveform
   * Based on cutting-edge research in PPG-based BP estimation
   */
  private extractAdvancedFeatures(values: number[]): any {
    if (values.length < 60) {
      return { valid: false };
    }
    
    // Find peaks and valleys in the signal
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return { valid: false };
    }
    
    // Calculate pulse transit time (PTT) features
    const pttFeatures = this.calculatePTTFeatures(peakIndices);
    
    // Calculate amplitude features
    const amplitudeFeatures = this.calculateAmplitudeFeatures(values, peakIndices, valleyIndices);
    
    // Calculate waveform morphology features
    const morphologyFeatures = this.calculateMorphologyFeatures(values, peakIndices, valleyIndices);
    
    // Calculate frequency domain features
    const frequencyFeatures = this.calculateFrequencyFeatures(values);
    
    // Advanced feature: find dicrotic notch
    const dicroticFeatures = this.detectDicroticNotch(values, peakIndices, valleyIndices);
    
    // Advanced feature: area ratios
    const areaFeatures = this.calculateAreaFeatures(values, peakIndices, valleyIndices);
    
    return {
      valid: true,
      ptt: pttFeatures,
      amplitude: amplitudeFeatures,
      morphology: morphologyFeatures,
      frequency: frequencyFeatures,
      dicrotic: dicroticFeatures,
      area: areaFeatures
    };
  }
  
  /**
   * Calculate features related to pulse transit time
   */
  private calculatePTTFeatures(peakIndices: number[]): any {
    const fps = 30;
    const msPerSample = 1000 / fps;
    const peakIntervals: number[] = [];
    
    for (let i = 1; i < peakIndices.length; i++) {
      const interval = (peakIndices[i] - peakIndices[i-1]) * msPerSample;
      if (interval >= 200 && interval <= 1500) {
        peakIntervals.push(interval);
        this.pttValues.push(interval);
      }
    }
    
    // Trim PTT buffer
    if (this.pttValues.length > this.PTT_BUFFER_SIZE) {
      this.pttValues = this.pttValues.slice(-this.PTT_BUFFER_SIZE);
    }
    
    // Calculate statistics
    const meanPTT = peakIntervals.length > 0 ? 
      peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length : 0;
      
    const medianPTT = this.calculateMedian(this.pttValues);
    
    return {
      meanPTT,
      medianPTT,
      pttValues: peakIntervals
    };
  }
  
  /**
   * Calculate amplitude-related features
   */
  private calculateAmplitudeFeatures(values: number[], peakIndices: number[], valleyIndices: number[]): any {
    // Calculate amplitude
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    this.amplitudeValues.push(amplitude);
    
    // Trim amplitude buffer
    if (this.amplitudeValues.length > this.AMPLITUDE_BUFFER_SIZE) {
      this.amplitudeValues = this.amplitudeValues.slice(-this.AMPLITUDE_BUFFER_SIZE);
    }
    
    // Calculate amplitude statistics
    const meanAmplitude = this.amplitudeValues.reduce((a, b) => a + b, 0) / this.amplitudeValues.length;
    const medianAmplitude = this.calculateMedian(this.amplitudeValues);
    
    return {
      amplitude,
      meanAmplitude,
      medianAmplitude
    };
  }
  
  /**
   * Calculate morphology-related features of the waveform
   */
  private calculateMorphologyFeatures(values: number[], peakIndices: number[], valleyIndices: number[]): any {
    const slopes: number[] = [];
    const decayRates: number[] = [];
    
    // Calculate systolic rise slope and diastolic decay
    for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
      if (peakIndices[i] > valleyIndices[i]) {
        // Calculate rise slope (valley to peak)
        const riseTime = peakIndices[i] - valleyIndices[i];
        const riseHeight = values[peakIndices[i]] - values[valleyIndices[i]];
        if (riseTime > 0) {
          const riseSlope = riseHeight / riseTime;
          slopes.push(riseSlope);
          this.systolicRiseSlopes.push(riseSlope);
        }
        
        // Calculate decay rate (peak to next valley)
        if (i + 1 < valleyIndices.length && valleyIndices[i + 1] > peakIndices[i]) {
          const decayTime = valleyIndices[i + 1] - peakIndices[i];
          const decayHeight = values[peakIndices[i]] - values[valleyIndices[i + 1]];
          if (decayTime > 0) {
            const decayRate = decayHeight / decayTime;
            decayRates.push(decayRate);
            this.diastolicDecayRates.push(decayRate);
          }
        }
      }
    }
    
    // Trim feature buffers
    if (this.systolicRiseSlopes.length > this.FEATURE_BUFFER_SIZE) {
      this.systolicRiseSlopes = this.systolicRiseSlopes.slice(-this.FEATURE_BUFFER_SIZE);
    }
    
    if (this.diastolicDecayRates.length > this.FEATURE_BUFFER_SIZE) {
      this.diastolicDecayRates = this.diastolicDecayRates.slice(-this.FEATURE_BUFFER_SIZE);
    }
    
    // Calculate statistics
    const meanRiseSlope = this.systolicRiseSlopes.length > 0 ? 
      this.systolicRiseSlopes.reduce((a, b) => a + b, 0) / this.systolicRiseSlopes.length : 0;
      
    const meanDecayRate = this.diastolicDecayRates.length > 0 ? 
      this.diastolicDecayRates.reduce((a, b) => a + b, 0) / this.diastolicDecayRates.length : 0;
    
    return {
      meanRiseSlope,
      meanDecayRate,
      riseSlopes: slopes,
      decayRates: decayRates
    };
  }
  
  /**
   * Calculate basic frequency domain features
   */
  private calculateFrequencyFeatures(values: number[]): any {
    // Simple approach to frequency analysis
    // In a production system, we would use FFT or wavelet transforms
    const segmentSize = 60; // 2 seconds at 30fps
    const segments = Math.floor(values.length / segmentSize);
    
    if (segments < 2) {
      return { valid: false };
    }
    
    const segmentVariances: number[] = [];
    
    for (let i = 0; i < segments; i++) {
      const segment = values.slice(i * segmentSize, (i + 1) * segmentSize);
      const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
      
      const variance = segment.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / segment.length;
      segmentVariances.push(variance);
    }
    
    // Calculate ratio of high-frequency to low-frequency components
    // This is a simplified approach
    const highFreqVar = segmentVariances.slice(segments / 2).reduce((a, b) => a + b, 0) / (segments / 2);
    const lowFreqVar = segmentVariances.slice(0, segments / 2).reduce((a, b) => a + b, 0) / (segments / 2);
    
    const hfLfRatio = lowFreqVar > 0 ? highFreqVar / lowFreqVar : 1;
    
    return {
      hfLfRatio,
      segmentVariances
    };
  }
  
  /**
   * Detect dicrotic notch in PPG waveform
   * The dicrotic notch timing correlates with arterial stiffness
   */
  private detectDicroticNotch(values: number[], peakIndices: number[], valleyIndices: number[]): any {
    const dicroticTimes: number[] = [];
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const peakIndex = peakIndices[i];
      const nextPeakIndex = peakIndices[i + 1];
      
      // Look for a local minimum in the decay phase (dicrotic notch)
      if (nextPeakIndex - peakIndex > 10) {
        const decayPhase = values.slice(peakIndex, nextPeakIndex);
        
        // First third of decay phase - normalize against the full cycle
        const searchRange = Math.floor(decayPhase.length / 3);
        const searchEnd = peakIndex + searchRange;
        
        let minValue = decayPhase[0];
        let minIndex = 0;
        
        for (let j = 1; j < searchRange; j++) {
          if (decayPhase[j] < minValue) {
            minValue = decayPhase[j];
            minIndex = j;
          }
        }
        
        if (minIndex > 0) {
          const dicroticTime = minIndex / decayPhase.length;
          dicroticTimes.push(dicroticTime);
          this.dicroticNotchTimes.push(dicroticTime);
        }
      }
    }
    
    // Trim dicrotic notch buffer
    if (this.dicroticNotchTimes.length > this.FEATURE_BUFFER_SIZE) {
      this.dicroticNotchTimes = this.dicroticNotchTimes.slice(-this.FEATURE_BUFFER_SIZE);
    }
    
    // Calculate statistics
    const meanDicroticTime = this.dicroticNotchTimes.length > 0 ? 
      this.dicroticNotchTimes.reduce((a, b) => a + b, 0) / this.dicroticNotchTimes.length : 0;
    
    return {
      meanDicroticTime,
      dicroticTimes
    };
  }
  
  /**
   * Calculate area-related features
   */
  private calculateAreaFeatures(values: number[], peakIndices: number[], valleyIndices: number[]): any {
    const areaRatios: number[] = [];
    
    // Calculate systolic and diastolic areas
    for (let i = 0; i < valleyIndices.length - 1; i++) {
      const startIndex = valleyIndices[i];
      const endIndex = valleyIndices[i + 1];
      
      // Find peaks between these valleys
      const peaksInCycle = peakIndices.filter(p => p > startIndex && p < endIndex);
      
      if (peaksInCycle.length === 1) {
        const peakIndex = peaksInCycle[0];
        
        // Systolic area (from start to peak)
        const systolicArea = calculateAreaUnderCurve(values, startIndex, peakIndex);
        
        // Diastolic area (from peak to end)
        const diastolicArea = calculateAreaUnderCurve(values, peakIndex, endIndex);
        
        if (diastolicArea > 0) {
          const areaRatio = systolicArea / diastolicArea;
          areaRatios.push(areaRatio);
          this.areaRatios.push(areaRatio);
        }
      }
    }
    
    // Trim area ratio buffer
    if (this.areaRatios.length > this.FEATURE_BUFFER_SIZE) {
      this.areaRatios = this.areaRatios.slice(-this.FEATURE_BUFFER_SIZE);
    }
    
    // Calculate statistics
    const meanAreaRatio = this.areaRatios.length > 0 ? 
      this.areaRatios.reduce((a, b) => a + b, 0) / this.areaRatios.length : 0;
    
    return {
      meanAreaRatio,
      areaRatios
    };
  }
  
  /**
   * Multi-parametric BP estimation using all extracted features
   * Based on multiple research papers on PPG-based BP estimation
   */
  private multiParametricBPEstimation(features: any): {
    systolic: number;
    diastolic: number;
  } {
    // Base values - will be adjusted by various features
    let systolicEstimate = this.baselineSystolic;
    let diastolicEstimate = this.baselineDiastolic;
    
    // 1. PTT-based adjustment (inverse relationship with BP)
    if (features.ptt.medianPTT > 0) {
      // Transform PTT to physiological range (200-1200 ms)
      const normalizedPTT = Math.max(200, Math.min(1200, features.ptt.medianPTT));
      // Non-linear relationship based on research models
      const pttFactor = Math.pow((1200 - normalizedPTT) / 1000, 1.5) * 60;
      
      systolicEstimate += pttFactor;
      diastolicEstimate += pttFactor * 0.6; // Less impact on diastolic
    }
    
    // 2. Amplitude-based adjustment (correlates with pulse pressure)
    if (features.amplitude.medianAmplitude > 0) {
      const amplitudeFactor = features.amplitude.medianAmplitude * 35;
      
      // Amplitude affects systolic more than diastolic
      systolicEstimate += amplitudeFactor * 0.7;
      diastolicEstimate += amplitudeFactor * 0.3;
    }
    
    // 3. Morphology-based adjustments
    if (features.morphology.meanRiseSlope > 0) {
      // Steeper rise correlates with higher systolic
      const slopeFactorSys = Math.pow(features.morphology.meanRiseSlope, 0.7) * 25;
      systolicEstimate += slopeFactorSys;
    }
    
    if (features.morphology.meanDecayRate > 0) {
      // Slower decay correlates with higher diastolic
      const decayFactorDia = (1 / features.morphology.meanDecayRate) * 15;
      diastolicEstimate += decayFactorDia;
    }
    
    // 4. Frequency domain adjustments
    const hfLfFactor = (features.frequency.hfLfRatio - 1) * 10;
    systolicEstimate += hfLfFactor;
    diastolicEstimate += hfLfFactor * 0.5;
    
    // 5. Dicrotic notch timing (correlates with arterial stiffness)
    if (features.dicrotic.meanDicroticTime > 0) {
      // Earlier dicrotic notch indicates higher BP
      const dicroticFactor = (1 - features.dicrotic.meanDicroticTime) * 20;
      systolicEstimate += dicroticFactor;
      diastolicEstimate += dicroticFactor * 0.8;
    }
    
    // 6. Area ratio adjustments (systolic/diastolic area ratio)
    if (features.area.meanAreaRatio > 0) {
      const areaFactor = (features.area.meanAreaRatio - 1.2) * 15;
      systolicEstimate += areaFactor;
      diastolicEstimate += areaFactor * 0.5;
    }
    
    // Apply wide range limits
    systolicEstimate = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolicEstimate));
    diastolicEstimate = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolicEstimate));
    
    // Maintain physiological relationship (systolic > diastolic)
    if (systolicEstimate <= diastolicEstimate) {
      // Ensure minimum difference of 10 mmHg
      diastolicEstimate = systolicEstimate - 10;
    }
    
    // Adapt baseline for future measurements with slow learning
    this.baselineSystolic = this.baselineSystolic * (1 - this.BASELINE_ADAPTATION_RATE) + 
                          systolicEstimate * this.BASELINE_ADAPTATION_RATE;
    this.baselineDiastolic = this.baselineDiastolic * (1 - this.BASELINE_ADAPTATION_RATE) + 
                           diastolicEstimate * this.BASELINE_ADAPTATION_RATE;
    
    return {
      systolic: Math.round(systolicEstimate),
      diastolic: Math.round(diastolicEstimate)
    };
  }
  
  /**
   * Update BP buffers with new estimates
   */
  private updateBPBuffers(systolic: number, diastolic: number): void {
    // Only add valid readings
    if (systolic > this.MIN_SYSTOLIC && diastolic > this.MIN_DIASTOLIC) {
      this.systolicBuffer.push(systolic);
      this.diastolicBuffer.push(diastolic);
      
      // Trim buffers
      if (this.systolicBuffer.length > this.FINAL_BP_BUFFER_SIZE) {
        this.systolicBuffer.shift();
        this.diastolicBuffer.shift();
      }
    }
  }
  
  /**
   * Calculate current best BP estimate
   */
  private calculateCurrentEstimate(): {
    systolic: number;
    diastolic: number;
  } {
    if (this.systolicBuffer.length === 0) {
      return {
        systolic: 0,
        diastolic: 0
      };
    }
    
    // Use median for stability
    const medianSys = this.calculateMedian(this.systolicBuffer);
    const medianDia = this.calculateMedian(this.diastolicBuffer);
    
    // If we have enough measurements, combine with weighted average
    if (this.systolicBuffer.length >= 5) {
      const recentSys = this.systolicBuffer.slice(-5);
      const recentDia = this.diastolicBuffer.slice(-5);
      
      let weightedSumSys = 0;
      let weightedSumDia = 0;
      let weightSum = 0;
      
      for (let i = 0; i < recentSys.length; i++) {
        const weight = Math.pow(1.2, i);
        weightedSumSys += recentSys[i] * weight;
        weightedSumDia += recentDia[i] * weight;
        weightSum += weight;
      }
      
      const weightedSys = weightSum > 0 ? weightedSumSys / weightSum : medianSys;
      const weightedDia = weightSum > 0 ? weightedSumDia / weightSum : medianDia;
      
      // Combine methods with continuous weighting
      const finalSys = Math.round(medianSys * this.CONTINUOUS_WEIGHT + weightedSys * (1 - this.CONTINUOUS_WEIGHT));
      const finalDia = Math.round(medianDia * this.CONTINUOUS_WEIGHT + weightedDia * (1 - this.CONTINUOUS_WEIGHT));
      
      return {
        systolic: finalSys,
        diastolic: finalDia
      };
    }
    
    // Not enough measurements yet, use median only
    return {
      systolic: medianSys,
      diastolic: medianDia
    };
  }
  
  /**
   * Get current BP estimate
   */
  private getCurrentEstimate(): {
    systolic: number;
    diastolic: number;
  } {
    if (this.measurementCompleted) {
      return {
        systolic: this.finalSystolic,
        diastolic: this.finalDiastolic
      };
    }
    
    if (this.systolicBuffer.length === 0) {
      return {
        systolic: 0,
        diastolic: 0
      };
    }
    
    return this.calculateCurrentEstimate();
  }
  
  /**
   * Calculate median of an array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    } else {
      return sorted[middle];
    }
  }
}
