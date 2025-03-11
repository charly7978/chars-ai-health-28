
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
export function findPeaksAndValleys(values: number[]) {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    if (
      v < values[i - 1] &&
      v < values[i - 2] &&
      v < values[i + 1] &&
      v < values[i + 2]
    ) {
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
 * Applies time-based processing to a series of measurements
 * @param values Array of measurement values
 * @param currentTime Current elapsed time
 * @param targetTime Target time for processing (e.g., 29 seconds)
 * @returns Processed value
 */
export function applyTimeBasedProcessing(
  values: number[],
  currentTime: number,
  targetTime: number
): number {
  if (values.length < 3) return 0;
  
  // Only apply special processing near target time
  if (Math.abs(currentTime - targetTime) > 1) {
    return values[values.length - 1]; // Return most recent value
  }
  
  // Apply weighted average with more weight on recent values
  const weights = values.map((_, i) => i + 1); // Increasing weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  const weightedSum = values.reduce((sum, val, i) => {
    return sum + (val * weights[i]);
  }, 0);
  
  return Math.round(weightedSum / totalWeight);
}
