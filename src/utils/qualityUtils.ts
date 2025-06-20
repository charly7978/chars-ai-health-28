// Versión mejorada y unificada de getQualityColor
export const getQualityColor = (quality: number, isFingerDetected = true): string => {
  if (!isFingerDetected) return '#666666';
  if (quality >= 90) return '#00ff00';
  if (quality >= 75) return '#80ff00';
  if (quality >= 60) return '#ccff00';
  if (quality >= 45) return '#ffff00';
  if (quality >= 30) return '#ffcc00';
  if (quality >= 15) return '#ff6600';
  return '#ff0000';
};

export const getQualityText = (quality: number, isFingerDetected = true): string => {
  if (!isFingerDetected) return 'Sin señal';
  if (quality >= 90) return 'Excelente';
  if (quality >= 75) return 'Muy buena';
  if (quality >= 60) return 'Buena';
  if (quality >= 45) return 'Aceptable';
  if (quality >= 30) return 'Regular';
  if (quality >= 15) return 'Débil';
  return 'Muy débil';
};
