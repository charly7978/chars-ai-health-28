
/**
 * Calculates the AC component (peak-to-peak amplitude) of a signal
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calculates the DC component (average value) of a signal
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculates the standard deviation of a set of values
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(avgSqDiff);
}

/**
 * Finds peaks and valleys in a signal
 */
export function findPeaksAndValleys(values: number[], sensitivity: number = 2) {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  for (let i = sensitivity; i < values.length - sensitivity; i++) {
    const v = values[i];
    let isPeak = true;
    let isValley = true;
    
    // Check if this is a peak
    for (let j = 1; j <= sensitivity; j++) {
      if (v <= values[i - j] || v <= values[i + j]) {
        isPeak = false;
        break;
      }
    }
    
    // Check if this is a valley
    for (let j = 1; j <= sensitivity; j++) {
      if (v >= values[i - j] || v >= values[i + j]) {
        isValley = false;
        break;
      }
    }
    
    if (isPeak) {
      peakIndices.push(i);
    }
    if (isValley) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calculates the amplitude between peaks and valleys
 */
export function calculateAmplitude(
  values: number[],
  peaks: number[],
  valleys: number[]
): number {
  if (peaks.length === 0 || valleys.length === 0) return 0;

  const amps: number[] = [];
  const len = Math.min(peaks.length, valleys.length);
  for (let i = 0; i < len; i++) {
    const amp = values[peaks[i]] - values[valleys[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  if (amps.length === 0) return 0;

  const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
  return mean;
}

/**
 * Calculates the perfusion index of a PPG signal
 * @param values Array of PPG signal values
 * @returns Perfusion index as a percentage
 */
export function calculatePerfusionIndex(values: number[]): number {
  if (values.length < 10) return 0;
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  if (dc === 0) return 0;
  
  // PI is typically expressed as a percentage (AC/DC * 100)
  const perfusionIndex = (ac / Math.abs(dc)) * 100;
  
  return Math.min(20, perfusionIndex); // Cap at 20% which is excellent perfusion
}

/**
 * Calculates the median of an array of values
 * @param values Array of numeric values
 * @returns Median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculates weighted average with more weight to recent values
 * @param values Array of values to average
 * @param weightBase Base for exponential weighting (>1 gives more weight to recent values)
 * @returns Weighted average
 */
export function calculateWeightedAverage(values: number[], weightBase: number = 1.3): number {
  if (values.length === 0) return 0;
  
  let sum = 0;
  let weightSum = 0;
  
  // Apply exponential weights (more weight to recent values)
  for (let i = 0; i < values.length; i++) {
    const weight = Math.pow(weightBase, i);
    sum += values[values.length - 1 - i] * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? sum / weightSum : 0;
}
