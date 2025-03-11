
export const applyTimeBasedProcessing = (
  readings: number[], 
  elapsedTime: number,
  targetTime: number
): number => {
  if (readings.length < 5) return 0;
  
  // Sort readings for median calculation
  const sortedReadings = [...readings].sort((a, b) => a - b);
  
  // Calculate median
  const mid = Math.floor(sortedReadings.length / 2);
  const median = sortedReadings.length % 2 === 0
    ? (sortedReadings[mid - 1] + sortedReadings[mid]) / 2
    : sortedReadings[mid];
    
  // Calculate weighted average for last 5 readings
  const lastReadings = readings.slice(-5);
  const weightedSum = lastReadings.reduce((sum, reading, index) => {
    // Higher weight for more recent readings
    const weight = (index + 1) / lastReadings.length;
    return sum + (reading * weight);
  }, 0);
  
  const weightedAverage = weightedSum / ((lastReadings.length + 1) / 2);
  
  // Blend median and weighted average based on time
  const timeWeight = Math.min(1, elapsedTime / targetTime);
  return Math.round(median * (1 - timeWeight) + weightedAverage * timeWeight);
};
