/**
 * Detector avanzado de apnea del sueño.
 * Procesa bloques de muestras de audio para detectar eventos de apnea (baja energía sostenida).
 */
export class ApneaDetector {
  private audioHistory: number[] = [];
  private windowSize: number;
  private energyThreshold: number;
  private apneaEventCount: number;

  constructor(windowSize = 1024, energyThreshold = 0.02) {
    this.windowSize = windowSize;
    this.energyThreshold = energyThreshold;
    this.apneaEventCount = 0;
  }

  // Procesa un bloque de audio y retorna true si se detecta apnea
  public processAudioBlock(audioSamples: number[]): { energy: number; apneaDetected: boolean } {
    const energy = audioSamples.reduce((sum, sample) => sum + sample * sample, 0) / audioSamples.length;
    this.audioHistory.push(energy);
    if (this.audioHistory.length > this.windowSize) {
      this.audioHistory.shift();
    }
    const lowEnergyCount = this.audioHistory.filter(val => val < this.energyThreshold).length;
    const ratio = lowEnergyCount / this.audioHistory.length;
    const apneaDetected = ratio > 0.6; // Se detecta apnea si el 60% de la ventana tiene baja energía
    if (apneaDetected) {
      this.apneaEventCount++;
    }
    return { energy, apneaDetected };
  }

  public getApneaEventCount(): number {
    return this.apneaEventCount;
  }

  public reset(): void {
    this.audioHistory = [];
    this.apneaEventCount = 0;
  }
}
