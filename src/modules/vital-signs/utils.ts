export const applyTimeBasedProcessing = (
  readings: number[], 
  elapsedTime: number,
  targetTime: number
): number => {
  if (readings.length < 5) return 0;
  
  // Ordenar los valores para calcular la mediana
  const sortedReadings = [...readings].sort((a, b) => a - b);
  const mid = Math.floor(sortedReadings.length / 2);
  const median = sortedReadings.length % 2 === 0
    ? (sortedReadings[mid - 1] + sortedReadings[mid]) / 2
    : sortedReadings[mid];
    
  // Calcular la media ponderada de los últimos 5 valores (mayor peso a los más recientes)
  const lastReadings = readings.slice(-5);
  const weightedSum = lastReadings.reduce((sum, reading, index) => {
    const weight = (index + 1) / lastReadings.length;
    return sum + (reading * weight);
  }, 0);
  const weightedAverage = weightedSum / ((lastReadings.length + 1) / 2);
  
  // Si ha alcanzado o superado el tiempo objetivo (29s) se aplica la fusión avanzada:
  // Se retorna la media aritmética entre la mediana y el promedio ponderado.
  if (elapsedTime >= targetTime) {
    return Math.round((median + weightedAverage) / 2);
  }
  
  // De lo contrario, se mezcla progresivamente en función del tiempo transcurrido
  const timeWeight = Math.min(1, elapsedTime / targetTime);
  return Math.round(median * (1 - timeWeight) + weightedAverage * timeWeight);
};

export const calculateAC = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // AC component is the variation in the signal
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max - min;
};

export const calculateDC = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // DC component is the average value of the signal
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

export const calculateAmplitude = (
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number => {
  if (peakIndices.length === 0 || valleyIndices.length === 0) return 0;
  
  const peaks = peakIndices.map(idx => values[idx]);
  const valleys = valleyIndices.map(idx => values[idx]);
  
  const avgPeak = peaks.reduce((sum, val) => sum + val, 0) / peaks.length;
  const avgValley = valleys.reduce((sum, val) => sum + val, 0) / valleys.length;
  
  return avgPeak - avgValley;
};

export const findPeaksAndValleys = (
  values: number[],
  minDistance: number = 3
): { peakIndices: number[], valleyIndices: number[] } => {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  // Simple peaks and valleys detection
  for (let i = minDistance; i < values.length - minDistance; i++) {
    // Check for peaks
    let isPeak = true;
    for (let j = i - minDistance; j <= i + minDistance; j++) {
      if (j !== i && values[j] >= values[i]) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak) {
      peakIndices.push(i);
      continue; // Skip valley check for this point
    }
    
    // Check for valleys
    let isValley = true;
    for (let j = i - minDistance; j <= i + minDistance; j++) {
      if (j !== i && values[j] <= values[i]) {
        isValley = false;
        break;
      }
    }
    
    if (isValley) {
      valleyIndices.push(i);
    }
  }
  
  return { peakIndices, valleyIndices };
};

export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
};

export const calculatePerfusionIndex = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  return dc !== 0 ? ac / dc : 0;
};

export const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  return sorted[mid];
};

export const calculateWeightedAverage = (
  values: number[],
  exponent: number = 1.0
): number => {
  if (values.length === 0) return 0;
  
  let sum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < values.length; i++) {
    // Exponential weighting puts more emphasis on later values
    const weight = Math.pow((i + 1) / values.length, exponent);
    sum += values[i] * weight;
    weightSum += weight;
  }
  
  return sum / weightSum;
};

export const removeOutliers = (values: number[]): number[] => {
  if (values.length < 4) return [...values];
  
  const sorted = [...values].sort((a, b) => a - b);
  
  // Calculate quartiles and IQR
  const q1Index = Math.floor(sorted.length / 4);
  const q3Index = Math.floor(3 * sorted.length / 4);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Define bounds
  const lowerBound = q1 - (1.5 * iqr);
  const upperBound = q3 + (1.5 * iqr);
  
  // Filter outliers
  return values.filter(val => val >= lowerBound && val <= upperBound);
};

export const applyHampelFilter = (
  values: number[],
  windowSize: number = 5,
  threshold: number = 3
): number[] => {
  if (values.length < windowSize) return [...values];
  
  const result = [...values];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    const windowStart = Math.max(0, i - halfWindow);
    const windowEnd = Math.min(values.length - 1, i + halfWindow);
    const window = values.slice(windowStart, windowEnd + 1);
    
    const median = calculateMedian(window);
    const deviations = window.map(val => Math.abs(val - median));
    const mad = calculateMedian(deviations); // Median Absolute Deviation
    
    // Check if the point is an outlier
    if (Math.abs(values[i] - median) > threshold * mad && mad > 0) {
      result[i] = median; // Replace outlier with median
    }
  }
  
  return result;
};

export const applySavitzkyGolayFilter = (
  values: number[],
  windowSize: number = 9
): number[] => {
  if (values.length < windowSize) return [...values];
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  // Simple coefficients for quadratic SG filter
  let coefficients: number[];
  
  if (windowSize === 5) {
    coefficients = [-3, 12, 17, 12, -3];
    const norm = 35;
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const index = i + j;
        if (index >= 0 && index < values.length) {
          const coef = coefficients[j + halfWindow];
          sum += values[index] * coef;
        } else {
          // Edge handling - mirror values
          const mirrorIndex = index < 0 ? -index : 2 * values.length - index - 2;
          if (mirrorIndex >= 0 && mirrorIndex < values.length) {
            const coef = coefficients[j + halfWindow];
            sum += values[mirrorIndex] * coef;
          }
        }
      }
      
      result.push(sum / norm);
    }
  } else if (windowSize === 7) {
    coefficients = [-2, 3, 6, 7, 6, 3, -2];
    const norm = 21;
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const index = i + j;
        if (index >= 0 && index < values.length) {
          const coef = coefficients[j + halfWindow];
          sum += values[index] * coef;
        } else {
          const mirrorIndex = index < 0 ? -index : 2 * values.length - index - 2;
          if (mirrorIndex >= 0 && mirrorIndex < values.length) {
            const coef = coefficients[j + halfWindow];
            sum += values[mirrorIndex] * coef;
          }
        }
      }
      
      result.push(sum / norm);
    }
  } else if (windowSize === 9) {
    coefficients = [-21, 14, 39, 54, 59, 54, 39, 14, -21];
    const norm = 231;
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const index = i + j;
        if (index >= 0 && index < values.length) {
          const coef = coefficients[j + halfWindow];
          sum += values[index] * coef;
        } else {
          const mirrorIndex = index < 0 ? -index : 2 * values.length - index - 2;
          if (mirrorIndex >= 0 && mirrorIndex < values.length) {
            const coef = coefficients[j + halfWindow];
            sum += values[mirrorIndex] * coef;
          }
        }
      }
      
      result.push(sum / norm);
    }
  } else {
    // Default simple moving average for unsupported window sizes
    for (let i = 0; i < values.length; i++) {
      const windowStart = Math.max(0, i - halfWindow);
      const windowEnd = Math.min(values.length - 1, i + halfWindow);
      const window = values.slice(windowStart, windowEnd + 1);
      const average = window.reduce((sum, val) => sum + val, 0) / window.length;
      
      result.push(average);
    }
  }
  
  return result;
};
