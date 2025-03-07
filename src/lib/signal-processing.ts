/**
 * Biblioteca de procesamiento de señales para análisis de PPG y ECG
 * Incluye funciones para filtrado, detección de picos y análisis de variabilidad
 */

/**
 * Elimina la tendencia de una señal utilizando un filtro de media móvil
 * @param signal Array de valores de la señal
 * @param windowSize Tamaño de la ventana para el filtro de media móvil
 * @returns Array de la señal sin tendencia
 */
export function detrend(signal: number[], windowSize: number = 25): number[] {
  if (signal.length < windowSize) {
    return [...signal]; // Devolver copia si la señal es muy corta
  }

  const result: number[] = [];
  
  // Calcular la media móvil para cada punto
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Determinar los límites de la ventana
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(signal.length - 1, i + Math.floor(windowSize / 2));
    
    // Calcular la media en la ventana
    for (let j = start; j <= end; j++) {
      sum += signal[j];
      count++;
    }
    
    const mean = sum / count;
    
    // Restar la media para eliminar la tendencia
    result.push(signal[i] - mean);
  }
  
  return result;
}

/**
 * Aplica un filtro paso banda a la señal
 * @param signal Array de valores de la señal
 * @param sampleRate Frecuencia de muestreo en Hz
 * @param lowCutoff Frecuencia de corte inferior en Hz
 * @param highCutoff Frecuencia de corte superior en Hz
 * @returns Array de la señal filtrada
 */
export function filterSignal(
  signal: number[], 
  sampleRate: number = 30, 
  lowCutoff: number = 0.5, 
  highCutoff: number = 8
): number[] {
  // Implementación simplificada de un filtro IIR de segundo orden
  if (signal.length < 3) return [...signal];
  
  const filtered: number[] = [signal[0], signal[1]];
  
  // Coeficientes del filtro (simplificados)
  const alpha = 0.95; // Factor de suavizado
  
  // Aplicar filtro
  for (let i = 2; i < signal.length; i++) {
    // Filtro paso bajo simple
    const lowPass = alpha * filtered[i-1] + (1 - alpha) * signal[i];
    
    // Filtro paso alto simple (diferencia con señal original)
    const highPass = signal[i] - lowPass + 0.95 * filtered[i-1];
    
    filtered.push(highPass);
  }
  
  return filtered;
}

/**
 * Encuentra picos en una señal
 * @param signal Array de valores de la señal
 * @param threshold Umbral para considerar un punto como pico
 * @param minDistance Distancia mínima entre picos
 * @returns Array de índices donde se encuentran los picos
 */
export function findPeaks(
  signal: number[], 
  threshold: number = 0.5, 
  minDistance: number = 10
): number[] {
  const peaks: number[] = [];
  
  if (signal.length < 3) return peaks;
  
  // Encontrar máximos locales
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i-1] && signal[i] > signal[i+1] && signal[i] > threshold) {
      // Verificar si es un pico válido (mayor que el umbral)
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
        // Si hay un pico más alto dentro de la distancia mínima, reemplazar el anterior
        peaks[peaks.length - 1] = i;
      }
    }
  }
  
  return peaks;
}

/**
 * Calcula la raíz cuadrada de la media de las diferencias al cuadrado (RMSSD)
 * de los intervalos RR, una medida importante de la variabilidad del ritmo cardíaco
 * @param rrIntervals Array de intervalos RR en milisegundos
 * @returns Valor RMSSD
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  let validIntervals = 0;
  
  // Calcular las diferencias al cuadrado
  for (let i = 1; i < rrIntervals.length; i++) {
    // Verificar que los intervalos sean válidos
    if (rrIntervals[i] > 0 && rrIntervals[i-1] > 0) {
      const diff = rrIntervals[i] - rrIntervals[i-1];
      sumSquaredDiff += diff * diff;
      validIntervals++;
    }
  }
  
  // Si no hay suficientes intervalos válidos, retornar 0
  if (validIntervals === 0) return 0;
  
  // Calcular la raíz cuadrada de la media
  return Math.sqrt(sumSquaredDiff / validIntervals);
}

/**
 * Calcula la mediana de un array de números
 * @param values Array de valores numéricos
 * @returns Valor mediano
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Ordenar los valores
  const sorted = [...values].sort((a, b) => a - b);
  
  // Calcular la mediana
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    // Si hay un número par de elementos, promediar los dos del medio
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    // Si hay un número impar de elementos, tomar el del medio
    return sorted[middle];
  }
} 