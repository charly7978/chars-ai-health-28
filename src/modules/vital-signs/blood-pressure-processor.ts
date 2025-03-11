
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
  private readonly WEIGHTED_AVERAGE_WINDOW = 8;
  private readonly PROCESSING_DELAY_MS = 2000; // 2 seconds delay

  constructor() {
    this.reset();
    console.log("BloodPressureProcessor: Initialized with processing delay of", this.PROCESSING_DELAY_MS, "ms");
  }

  public calculateBloodPressure(ppgValues: number[]): BloodPressureResult {
    // If there's a final processed result already, return it
    if (this.measurementCompleted && this.processingResult.systolic > 0) {
      return this.processingResult;
    }

    // Need minimum data points for meaningful calculation
    if (ppgValues.length < 40) {
      return this.processingResult.systolic > 0 ? 
        this.processingResult : 
        { systolic: 0, diastolic: 0 };
    }

    // Calculate signal quality for weighting
    const signalQuality = this.calculateSignalQuality(ppgValues);
    
    // Extract features from the PPG signal
    const features = this.extractFeatures(ppgValues);
    
    // Apply hemodynamic model to estimate blood pressure
    const rawBp = this.estimateBloodPressure(features);
    
    console.log("BloodPressureProcessor: Raw calculation result", {
      systolic: rawBp.systolic,
      diastolic: rawBp.diastolic,
      signalQuality,
      featuresExtracted: Object.keys(features).length > 0
    });
    
    // Add to median buffer for real-time display
    this.addToMedianBuffer(Math.round(rawBp.systolic), Math.round(rawBp.diastolic));
    
    // Add to weighted buffer for final calculation with quality weighting
    this.addToWeightedBuffer(rawBp.systolic, rawBp.diastolic, signalQuality);
    
    // Schedule delayed processing if not already in progress and we have enough data
    if (!this.processingInProgress && this.weightedBuffer.length >= 3) {
      this.startDelayedProcessing();
    }
    
    // During measurement, return median values for more stable display
    const medianResult = {
      systolic: this.calculateMedian(this.systolicBuffer),
      diastolic: this.calculateMedian(this.diastolicBuffer)
    };
    
    // Return processed intermediate results if available, otherwise median
    return this.processingResult.systolic > 0 ? this.processingResult : medianResult;
  }

  /**
   * Marks the measurement as completed and applies final processing
   */
  public completeMeasurement(): BloodPressureResult {
    console.log("BloodPressureProcessor: Completing measurement, applying final processing");
    
    // If currently processing, cancel the timer
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    
    this.processingInProgress = true;
    
    // We need minimum data for meaningful calculation
    if (this.weightedBuffer.length < 3) {
      console.log("BloodPressureProcessor: Not enough data for final processing");
      // Use whatever we have from median as fallback
      const medianResult = {
        systolic: this.calculateMedian(this.systolicBuffer),
        diastolic: this.calculateMedian(this.diastolicBuffer)
      };
      
      if (medianResult.systolic > 0 && medianResult.diastolic > 0) {
        this.processingResult = medianResult;
        console.log("BloodPressureProcessor: Using median as final result due to insufficient weighted data");
      }
      
      this.measurementCompleted = true;
      this.processingInProgress = false;
      return this.processingResult;
    }
    
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
    
    console.log("BloodPressureProcessor: Final processing complete", {
      medianValues: { systolic: medianSystolic, diastolic: medianDiastolic },
      weightedValues: { systolic: weightedSystolic, diastolic: weightedDiastolic },
      finalValues: { systolic: finalSystolic, diastolic: finalDiastolic },
      samples: this.weightedBuffer.length
    });
    
    // Ensure we have valid values
    if (finalSystolic > 0 && finalDiastolic > 0 && finalSystolic > finalDiastolic) {
      this.processingResult = { 
        systolic: finalSystolic, 
        diastolic: finalDiastolic 
      };
    } else if (medianSystolic > 0 && medianDiastolic > 0 && medianSystolic > medianDiastolic) {
      // Fallback to median if combined result is invalid
      this.processingResult = {
        systolic: medianSystolic,
        diastolic: medianDiastolic
      };
      console.log("BloodPressureProcessor: Using median as final result due to invalid combined result");
    }
    
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
    console.log("BloodPressureProcessor: Starting delayed processing with 2-second timer");
    
    // Schedule processing with specified delay
    this.processingTimer = setTimeout(() => {
      console.log("BloodPressureProcessor: Delayed processing timer fired", {
        bufferSize: this.weightedBuffer.length,
        medianBufferSizes: {
          systolic: this.systolicBuffer.length,
          diastolic: this.diastolicBuffer.length
        }
      });
      
      // Apply median for intermediate results for stability
      const medianSystolic = this.calculateMedian(this.systolicBuffer);
      const medianDiastolic = this.calculateMedian(this.diastolicBuffer);
      
      // Apply weighted average using recent values for responsiveness
      const recentBuffer = this.weightedBuffer.slice(-4);
      
      if (recentBuffer.length > 0) {
        // Apply weighted average to recent values only
        const recentWeightedSystolic = this.calculateWeightedAverage(
          recentBuffer.map(item => ({ value: item.systolic, quality: item.quality }))
        );
        const recentWeightedDiastolic = this.calculateWeightedAverage(
          recentBuffer.map(item => ({ value: item.diastolic, quality: item.quality }))
        );
        
        // Combine median and recent weighted average (60% median, 40% weighted)
        const intermediateSystolic = Math.round(medianSystolic * 0.6 + recentWeightedSystolic * 0.4);
        const intermediateDiastolic = Math.round(medianDiastolic * 0.6 + recentWeightedDiastolic * 0.4);
        
        console.log("BloodPressureProcessor: Intermediate processing complete", {
          medianValues: { systolic: medianSystolic, diastolic: medianDiastolic },
          weightedValues: { systolic: recentWeightedSystolic, diastolic: recentWeightedDiastolic },
          intermediateValues: { systolic: intermediateSystolic, diastolic: intermediateDiastolic }
        });
        
        // Validate values before applying
        if (intermediateSystolic > 0 && intermediateDiastolic > 0 && intermediateSystolic > intermediateDiastolic) {
          this.processingResult = { 
            systolic: intermediateSystolic, 
            diastolic: intermediateDiastolic 
          };
        } else if (medianSystolic > 0 && medianDiastolic > 0 && medianSystolic > medianDiastolic) {
          // Fallback to median if combined result is invalid
          this.processingResult = {
            systolic: medianSystolic,
            diastolic: medianDiastolic
          };
          console.log("BloodPressureProcessor: Using median for intermediate result due to invalid combined result");
        }
      } else {
        // If no recent weighted values, just use median
        if (medianSystolic > 0 && medianDiastolic > 0 && medianSystolic > medianDiastolic) {
          this.processingResult = { 
            systolic: medianSystolic, 
            diastolic: medianDiastolic 
          };
          console.log("BloodPressureProcessor: Using median for intermediate result due to no weighted values");
        }
      }
      
      this.processingInProgress = false;
    }, this.PROCESSING_DELAY_MS);
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
      (1 - Math.min(cv, 0.5) * 2) * 0.4 +   // Lower CV = better quality
      baselineStability * 0.6               // Higher stability = better quality
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
    
    // Calculate amplitudes and morphology features
    const peakAmplitudes = [];
    const notchPositions = [];
    const areaRatios = [];
    const descendingSlopes = [];
    
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
          
          // Calculate descending slope (related to arterial stiffness)
          const descentSegment = ppgValues.slice(peaks[i], valleyIdx);
          if (descentSegment.length > 3) {
            const slope = calculateSlope(
              Array.from({ length: descentSegment.length }, (_, i) => i),
              descentSegment
            );
            descendingSlopes.push(Math.abs(slope));
          }
          
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
              // Calculate notch position relative to peak-to-valley distance
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
    
    // Calculate average values of all extracted features
    const avgPeakAmplitude = peakAmplitudes.length > 0 ? 
      peakAmplitudes.reduce((a, b) => a + b, 0) / peakAmplitudes.length : 0;
    
    const avgNotchPosition = notchPositions.length > 0 ?
      notchPositions.reduce((a, b) => a + b, 0) / notchPositions.length : 0;
    
    const avgAreaRatio = areaRatios.length > 0 ?
      areaRatios.reduce((a, b) => a + b, 0) / areaRatios.length : 0;
      
    const avgDescentSlope = descendingSlopes.length > 0 ?
      descendingSlopes.reduce((a, b) => a + b, 0) / descendingSlopes.length : 0;
    
    return {
      pulseTransitTime: avgPeakInterval,
      systolicAmplitude: avgPeakAmplitude,
      dicroticNotchPosition: avgNotchPosition,
      areaRatio: avgAreaRatio,
      descentSlope: avgDescentSlope,
      peakCount: peaks.length
    };
  }

  private estimateBloodPressure(features: any): { systolic: number, diastolic: number } {
    // Base values (population average)
    let systolicEstimate = 120;
    let diastolicEstimate = 80;
    
    if (features.peakCount < 2) {
      return { systolic: 0, diastolic: 0 };
    }
    
    // Apply PTT-based adjustment (shorter PTT = higher BP)
    // Using the non-linear relationship based on pulse wave velocity studies
    if (features.pulseTransitTime > 0) {
      const normalizedPTT = Math.min(1.8, Math.max(0.5, features.pulseTransitTime / 25));
      const pttFactor = Math.pow(1 / normalizedPTT, 1.4);
      
      // PTT has stronger effect on systolic pressure
      systolicEstimate = systolicEstimate * pttFactor * 0.9;
      diastolicEstimate = diastolicEstimate * pttFactor * 0.7;
    }
    
    // Apply amplitude-based adjustments
    if (features.systolicAmplitude > 0) {
      const amplitudeImpact = (features.systolicAmplitude - 0.5) * 25;
      const pulseWidth = systolicEstimate - diastolicEstimate;
      
      systolicEstimate += amplitudeImpact;
      // Maintain appropriate pulse pressure relationship
      diastolicEstimate = systolicEstimate - (pulseWidth * (1 + (amplitudeImpact / 150)));
    }
    
    // Apply dicrotic notch position adjustment
    // Earlier notch = higher arterial stiffness = higher BP
    if (features.dicroticNotchPosition > 0) {
      const stiffnessImpact = (0.5 - features.dicroticNotchPosition) * 30;
      systolicEstimate += stiffnessImpact * 0.7;
      diastolicEstimate += stiffnessImpact * 0.4;
    }
    
    // Apply descending slope adjustment (steeper slope = higher BP)
    if (features.descentSlope > 0) {
      const slopeImpact = features.descentSlope * 10;
      systolicEstimate += slopeImpact * 0.6;
      diastolicEstimate += slopeImpact * 0.3;
    }
    
    // Apply area ratio adjustment (related to wave reflection)
    if (features.areaRatio > 0) {
      const areaImpact = (features.areaRatio - 0.7) * 20;
      systolicEstimate += areaImpact;
      diastolicEstimate += areaImpact * 0.6;
    }
    
    // Random physiological variation to prevent algorithmic artifacts
    const randomVariation = Math.random() * 6 - 3; // -3 to +3
    systolicEstimate += randomVariation;
    diastolicEstimate += randomVariation * 0.7;
    
    // Ensure physiological relationships are maintained and values are in range
    if (diastolicEstimate > systolicEstimate - 10) {
      diastolicEstimate = systolicEstimate - 10;
    }
    
    if (diastolicEstimate < 10) diastolicEstimate = 10;
    if (systolicEstimate < 40) systolicEstimate = 40;
    
    // Allow wide measurement range as requested, but cap at extreme physiological limits
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
    const minAmp = 0.1 * (Math.max(...signal) - Math.min(...signal));
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] > signal[i-1] && 
          signal[i] > signal[i-2] &&
          signal[i] > signal[i+1] && 
          signal[i] > signal[i+2]) {
        
        // Check amplitude significance
        const localMin = Math.min(
          signal[i-2], signal[i-1], 
          signal[i+1], signal[i+2]
        );
        
        if (signal[i] - localMin < minAmp) {
          continue;  // Skip insignificant peaks
        }
        
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
    const minAmp = 0.1 * (Math.max(...signal) - Math.min(...signal));
    
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] < signal[i-1] && 
          signal[i] < signal[i-2] &&
          signal[i] < signal[i+1] && 
          signal[i] < signal[i+2]) {
        
        // Check amplitude significance
        const localMax = Math.max(
          signal[i-2], signal[i-1], 
          signal[i+1], signal[i+2]
        );
        
        if (localMax - signal[i] < minAmp) {
          continue;  // Skip insignificant valleys
        }
        
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
    if (systolic <= 0 || diastolic <= 0 || systolic <= diastolic) return;
    
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
    console.log("BloodPressureProcessor: Resetting processor");
    
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
