import { calculateSlope, calculateAreaUnderCurve } from './utils';

interface BloodPressureResult {
  systolic: number;
  diastolic: number;
}

export class BloodPressureProcessor {
  private readonly MEDIAN_WINDOW_SIZE = 5;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private weightedBuffer: {systolic: number, diastolic: number, quality: number}[] = [];
  private processingTimer: ReturnType<typeof setTimeout> | null = null;
  private processingInProgress = false;
  private processingResult: BloodPressureResult = { systolic: 0, diastolic: 0 };
  private measurementCompleted = false;
  private readonly WEIGHTED_AVERAGE_WINDOW = 5;

  constructor() {
    this.reset();
  }

  public calculateBloodPressure(ppgValues: number[]): BloodPressureResult {
    // Si la medición ya completó su procesamiento final, devolver ese resultado
    if (this.measurementCompleted && this.processingResult.systolic > 0) {
      return this.processingResult;
    }

    if (ppgValues.length < 50) {
      return this.processingResult.systolic > 0 ? this.processingResult : { systolic: 0, diastolic: 0 };
    }

    // Calculate signal quality for weighting
    const signalQuality = this.calculateSignalQuality(ppgValues);

    // Calculate baseline features from PPG signal
    const features = this.extractFeatures(ppgValues);
    
    // Apply hemodynamic model to estimate blood pressure
    const rawBp = this.estimateBloodPressure(features);
    
    // Add to median buffer for real-time display (used during measurement)
    this.addToMedianBuffer(Math.round(rawBp.systolic), Math.round(rawBp.diastolic));
    
    // Add to weighted buffer for final calculation
    this.addToWeightedBuffer(rawBp.systolic, rawBp.diastolic, signalQuality);
    
    // Schedule delayed processing if not already in progress
    if (!this.processingInProgress && this.weightedBuffer.length >= 3) {
      this.startDelayedProcessing();
    }
    
    // During measurement, return median values for more dynamic display
    const medianResult = {
      systolic: this.calculateMedian(this.systolicBuffer),
      diastolic: this.calculateMedian(this.diastolicBuffer)
    };
    
    // Return processed results if available, otherwise median
    return this.processingResult.systolic > 0 ? this.processingResult : medianResult;
  }

  /**
   * Marks the measurement as completed to apply final processing
   */
  public completeMeasurement(): BloodPressureResult {
    if (this.processingInProgress) {
      // If already processing, wait for result
      return this.processingResult.systolic > 0 
        ? this.processingResult 
        : { systolic: this.calculateMedian(this.systolicBuffer), diastolic: this.calculateMedian(this.diastolicBuffer) };
    }
    
    console.log("BloodPressure: Completing measurement, starting final processing");
    this.processingInProgress = true;
    
    // Calculate weighted average for final value
    const weightedSystolic = this.calculateWeightedAverage(this.weightedBuffer.map(item => 
      ({ value: item.systolic, quality: item.quality })));
    
    const weightedDiastolic = this.calculateWeightedAverage(this.weightedBuffer.map(item => 
      ({ value: item.diastolic, quality: item.quality })));
    
    // Calculate median values
    const medianSystolic = this.calculateMedian(this.systolicBuffer);
    const medianDiastolic = this.calculateMedian(this.diastolicBuffer);
    
    // Combine both with bias toward the weighted average for final value
    const finalSystolic = Math.round(medianSystolic * 0.35 + weightedSystolic * 0.65);
    const finalDiastolic = Math.round(medianDiastolic * 0.35 + weightedDiastolic * 0.65);
    
    console.log("BloodPressure: Final processing complete", {
      medianValues: { systolic: medianSystolic, diastolic: medianDiastolic },
      weightedValues: { systolic: weightedSystolic, diastolic: weightedDiastolic },
      finalValues: { systolic: finalSystolic, diastolic: finalDiastolic },
      samples: this.weightedBuffer.length
    });
    
    this.processingResult = { 
      systolic: finalSystolic || 0, 
      diastolic: finalDiastolic || 0 
    };
    
    this.measurementCompleted = true;
    this.processingInProgress = false;
    
    return this.processingResult;
  }

  /**
   * Start delayed processing with a 2-second timer
   */
  private startDelayedProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    this.processingInProgress = true;
    
    // Schedule processing with 2-second delay
    this.processingTimer = setTimeout(() => {
      console.log("BloodPressure: Starting intermediate processing", {
        bufferSize: this.weightedBuffer.length,
        medianBufferSizes: {
          systolic: this.systolicBuffer.length,
          diastolic: this.diastolicBuffer.length
        }
      });
      
      // Durante la medición, solo aplicamos la mediana para valores más dinámicos
      const medianSystolic = this.calculateMedian(this.systolicBuffer);
      const medianDiastolic = this.calculateMedian(this.diastolicBuffer);
      
      // Apply simple weighting for intermediate results to smooth values
      const recentBuffer = this.weightedBuffer.slice(-3);
      const recentSystolicAvg = recentBuffer.length > 0 ? 
        recentBuffer.reduce((sum, item) => sum + item.systolic, 0) / recentBuffer.length : 0;
      const recentDiastolicAvg = recentBuffer.length > 0 ? 
        recentBuffer.reduce((sum, item) => sum + item.diastolic, 0) / recentBuffer.length : 0;
        
      // Combine median and recent average (70% median, 30% recent average)
      const intermediateSystolic = Math.round(medianSystolic * 0.7 + recentSystolicAvg * 0.3);
      const intermediateDiastolic = Math.round(medianDiastolic * 0.7 + recentDiastolicAvg * 0.3);
      
      console.log("BloodPressure: Intermediate processing complete", {
        medianValues: { systolic: medianSystolic, diastolic: medianDiastolic },
        recentAverage: { systolic: recentSystolicAvg, diastolic: recentDiastolicAvg },
        finalValues: { systolic: intermediateSystolic, diastolic: intermediateDiastolic }
      });
      
      this.processingResult = { 
        systolic: intermediateSystolic || 0, 
        diastolic: intermediateDiastolic || 0 
      };
      
      this.processingInProgress = false;
    }, 2000); // 2 second delay
  }

  private calculateSignalQuality(ppgValues: number[]): number {
    if (ppgValues.length < 30) return 0.5;
    
    // Calculate signal-to-noise ratio and stability metrics
    const mean = ppgValues.reduce((sum, val) => sum + val, 0) / ppgValues.length;
    if (mean === 0) return 0.5;
    
    // Calculate standard deviation as a noise measure
    const stdDev = Math.sqrt(
      ppgValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / ppgValues.length
    );
    const cv = stdDev / Math.abs(mean);
    
    // Calculate baseline stability using segments
    const segments = 4;
    const segmentSize = Math.floor(ppgValues.length / segments);
    const segmentMeans = [];
    
    for (let i = 0; i < segments; i++) {
      const segment = ppgValues.slice(i * segmentSize, (i + 1) * segmentSize);
      segmentMeans.push(segment.reduce((a, b) => a + b, 0) / segment.length);
    }
    
    const baselineStability = 1 - Math.min(1, Math.max(...segmentMeans) - Math.min(...segmentMeans)) / mean;
    
    // Combined quality score weighted toward stability
    const quality = Math.max(0, Math.min(1, 
      (1 - Math.min(cv, 0.5) * 2) * 0.5 +  // Lower CV = better quality
      baselineStability * 0.5              // Higher stability = better quality
    ));
    
    return quality;
  }

  private extractFeatures(ppgValues: number[]): any {
    // Find peaks and valleys for waveform analysis
    const peaks = this.findPeaks(ppgValues);
    const valleys = this.findValleys(ppgValues);
    
    if (peaks.length < 2 || valleys.length < 2) {
      return {
        pulseTransitTime: 0,
        augmentationIndex: 0,
        systolicAmplitude: 0,
        diastolicAmplitude: 0,
        areaRatio: 0,
        dicroticNotchPosition: 0
      };
    }
    
    // Calculate pulse transit time (PTT) - inversely related to BP
    const peakIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      peakIntervals.push(peaks[i] - peaks[i-1]);
    }
    const avgPeakInterval = peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length;
    
    // Calculate amplitudes - related to pulse pressure
    const peakAmplitudes = [];
    const notchPositions = [];
    const areaRatios = [];
    
    for (let i = 0; i < peaks.length - 1; i++) {
      // Find valley between peaks
      let valleyIdx = -1;
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] > peaks[i] && valleys[j] < peaks[i+1]) {
          valleyIdx = valleys[j];
          break;
        }
      }
      
      if (valleyIdx !== -1) {
        // Systolic amplitude (peak to preceding valley)
        let precedingValleyIdx = -1;
        for (let j = valleys.length - 1; j >= 0; j--) {
          if (valleys[j] < peaks[i]) {
            precedingValleyIdx = valleys[j];
            break;
          }
        }
        
        if (precedingValleyIdx !== -1) {
          peakAmplitudes.push(ppgValues[peaks[i]] - ppgValues[precedingValleyIdx]);
          
          // Find dicrotic notch using second derivative
          const segmentStart = peaks[i];
          const segmentEnd = valleyIdx;
          
          if (segmentEnd - segmentStart > 5) {
            const segment = ppgValues.slice(segmentStart, segmentEnd);
            const firstDerivative = [];
            
            for (let j = 1; j < segment.length; j++) {
              firstDerivative.push(segment[j] - segment[j-1]);
            }
            
            const secondDerivative = [];
            for (let j = 1; j < firstDerivative.length; j++) {
              secondDerivative.push(firstDerivative[j] - firstDerivative[j-1]);
            }
            
            // Find where second derivative crosses zero (inflection point)
            let notchIdx = -1;
            for (let j = 0; j < secondDerivative.length - 1; j++) {
              if ((secondDerivative[j] < 0 && secondDerivative[j+1] >= 0) ||
                  (secondDerivative[j] <= 0 && secondDerivative[j+1] > 0)) {
                notchIdx = j + segmentStart;
                break;
              }
            }
            
            if (notchIdx !== -1) {
              // Calculate notch position relative to peak
              const relativePosition = (notchIdx - segmentStart) / (segmentEnd - segmentStart);
              notchPositions.push(relativePosition);
              
              // Calculate areas for augmentation index
              const areaBeforeNotch = calculateAreaUnderCurve(ppgValues, segmentStart, notchIdx);
              const areaAfterNotch = calculateAreaUnderCurve(ppgValues, notchIdx, segmentEnd);
              
              if (areaBeforeNotch > 0) {
                areaRatios.push(areaAfterNotch / areaBeforeNotch);
              }
            }
          }
        }
      }
    }
    
    // Calculate average values
    const avgPeakAmplitude = peakAmplitudes.length > 0 ? 
      peakAmplitudes.reduce((a, b) => a + b, 0) / peakAmplitudes.length : 0;
    
    const avgNotchPosition = notchPositions.length > 0 ?
      notchPositions.reduce((a, b) => a + b, 0) / notchPositions.length : 0;
    
    const avgAreaRatio = areaRatios.length > 0 ?
      areaRatios.reduce((a, b) => a + b, 0) / areaRatios.length : 0;
    
    return {
      pulseTransitTime: avgPeakInterval,
      systolicAmplitude: avgPeakAmplitude,
      dicroticNotchPosition: avgNotchPosition,
      areaRatio: avgAreaRatio
    };
  }

  private estimateBloodPressure(features: any): { systolic: number, diastolic: number } {
    // Base values (population average)
    let systolicEstimate = 120;
    let diastolicEstimate = 80;
    
    // Apply PTT-based adjustment (shorter PTT = higher BP)
    // Using the non-linear relationship from Poon & Zhang study
    if (features.pulseTransitTime > 0) {
      const normalizedPTT = Math.min(1.5, Math.max(0.5, features.pulseTransitTime / 25));
      const pttFactor = Math.pow(1 / normalizedPTT, 1.3);
      
      // PTT has stronger effect on systolic pressure
      systolicEstimate = systolicEstimate * pttFactor * 0.85;
      diastolicEstimate = diastolicEstimate * pttFactor * 0.7;
    }
    
    // Apply amplitude-based adjustments
    if (features.systolicAmplitude > 0) {
      const amplitudeImpact = (features.systolicAmplitude - 0.5) * 20;
      const pulseWidth = systolicEstimate - diastolicEstimate;
      
      systolicEstimate += amplitudeImpact;
      diastolicEstimate = systolicEstimate - (pulseWidth * (1 + (amplitudeImpact / 100)));
    }
    
    // Apply dicrotic notch position adjustment
    // Earlier notch = higher arterial stiffness = higher BP
    if (features.dicroticNotchPosition > 0) {
      const stiffnessImpact = (0.5 - features.dicroticNotchPosition) * 25;
      systolicEstimate += stiffnessImpact * 0.7;
      diastolicEstimate += stiffnessImpact * 0.3;
    }
    
    // Apply area ratio adjustment
    if (features.areaRatio > 0) {
      const areaImpact = (features.areaRatio - 0.7) * 15;
      systolicEstimate += areaImpact;
      diastolicEstimate += areaImpact * 0.5;
    }
    
    // Ensure physiological relationships are maintained
    if (diastolicEstimate > systolicEstimate - 10) {
      diastolicEstimate = systolicEstimate - 10;
    }
    
    if (diastolicEstimate < 10) diastolicEstimate = 10;
    if (systolicEstimate < 40) systolicEstimate = 40;
    if (systolicEstimate > 350) systolicEstimate = 350;
    if (diastolicEstimate > 250) diastolicEstimate = 250;
    
    return {
      systolic: systolicEstimate,
      diastolic: diastolicEstimate
    };
  }

  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const minDistance = 10;
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] > signal[i-1] && 
          signal[i] > signal[i-2] &&
          signal[i] > signal[i+1] && 
          signal[i] > signal[i+2]) {
        
        // Check minimum distance from last peak
        const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : -minDistance;
        if (i - lastPeak >= minDistance) {
          peaks.push(i);
        } else if (signal[i] > signal[lastPeak]) {
          // Replace previous peak if current is higher
          peaks[peaks.length - 1] = i;
        }
      }
    }
    
    return peaks;
  }

  private findValleys(signal: number[]): number[] {
    const valleys: number[] = [];
    const minDistance = 10;
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] < signal[i-1] && 
          signal[i] < signal[i-2] &&
          signal[i] < signal[i+1] && 
          signal[i] < signal[i+2]) {
        
        // Check minimum distance from last valley
        const lastValley = valleys.length > 0 ? valleys[valleys.length - 1] : -minDistance;
        if (i - lastValley >= minDistance) {
          valleys.push(i);
        } else if (signal[i] < signal[lastValley]) {
          // Replace previous valley if current is lower
          valleys[valleys.length - 1] = i;
        }
      }
    }
    
    return valleys;
  }

  private addToMedianBuffer(systolic: number, diastolic: number): void {
    if (systolic > 0) {
      this.systolicBuffer.push(systolic);
      if (this.systolicBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.systolicBuffer.shift();
      }
    }
    
    if (diastolic > 0) {
      this.diastolicBuffer.push(diastolic);
      if (this.diastolicBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.diastolicBuffer.shift();
      }
    }
  }

  private addToWeightedBuffer(systolic: number, diastolic: number, quality: number): void {
    if (systolic <= 0 || diastolic <= 0) return;
    
    this.weightedBuffer.push({ systolic, diastolic, quality });
    if (this.weightedBuffer.length > this.WEIGHTED_AVERAGE_WINDOW) {
      this.weightedBuffer.shift();
    }
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 1) {
      return sorted[mid];
    }
    
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  private calculateWeightedAverage(items: { value: number, quality: number }[]): number {
    if (items.length === 0) return 0;
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const item of items) {
      // Apply exponential weighting to emphasize quality differences
      const weight = Math.pow(item.quality, 2);
      weightedSum += item.value * weight;
      totalWeight += weight;
    }
    
    if (totalWeight === 0) return 0;
    
    return Math.round(weightedSum / totalWeight);
  }

  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.weightedBuffer = [];
    this.processingResult = { systolic: 0, diastolic: 0 };
    this.processingInProgress = false;
    this.measurementCompleted = false;
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
  }
}

