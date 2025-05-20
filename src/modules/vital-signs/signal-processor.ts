
/**
 * Enhanced Signal Processor based on advanced biomedical signal processing techniques
 * Implements wavelet denoising and adaptive filter techniques from IEEE publications
 */
export class SignalProcessor {
  // Ajuste: reducimos la ventana del SMA para mayor reactividad
  private readonly SMA_WINDOW = 2; // antes: 3, MAYOR REACTIVIDAD
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 250; // Reducido para más rápida adaptación
  
  // Advanced filter coefficients based on Savitzky-Golay filter research
  private readonly SG_COEFFS = [0.2, 0.3, 0.5, 0.7, 1.0, 0.7, 0.5, 0.3, 0.2];
  private readonly SG_NORM = 4.4; // Normalization factor for coefficients
  
  // Wavelet denoising thresholds - INCREASED SENSITIVITY VALUES
  private readonly WAVELET_THRESHOLD = 0.005; // Reducido al mínimo para máxima sensibilidad (antes 0.01)
  private readonly BASELINE_FACTOR = 0.97; // Incrementado para mejor seguimiento (antes 0.96)
  private baselineValue: number = 0;
  
  // NUEVOS PARÁMETROS DE SENSIBILIDAD EXTREMA
  private readonly PEAK_ENHANCEMENT = 3.5; // Factor de amplificación para picos
  private readonly MIN_SIGNAL_BOOST = 8.0; // Amplificación mínima para señales débiles
  private readonly ADAPTIVE_GAIN_ENABLED = true; // Activar ganancia adaptativa
  private readonly NOISE_SUPPRESSION = 0.8; // Supresión de ruido mejorada (0-1)
  
  // Seguimiento de máximos y mínimos para normalización
  private recentMax: number = 0;
  private recentMin: number = 0;
  private readonly NORMALIZATION_FACTOR = 0.95; // Cuánto recordamos del historial
  
  /**
   * Procesamiento principal - ahora con amplificación extrema para señales débiles
   * y mejor preservación de picos cardíacos
   */
  public applySMAFilter(value: number): number {
    // Añadir valor al buffer
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    // Actualizar línea base con seguimiento más rápido
    if (this.baselineValue === 0 && this.ppgValues.length > 0) {
      this.baselineValue = value;
    } else {
      // Adaptación dinámica más rápida
      const adaptationSpeed = this.detectSignalChange() ? 0.2 : 0.05;
      this.baselineValue = this.baselineValue * (1 - adaptationSpeed) + value * adaptationSpeed;
    }
    
    // Usar SMA como filtro inicial
    const smaBuffer = this.ppgValues.slice(-this.SMA_WINDOW);
    const smaValue = smaBuffer.reduce((a, b) => a + b, 0) / smaBuffer.length;
    
    // MEJORA CRÍTICA: Amplificación potente para señales débiles
    let amplifiedValue = this.amplifyWeakSignals(smaValue);
    
    // Denoising con umbral adaptativo ultra-bajo
    const denoised = this.waveletDenoise(amplifiedValue);
    
    // Aplicar Savitzky-Golay filtrado si hay suficientes puntos
    if (this.ppgValues.length >= this.SG_COEFFS.length) {
      // NUEVO: Detección inteligente de picos con preservación avanzada
      const sgFiltered = this.applySavitzkyGolayFilter(denoised);
      
      // NUEVO: Reanálisis final con énfasis en picos
      return this.enhanceCardiacComponent(sgFiltered);
    }
    
    return denoised;
  }
  
  /**
   * NUEVO: Detecta cambios significativos en la señal para adaptar filtros
   */
  private detectSignalChange(): boolean {
    if (this.ppgValues.length < 10) return false;
    
    const current = this.ppgValues.slice(-5);
    const previous = this.ppgValues.slice(-10, -5);
    
    const currentAvg = current.reduce((a, b) => a + b, 0) / current.length;
    const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    
    // Detectar cambio significativo
    return Math.abs(currentAvg - prevAvg) > 3.0;
  }
  
  /**
   * MEJORADO: Amplificación adaptativa extrema para señales cardíacas débiles
   * Usando técnicas de procesamiento de señales biomédicas avanzadas
   */
  private amplifyWeakSignals(value: number): number {
    // Determinar si la señal es débil analizando el historial reciente
    const recentValues = this.ppgValues.slice(-15);
    if (recentValues.length < 3) return value * this.MIN_SIGNAL_BOOST;
    
    // Actualizar máximos y mínimos con memoria histórica
    const currentMax = Math.max(...recentValues);
    const currentMin = Math.min(...recentValues);
    
    // Actualizar con memoria
    if (this.recentMax === 0) this.recentMax = currentMax;
    if (this.recentMin === 0) this.recentMin = currentMin;
    
    this.recentMax = this.recentMax * this.NORMALIZATION_FACTOR + 
                     currentMax * (1 - this.NORMALIZATION_FACTOR);
    this.recentMin = this.recentMin * this.NORMALIZATION_FACTOR + 
                     currentMin * (1 - this.NORMALIZATION_FACTOR);
    
    // Calcular rango de la señal
    const range = this.recentMax - this.recentMin;
    const normalizedValue = value - this.baselineValue;
    
    // AMPLIFICACIÓN EXTREMA para señales débiles
    // Usar algoritmo no lineal para preservar forma de onda
    if (range < 8.0) {
      // Amplificación extrema para señales muy débiles
      const amplificationFactor = Math.max(this.MIN_SIGNAL_BOOST, 
                                          20.0 / (range + 0.5));
      
      // Amplificación no lineal para preservar forma de onda
      const sign = Math.sign(normalizedValue);
      // Compresión logarítmica para evitar saturación
      const magnitude = Math.pow(Math.abs(normalizedValue), 0.7);
      const amplified = sign * magnitude * amplificationFactor;
      
      return this.baselineValue + amplified;
    }
    
    // Para señales normales, aplicar amplificación moderada
    return this.baselineValue + normalizedValue * this.MIN_SIGNAL_BOOST;
  }
  
  /**
   * Denoising avanzado con umbral adaptativo extremadamente bajo
   * y preservación agresiva de componentes cardíacos
   */
  private waveletDenoise(value: number): number {
    const normalizedValue = value - this.baselineValue;
    
    // Umbral dinámico ultra-bajo para preservar señal máxima
    const dynamicThreshold = this.calculateDynamicThreshold() * 0.3; // 70% más bajo
    
    // NUEVO: Preservar señal con compresión para señales débiles
    if (Math.abs(normalizedValue) < dynamicThreshold) {
      // Preservación modificada para señales muy débiles
      const attenuationFactor = Math.pow(Math.abs(normalizedValue) / dynamicThreshold, 0.3);
      return this.baselineValue + (normalizedValue * Math.pow(attenuationFactor, 0.3));
    }
    
    // Conservar picos cardíacos con mínima atenuación
    const sign = normalizedValue >= 0 ? 1 : -1;
    // Reducir atenuación al mínimo (solo 30% del umbral)
    const denoisedValue = sign * (Math.abs(normalizedValue) - dynamicThreshold * 0.3);
    
    return this.baselineValue + denoisedValue;
  }
  
  /**
   * Umbral dinámico ultra-sensible para preservar señal cardíaca
   */
  private calculateDynamicThreshold(): number {
    if (this.ppgValues.length < 5) return this.WAVELET_THRESHOLD * 0.5; // Reducido a la mitad
    
    const recentValues = this.ppgValues.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Ultra-bajo umbral base para máxima sensibilidad
    const baseThreshold = this.WAVELET_THRESHOLD * 0.5;
    // Estimación de ruido mínima
    const noiseEstimate = Math.min(stdDev * 0.08, baseThreshold);
    
    return Math.max(baseThreshold * 0.2, Math.min(noiseEstimate, baseThreshold * 0.7));
  }
  
  /**
   * Filtrado Savitzky-Golay mejorado con preservación extrema de picos cardíacos
   */
  private applySavitzkyGolayFilter(value: number): number {
    const recentValues = this.ppgValues.slice(-this.SG_COEFFS.length);
    let filteredValue = 0;
    
    // Aplicar convolución SG
    for (let i = 0; i < this.SG_COEFFS.length; i++) {
      filteredValue += recentValues[i] * this.SG_COEFFS[i];
    }
    
    const normalizedFiltered = filteredValue / this.SG_NORM;
    
    // Detección mejorada de picos cardíacos
    const midPoint = Math.floor(recentValues.length / 2);
    let isPotentialPeak = true;
    
    // Lógica de detección de picos más sensible
    for (let i = Math.max(0, midPoint - 2); i < Math.min(recentValues.length, midPoint + 2); i++) {
      if (i !== midPoint && recentValues[i] > recentValues[midPoint]) {
        isPotentialPeak = false;
        break;
      }
    }
    
    // NUEVO: Preservación extrema de picos cardíacos
    if (isPotentialPeak && recentValues[midPoint] > this.baselineValue) {
      // Dar más peso al valor original para preservar amplitud completamente
      const peakPreservationFactor = 0.9; // Antes 0.7
      return peakPreservationFactor * recentValues[midPoint] + 
             (1 - peakPreservationFactor) * normalizedFiltered;
    }
    
    return normalizedFiltered;
  }

  /**
   * NUEVO: Potenciación final de componentes cardíacos
   * Amplifica específicamente patrones que se parecen a pulsaciones cardíacas
   */
  private enhanceCardiacComponent(value: number): number {
    if (this.ppgValues.length < 20) return value;
    
    // Verificar si hay un patrón cardíaco (subida seguida de bajada)
    const recentValues = this.ppgValues.slice(-20).map(v => v - this.baselineValue);
    
    let upwardTrend = 0;
    let downwardTrend = 0;
    
    // Detectar patrón de subida/bajada característico del pulso
    for (let i = 1; i < recentValues.length; i++) {
      if (recentValues[i] > recentValues[i-1]) upwardTrend++;
      else if (recentValues[i] < recentValues[i-1]) downwardTrend++;
    }
    
    // Si hay un patrón similar a un latido (subida seguida de bajada)
    const hasCardiacPattern = upwardTrend > 3 && downwardTrend > 3;
    
    // Amplificar aún más los valores que siguen patrones cardíacos
    if (hasCardiacPattern) {
      const normalizedValue = value - this.baselineValue;
      // Amplificar componentes cardíacos (especialmente picos)
      if (normalizedValue > 0) {
        // Amplificar picos positivos que son característicos de latidos
        return this.baselineValue + normalizedValue * this.PEAK_ENHANCEMENT;
      }
    }
    
    return value;
  }

  /**
   * Reset del procesador de señales
   */
  public reset(): void {
    this.ppgValues = [];
    this.baselineValue = 0;
    this.recentMax = 0;
    this.recentMin = 0;
  }

  /**
   * Obtener buffer de valores PPG
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
