/**
 * Detector avanzado de apnea del sueño.
 * Utiliza una ventana deslizante de energía de audio para detectar periodos con muy baja actividad acústica,
 * lo cual puede indicar eventos de apnea.
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

  // Procesa un bloque de muestras de audio y actualiza el conteo de eventos de apnea
  public processAudioBlock(audioSamples: number[]): { energy: number; apneaDetected: boolean } {
    // Calcular la energía promedio del bloque
    const energy = audioSamples.reduce((sum, sample) => sum + sample * sample, 0) / audioSamples.length;

    // Actualizar historial (ventana deslizante)
    this.audioHistory.push(energy);
    if (this.audioHistory.length > this.windowSize) {
      this.audioHistory.shift();
    }

    // Detectar apnea: si en la ventana más del 60% de las muestras tienen energía inferior a energyThreshold
    const lowEnergyCount = this.audioHistory.filter(val => val < this.energyThreshold).length;
    const ratio = lowEnergyCount / this.audioHistory.length;
    const apneaDetected = ratio > 0.6;
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
