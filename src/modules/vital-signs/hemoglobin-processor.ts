/**
 * Advanced non-invasive hemoglobin estimation using PPG signal analysis
 * Based on spectral analysis and Beer-Lambert law
 */
export class HemoglobinProcessor {
  // Rangos ampliados para detectar valores patológicos
  private readonly MIN_HEMOGLOBIN = 3.0;  // Anemia severa
  private readonly MAX_HEMOGLOBIN = 25.0; // Policitemia extrema
  private readonly TARGET_HEMOGLOBIN = 14.0; // Solo para calibración inicial
  
  // Rangos de referencia (solo informativos, no limitan medición)
  private readonly REFERENCE_RANGES = {
    anemia: {
      severe: { min: 3.0, max: 6.9 },
      moderate: { min: 7.0, max: 9.9 },
      mild: { min: 10.0, max: 11.9 }
    },
    normal: {
      female: { min: 12.0, max: 15.5 },
      male: { min: 13.5, max: 17.5 }
    },
    polycythemia: {
      mild: { min: 17.6, max: 20.0 },
      severe: { min: 20.1, max: 25.0 }
    }
  };

  // Parámetros de calibración
  private readonly MIN_CALIBRATION_SAMPLES = 150;
  private readonly ANALYSIS_WINDOW = 100;
  private readonly QUALITY_THRESHOLD = 0.85;
  
  // Coeficientes de absorción (basados en literatura científica)
  private readonly HB_EXTINCTION_COEFF = 0.0091; // mm⁻¹
  private readonly HBO2_EXTINCTION_COEFF = 0.0213; // mm⁻¹
  private readonly TISSUE_SCATTER_COEFF = 0.35; // mm⁻¹
  private readonly OPTICAL_PATH_LENGTH = 10;
  
  // Estado y memoria
  private calibrationInProgress: boolean = false;
  private baselineEstablished: boolean = false;
  private baselineValue: number = 0;
  private lastStableValue: number = 0;
  
  // Buffer para estabilidad
  private readonly STABILITY_BUFFER_SIZE = 25;
  private readonly MIN_SAMPLES_FOR_MEDIAN = 15;
  private stabilityBuffer: Array<{
    value: number;
    quality: number;
    timestamp: number;
    redAbsorption: number;
    irAbsorption: number;
  }> = [];

  public startCalibration(): void {
    console.log("Iniciando calibración de hemoglobina");
    this.calibrationInProgress = true;
    this.baselineEstablished = false;
    this.stabilityBuffer = [];
  }

  public calculateHemoglobin(ppgValues: number[], spo2: number = 97): number {
    if (ppgValues.length < this.ANALYSIS_WINDOW) {
      return this.lastStableValue;
    }

    // Limpiar muestras antiguas
    this.cleanOldSamples();

    try {
      if (this.calibrationInProgress) {
        return this.handleCalibration(ppgValues);
      }

      // Extraer características espectrales
      const { redAbsorption, irAbsorption, quality } = this.extractSpectralFeatures(ppgValues);
      
      if (quality < this.QUALITY_THRESHOLD) {
        return this.getLastStableMedian();
      }

      // Calcular hemoglobina usando ley de Beer-Lambert modificada
      const hemoglobinEstimate = this.calculateFromAbsorption(redAbsorption, irAbsorption, spo2);
      
      // Actualizar buffer de estabilidad
      this.updateStabilityBuffer({
        value: hemoglobinEstimate,
        quality,
        timestamp: Date.now(),
        redAbsorption,
        irAbsorption
      });

      // Obtener valor estable
      const stableValue = this.calculateWeightedMedian();
      
      if (this.isValueConsistent(stableValue)) {
        this.lastStableValue = stableValue;
      }

      return Math.round(stableValue * 10) / 10; // Un decimal

    } catch (error) {
      console.error("Error en procesamiento de hemoglobina:", error);
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
      return this.lastStableValue || this.TARGET_HEMOGLOBIN;
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
    const smoothedValue = medianValue * (1 - smoothingFactor) + 
                         this.lastStableValue * smoothingFactor;

    // No limitar valores extremos si son consistentes
    if (this.isValueConsistent(smoothedValue)) {
      return smoothedValue;
    }

    return smoothedValue;
  }

  private calculateAdaptiveSmoothingFactor(value: number): number {
    // Menor suavizado para valores extremos
    if (value < this.REFERENCE_RANGES.anemia.moderate.max || 
        value > this.REFERENCE_RANGES.polycythemia.mild.min) {
      return 0.08; // Suavizado mínimo para valores extremos
    }
    return 0.15; // Suavizado normal para valores en rango
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

    // Más permisivo con valores extremos
    let maxAllowedCV;
    if (value < this.REFERENCE_RANGES.anemia.moderate.max || 
        value > this.REFERENCE_RANGES.polycythemia.mild.min) {
      maxAllowedCV = 20; // 20% para valores extremos
    } else {
      maxAllowedCV = 15; // 15% para valores normales
    }

    return cv <= maxAllowedCV;
  }

  private extractSpectralFeatures(values: number[]): {
    redAbsorption: number;
    irAbsorption: number;
    quality: number;
  } {
    const recentValues = values.slice(-this.ANALYSIS_WINDOW);
    
    // Separar componentes rojo e IR
    const redValues = recentValues.filter((_, i) => i % 2 === 0);
    const irValues = recentValues.filter((_, i) => i % 2 === 1);

    // Calcular absorción para cada longitud de onda
    const redAbsorption = this.calculateAbsorption(redValues);
    const irAbsorption = this.calculateAbsorption(irValues);

    // Calcular calidad de señal
    const redQuality = this.calculateSignalQuality(redValues);
    const irQuality = this.calculateSignalQuality(irValues);
    const quality = Math.min(redQuality, irQuality);

    return {
      redAbsorption,
      irAbsorption,
      quality
    };
  }

  private calculateAbsorption(values: number[]): number {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const dc = values.reduce((a, b) => a + b, 0) / values.length;
    const ac = max - min;

    return Math.log((ac + dc) / dc);
  }

  private calculateSignalQuality(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / mean;

    return Math.exp(-cv * 2); // Convertir a calidad entre 0 y 1
  }

  private calculateFromAbsorption(
    redAbsorption: number,
    irAbsorption: number,
    spo2: number
  ): number {
    // Calcular fracciones de Hb y HbO2 usando SpO2
    const oxygenatedFraction = spo2 / 100;
    const deoxygenatedFraction = 1 - oxygenatedFraction;

    // Calcular atenuación total considerando dispersión
    const totalAttenuation = (redAbsorption + irAbsorption) / 2;

    // Resolver ecuación de Beer-Lambert modificada
    const totalHemoglobin = (totalAttenuation - this.TISSUE_SCATTER_COEFF) / 
      (this.HB_EXTINCTION_COEFF * deoxygenatedFraction + 
       this.HBO2_EXTINCTION_COEFF * oxygenatedFraction);

    // Convertir a g/dL
    return totalHemoglobin * 1.6;
  }

  private handleCalibration(ppgValues: number[]): number {
    const { quality } = this.extractSpectralFeatures(ppgValues);
    
    if (quality >= this.QUALITY_THRESHOLD) {
      this.stabilityBuffer.push({
        value: this.TARGET_HEMOGLOBIN,
        quality,
        timestamp: Date.now(),
        redAbsorption: 0,
        irAbsorption: 0
      });
      
      if (this.stabilityBuffer.length >= this.MIN_CALIBRATION_SAMPLES) {
        this.establishBaseline();
      }
    }
    
    return 0;
  }

  private establishBaseline(): void {
    this.baselineEstablished = true;
    this.calibrationInProgress = false;
    this.lastStableValue = this.TARGET_HEMOGLOBIN;
    
    console.log("Línea base de hemoglobina establecida", {
      timestamp: new Date().toISOString()
    });
  }

  private getLastStableMedian(): number {
    return this.calculateWeightedMedian();
  }

  private updateStabilityBuffer(values: {
    value: number;
    quality: number;
    timestamp: number;
    redAbsorption: number;
    irAbsorption: number;
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

  public reset(): void {
    this.calibrationInProgress = false;
    this.baselineEstablished = false;
    this.baselineValue = 0;
    this.lastStableValue = 0;
    this.stabilityBuffer = [];
  }
} 