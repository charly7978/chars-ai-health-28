/**
 * Advanced non-invasive glucose estimation based on PPG signal analysis
 * Focused on measurement consistency and trend detection
 */
export class GlucoseProcessor {
  // Límites y configuración
  private readonly MIN_GLUCOSE = 70;
  private readonly MAX_GLUCOSE = 180;
  private readonly MIN_CALIBRATION_SAMPLES = 150; // Aumentado para mejor línea base
  private readonly ANALYSIS_WINDOW = 150;
  
  // Ventanas de tiempo para análisis de tendencias
  private readonly TREND_WINDOW_SIZE = 20;
  private readonly STABILITY_THRESHOLD = 0.15; // 15% de variación máxima permitida
  
  // Variables de estado y memoria
  private calibrationInProgress: boolean = false;
  private baselineEstablished: boolean = false;
  private baselineValue: number = 0;
  private lastStableValue: number = 0;
  private measurementHistory: Array<{
    timestamp: number;
    value: number;
    confidence: number;
  }> = [];
  
  // Buffers para estabilidad
  private readonly STABILITY_BUFFER_SIZE = 10;
  private stabilityBuffer: number[] = [];
  private confidenceBuffer: number[] = [];

  public startCalibration(): void {
    this.calibrationInProgress = true;
    this.baselineEstablished = false;
    this.measurementHistory = [];
    this.stabilityBuffer = [];
    this.confidenceBuffer = [];
    console.log("Iniciando nueva calibración de glucosa");
  }

  public calculateGlucose(ppgValues: number[]): number {
    if (ppgValues.length < this.ANALYSIS_WINDOW) {
      return this.lastStableValue;
    }

    try {
      // Durante calibración, establecer línea base
      if (this.calibrationInProgress) {
        return this.handleCalibration(ppgValues);
      }

      // Calcular características básicas de la señal
      const { amplitude, quality } = this.analyzeSignalQuality(ppgValues);
      
      if (quality < 0.6) {
        console.log("Calidad de señal insuficiente", { quality });
        return this.lastStableValue;
      }

      // Calcular valor relativo basado en la línea base
      const currentValue = this.calculateRelativeValue(amplitude);
      
      // Actualizar buffer de estabilidad
      this.updateStabilityBuffer(currentValue, quality);
      
      // Obtener valor estable
      const stableValue = this.getStableValue();
      
      // Actualizar historial solo si el valor es estable
      if (this.isValueStable(stableValue)) {
        this.measurementHistory.push({
          timestamp: Date.now(),
          value: stableValue,
          confidence: this.getCurrentConfidence()
        });
        
        // Mantener solo el historial reciente
        if (this.measurementHistory.length > this.TREND_WINDOW_SIZE) {
          this.measurementHistory.shift();
        }
        
        this.lastStableValue = stableValue;
      }

      return this.lastStableValue;

    } catch (error) {
      console.error("Error en procesamiento de glucosa:", error);
      return this.lastStableValue;
    }
  }

  private handleCalibration(ppgValues: number[]): number {
    const { amplitude, quality } = this.analyzeSignalQuality(ppgValues);
    
    if (quality >= 0.8) { // Exigimos alta calidad para calibración
      this.stabilityBuffer.push(amplitude);
      this.confidenceBuffer.push(quality);
      
      if (this.stabilityBuffer.length >= this.MIN_CALIBRATION_SAMPLES) {
        this.establishBaseline();
        return this.lastStableValue;
      }
    }
    
    return 0;
  }

  private establishBaseline(): void {
    // Calcular línea base usando la mediana de las muestras de alta calidad
    const highQualitySamples = this.stabilityBuffer.filter((_, i) => 
      this.confidenceBuffer[i] >= 0.8
    );
    
    if (highQualitySamples.length >= this.MIN_CALIBRATION_SAMPLES * 0.8) {
      const sorted = [...highQualitySamples].sort((a, b) => a - b);
      this.baselineValue = sorted[Math.floor(sorted.length / 2)];
      this.baselineEstablished = true;
      this.calibrationInProgress = false;
      
      // Establecer valor inicial
      this.lastStableValue = 100; // Valor de inicio estándar
      
      console.log("Línea base establecida", {
        baselineValue: this.baselineValue,
        samplesUsed: highQualitySamples.length
      });
    }
  }

  private analyzeSignalQuality(ppgValues: number[]): {
    amplitude: number;
    quality: number;
  } {
    const recentValues = ppgValues.slice(-this.ANALYSIS_WINDOW);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Calcular calidad basada en estabilidad y amplitud
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const stability = Math.exp(-variance / (mean * mean));
    
    // Calidad combinada
    const quality = Math.min(1, stability * (amplitude > 0.1 ? 1 : 0.5));
    
    return { amplitude, quality };
  }

  private calculateRelativeValue(currentAmplitude: number): number {
    if (!this.baselineEstablished) return 0;
    
    // Calcular cambio relativo respecto a la línea base
    const relativeChange = (currentAmplitude - this.baselineValue) / this.baselineValue;
    
    // Convertir cambio relativo a cambio en mg/dL
    const glucoseChange = relativeChange * 50; // Factor de escala para cambios en glucosa
    
    // Aplicar cambio al último valor estable
    return Math.max(this.MIN_GLUCOSE, 
           Math.min(this.MAX_GLUCOSE, 
           this.lastStableValue + glucoseChange));
  }

  private updateStabilityBuffer(value: number, quality: number): void {
    this.stabilityBuffer.push(value);
    this.confidenceBuffer.push(quality);
    
    if (this.stabilityBuffer.length > this.STABILITY_BUFFER_SIZE) {
      this.stabilityBuffer.shift();
      this.confidenceBuffer.shift();
    }
  }

  private getStableValue(): number {
    if (this.stabilityBuffer.length < this.STABILITY_BUFFER_SIZE) {
      return this.lastStableValue;
    }

    // Calcular mediana ponderada por confianza
    const weightedValues = this.stabilityBuffer.map((value, i) => ({
      value,
      weight: this.confidenceBuffer[i]
    }));
    
    weightedValues.sort((a, b) => a.value - b.value);
    
    let totalWeight = weightedValues.reduce((sum, { weight }) => sum + weight, 0);
    let medianWeight = totalWeight / 2;
    let accumWeight = 0;
    
    for (const { value, weight } of weightedValues) {
      accumWeight += weight;
      if (accumWeight >= medianWeight) {
        return Math.round(value);
      }
    }
    
    return this.lastStableValue;
  }

  private isValueStable(value: number): boolean {
    if (this.measurementHistory.length < 2) return true;
    
    // Calcular variación respecto a mediciones recientes
    const recentMeasurements = this.measurementHistory.slice(-3);
    const avgValue = recentMeasurements.reduce((sum, m) => sum + m.value, 0) / recentMeasurements.length;
    
    const variation = Math.abs(value - avgValue) / avgValue;
    return variation <= this.STABILITY_THRESHOLD;
  }

  private getCurrentConfidence(): number {
    return this.confidenceBuffer.reduce((sum, val) => sum + val, 0) / this.confidenceBuffer.length;
  }

  public reset(): void {
    this.calibrationInProgress = false;
    this.baselineEstablished = false;
    this.baselineValue = 0;
    this.lastStableValue = 0;
    this.measurementHistory = [];
    this.stabilityBuffer = [];
    this.confidenceBuffer = [];
  }
}
