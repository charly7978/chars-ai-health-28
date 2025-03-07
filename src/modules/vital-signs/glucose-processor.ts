/**
 * Advanced non-invasive glucose estimation based on PPG signal analysis
 * Focused on measurement accuracy across all ranges
 */
export class GlucoseProcessor {
  // Rangos ultra-ampliados para detectar valores extremadamente patológicos
  private readonly MIN_GLUCOSE = 10;   // Hipoglucemia crítica (coma hipoglucémico)
  private readonly MAX_GLUCOSE = 1000;  // Hiperglucemia extrema (coma diabético)
  private readonly TARGET_GLUCOSE = 100; // Solo para calibración inicial
  
  // Rangos de referencia (solo informativos, no limitan medición)
  private readonly REFERENCE_RANGES = {
    hypoglycemia: {
      critical: { min: 10, max: 30 },   // Hipoglucemia crítica
      severe: { min: 30, max: 50 },     // Hipoglucemia severa
      moderate: { min: 50, max: 70 }    // Hipoglucemia moderada
    },
    normal: { min: 70, max: 140 },      // Rango normal
    hyperglycemia: {
      moderate: { min: 140, max: 200 }, // Hiperglucemia moderada
      high: { min: 200, max: 300 },     // Hiperglucemia alta
      severe: { min: 300, max: 600 },   // Hiperglucemia severa
      critical: { min: 600, max: 1000 } // Hiperglucemia crítica
    }
  };

  // Parámetros de calibración mejorados
  private readonly MIN_CALIBRATION_SAMPLES = 180; // Aumentado para mejor línea base
  private readonly ANALYSIS_WINDOW = 180; // Ventana más grande para más datos
  private readonly QUALITY_THRESHOLD = 0.80; // Más permisivo para valores extremos
  
  // Ventanas de tiempo para análisis de tendencias
  private readonly TREND_WINDOW_SIZE = 25; // Ampliado
  private readonly STABILITY_THRESHOLD = 0.15; // Más permisivo
  
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
  private readonly STABILITY_BUFFER_SIZE = 30; // Aumentado
  private readonly MIN_SAMPLES_FOR_MEDIAN = 18; // Aumentado
  private stabilityBuffer: Array<{
    value: number;
    quality: number;
    timestamp: number;
  }> = [];

  // Coeficientes para valores extremos
  private readonly HYPOGLYCEMIA_AMPLITUDE_FACTOR = 1.8; // Factor para hipoglucemia
  private readonly HYPERGLYCEMIA_AMPLITUDE_FACTOR = 1.5; // Factor para hiperglucemia

  public startCalibration(): void {
    console.log("Iniciando calibración de glucosa");
    this.calibrationInProgress = true;
    this.baselineEstablished = false;
    this.measurementHistory = [];
    this.stabilityBuffer = [];
  }

  public calculateGlucose(ppgValues: number[]): number {
    if (ppgValues.length < this.ANALYSIS_WINDOW) {
      return this.lastStableValue;
    }

    // Limpiar muestras antiguas
    this.cleanOldSamples();

    try {
      if (this.calibrationInProgress) {
        return this.handleCalibration(ppgValues);
      }

      // Análisis de señal y calidad
      const { amplitude, quality } = this.analyzeSignalQuality(ppgValues);
      
      if (quality < this.QUALITY_THRESHOLD) {
        return this.getLastStableMedian();
      }

      // Calcular valor relativo con mayor sensibilidad para valores extremos
      const currentValue = this.calculateRelativeValue(amplitude, quality);
      
      // Actualizar buffer de estabilidad
      this.updateStabilityBuffer({
        value: currentValue,
        quality,
        timestamp: Date.now()
      });
      
      // Obtener valor estable
      const stableValue = this.calculateWeightedMedian();
      
      // Actualizar historial si el valor es estable
      if (this.isValueStable(stableValue)) {
        this.measurementHistory.push({
          timestamp: Date.now(),
          value: stableValue,
          confidence: quality
        });
        
        if (this.measurementHistory.length > this.TREND_WINDOW_SIZE) {
          this.measurementHistory.shift();
        }
        
        this.lastStableValue = stableValue;
      }

      return Math.round(stableValue);

    } catch (error) {
      console.error("Error en procesamiento de glucosa:", error);
      return this.lastStableValue;
    }
  }

  private cleanOldSamples(): void {
    const thirtySecondsAgo = Date.now() - 30000;
    this.stabilityBuffer = this.stabilityBuffer.filter(
      sample => sample.timestamp > thirtySecondsAgo
    );
  }

  private calculateWeightedMedian(): number {
    if (this.stabilityBuffer.length < this.MIN_SAMPLES_FOR_MEDIAN) {
      return this.lastStableValue || this.TARGET_GLUCOSE;
    }

    // Ordenar valores
    const sortedValues = [...this.stabilityBuffer]
      .sort((a, b) => a.value - b.value);

    // Calcular pesos basados en calidad y tiempo
    const weights = this.stabilityBuffer.map(sample => {
      const age = (Date.now() - sample.timestamp) / 1000;
      const timeWeight = Math.exp(-age / 10);
      return sample.quality * timeWeight;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const medianWeight = totalWeight / 2;

    let accumWeight = 0;
    let medianValue = this.lastStableValue;

    // Encontrar mediana ponderada
    for (let i = 0; i < sortedValues.length; i++) {
      accumWeight += weights[i];
      if (accumWeight >= medianWeight) {
        medianValue = sortedValues[i].value;
        break;
      }
    }

    // Aplicar suavizado adaptativo
    const smoothingFactor = this.calculateAdaptiveSmoothingFactor(medianValue);
    
    // Si los últimos valores son consistentes y extremos, reducimos aún más el suavizado
    const smoothedValue = this.isValueConsistent(medianValue) && this.isExtremeValue(medianValue)
      ? medianValue * 0.9 + this.lastStableValue * 0.1  // Mínimo suavizado
      : medianValue * (1 - smoothingFactor) + this.lastStableValue * smoothingFactor;

    return smoothedValue;
  }

  private isExtremeValue(value: number): boolean {
    return value < this.REFERENCE_RANGES.hypoglycemia.moderate.max || 
           value > this.REFERENCE_RANGES.hyperglycemia.high.min;
  }

  private calculateAdaptiveSmoothingFactor(value: number): number {
    // Menor suavizado para valores extremos para mantener precisión
    if (value > this.REFERENCE_RANGES.hyperglycemia.high.min) {
      return 0.05; // Hiperglucemia
    } else if (value < this.REFERENCE_RANGES.hypoglycemia.moderate.max) {
      return 0.03; // Hipoglucemia (aún menos suavizado)
    } else if (value > this.REFERENCE_RANGES.hyperglycemia.moderate.min || 
               value < this.REFERENCE_RANGES.normal.min) {
      return 0.10; // Valores borderline
    }
    return 0.15; // Valores normales
  }

  private isValueConsistent(value: number): boolean {
    if (this.stabilityBuffer.length < this.MIN_SAMPLES_FOR_MEDIAN) {
      return false;
    }

    const values = this.stabilityBuffer.map(s => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100;

    // Adaptamos los umbrales según el rango de valores
    let maxAllowedCV;
    
    if (value > this.REFERENCE_RANGES.hyperglycemia.severe.min) {
      maxAllowedCV = 25; // Hiperglucemia severa/crítica: hasta 25% CV
    } else if (value > this.REFERENCE_RANGES.hyperglycemia.high.min) {
      maxAllowedCV = 20; // Hiperglucemia alta: hasta 20% CV
    } else if (value < this.REFERENCE_RANGES.hypoglycemia.severe.max) {
      maxAllowedCV = 25; // Hipoglucemia severa/crítica: hasta 25% CV
    } else if (value < this.REFERENCE_RANGES.hypoglycemia.moderate.max) {
      maxAllowedCV = 20; // Hipoglucemia moderada: hasta 20% CV
    } else {
      maxAllowedCV = 15; // Valores normales: hasta 15% CV
    }

    return cv <= maxAllowedCV;
  }

  private analyzeSignalQuality(ppgValues: number[]): {
    amplitude: number;
    quality: number;
  } {
    const recentValues = ppgValues.slice(-this.ANALYSIS_WINDOW);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = (max - min) / (max || 1);
    
    // Análisis de estabilidad
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Cálculo mejorado de estabilidad para mejor detección de valores extremos
    const stability = Math.exp(-normalizedVariance);
    
    // Análisis espectral básico para detectar características de señal
    const spectralQuality = this.analyzeSpectralQualities(recentValues);
    
    // Calidad combinada
    const amplitudeQuality = amplitude > 0.1 ? Math.min(1, amplitude / 0.3) : 0;
    const quality = Math.min(1, stability * amplitudeQuality * spectralQuality * 0.95);
    
    return { amplitude, quality };
  }

  private analyzeSpectralQualities(values: number[]): number {
    // Implementación simple para estimar calidad espectral
    let transitions = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] > values[i-1] && values[i-1] <= values[i-2]) ||
          (values[i] < values[i-1] && values[i-1] >= values[i-2])) {
        transitions++;
      }
    }
    
    // Estimamos calidad basada en número esperado de transiciones
    const expectedTransitions = values.length / 10; // Aproximadamente
    const ratio = transitions / expectedTransitions;
    
    return ratio > 0.5 && ratio < 2.0 ? 
           Math.min(1, Math.max(0, 1 - Math.abs(ratio - 1) / 1)) : 
           0.5; // Penalización moderada si hay muy pocas o muchas transiciones
  }

  private calculateRelativeValue(currentAmplitude: number, quality: number): number {
    if (!this.baselineEstablished) return this.TARGET_GLUCOSE;
    
    // Calcular cambio relativo respecto a la línea base
    const relativeChange = (currentAmplitude - this.baselineValue) / this.baselineValue;
    
    // Factor de escala adaptativo basado en último valor y calidad
    let scaleFactor = 100; // Factor base
    
    if (this.lastStableValue > this.REFERENCE_RANGES.hyperglycemia.severe.min) {
      // Hiperglucemia severa/crítica
      scaleFactor = 200 * this.HYPERGLYCEMIA_AMPLITUDE_FACTOR;
    } else if (this.lastStableValue > this.REFERENCE_RANGES.hyperglycemia.high.min) {
      // Hiperglucemia alta
      scaleFactor = 150 * this.HYPERGLYCEMIA_AMPLITUDE_FACTOR;
    } else if (this.lastStableValue > this.REFERENCE_RANGES.hyperglycemia.moderate.min) {
      // Hiperglucemia moderada
      scaleFactor = 120;
    } else if (this.lastStableValue < this.REFERENCE_RANGES.hypoglycemia.severe.max) {
      // Hipoglucemia severa/crítica
      scaleFactor = 80 * this.HYPOGLYCEMIA_AMPLITUDE_FACTOR;
    } else if (this.lastStableValue < this.REFERENCE_RANGES.hypoglycemia.moderate.max) {
      // Hipoglucemia moderada
      scaleFactor = 70 * this.HYPOGLYCEMIA_AMPLITUDE_FACTOR;
    } else if (this.lastStableValue < this.REFERENCE_RANGES.normal.min) {
      // Hipoglucemia leve
      scaleFactor = 90;
    }
    
    // Ajuste adicional por calidad
    scaleFactor *= Math.max(0.8, quality);
    
    // Calcular nuevo valor con mayor amplificación para valores extremos
    const glucoseChange = relativeChange * scaleFactor;
    return this.lastStableValue + glucoseChange;
  }

  private handleCalibration(ppgValues: number[]): number {
    const { amplitude, quality } = this.analyzeSignalQuality(ppgValues);
    
    if (quality >= this.QUALITY_THRESHOLD) {
      this.stabilityBuffer.push({
        value: this.TARGET_GLUCOSE,
        quality,
        timestamp: Date.now()
      });
      
      if (this.stabilityBuffer.length >= this.MIN_CALIBRATION_SAMPLES) {
        this.establishBaseline(amplitude);
      }
    }
    
    return 0;
  }

  private establishBaseline(amplitude: number): void {
    this.baselineValue = amplitude;
    this.baselineEstablished = true;
    this.calibrationInProgress = false;
    this.lastStableValue = this.TARGET_GLUCOSE;
    
    console.log("Línea base de glucosa establecida", {
      baselineValue: this.baselineValue,
      timestamp: new Date().toISOString()
    });
  }

  private getLastStableMedian(): number {
    return Math.round(this.calculateWeightedMedian());
  }

  private updateStabilityBuffer(values: {
    value: number;
    quality: number;
    timestamp: number;
  }): void {
    // Verificar desviación
    if (this.stabilityBuffer.length > 0) {
      const avgValue = this.stabilityBuffer.reduce((sum, v) => sum + v.value, 0) / 
                      this.stabilityBuffer.length;
      const deviation = Math.abs(values.value - avgValue) / avgValue;
      
      // Reducir calidad para valores muy desviados
      if (deviation > 0.2) {
        values.quality *= (1 - deviation);
      }
    }
    
    this.stabilityBuffer.push(values);
    
    if (this.stabilityBuffer.length > this.STABILITY_BUFFER_SIZE) {
      this.stabilityBuffer.shift();
    }
  }

  private isValueStable(value: number): boolean {
    if (this.measurementHistory.length < 2) return true;
    
    // Calcular variación respecto a mediciones recientes
    const recentMeasurements = this.measurementHistory.slice(-3);
    const avgValue = recentMeasurements.reduce((sum, m) => sum + m.value, 0) / recentMeasurements.length;
    
    const variation = Math.abs(value - avgValue) / avgValue;
    return variation <= this.STABILITY_THRESHOLD;
  }

  public reset(): void {
    this.calibrationInProgress = false;
    this.baselineEstablished = false;
    this.baselineValue = 0;
    this.lastStableValue = 0;
    this.measurementHistory = [];
    this.stabilityBuffer = [];
  }
}
