
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
