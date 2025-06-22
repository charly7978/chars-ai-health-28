/**
 * Detector avanzado de conmoción cerebral.
 * Procesa mediciones reales tomadas de la imagen (por ejemplo, área de la pupila) para calcular
 * la variación de la respuesta pupilar. Una variación brusca genera un alto puntaje de conmoción.
 */
export class ConcussionDetector {
  private pupilHistory: number[] = [];
  private historySize: number;

  constructor(historySize = 30) {
    this.historySize = historySize;
  }

  // Procesa el área o diámetro pupilar de la imagen y devuelve un puntaje (0-100)
  public processFrame(pupilMeasurement: number): { concussionScore: number; abnormalResponse: boolean } {
    this.pupilHistory.push(pupilMeasurement);
    if (this.pupilHistory.length > this.historySize) {
      this.pupilHistory.shift();
    }
    // Calcular la media y la varianza de la historia
    const mean = this.pupilHistory.reduce((sum, val) => sum + val, 0) / this.pupilHistory.length;
    const variance = this.pupilHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.pupilHistory.length;

    // Un aumento brusco en la varianza (multiplicado para ajustar escala) indica respuesta anormal
    const concussionScore = Math.min(100, variance * 10);
    const abnormalResponse = concussionScore > 30;
    return { concussionScore, abnormalResponse };
  }

  public reset(): void {
    this.pupilHistory = [];
  }
}
