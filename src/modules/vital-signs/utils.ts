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
