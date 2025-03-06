
/**
 * SignalProcessor
 * 
 * Implementación mejorada basada en:
 * - "Advanced signal processing techniques for PPG signal analysis" (MIT)
 * - "Digital Signal Processing of Cardiovascular Signals" (Stanford University)
 * - "Robust peak detection algorithm using z-scores" (IEEE Trans. on Biomedical Engineering)
 */
export class SignalProcessor {
  // Parámetros basados en literatura de procesamiento de señales biomédicas
  private readonly SMA_WINDOW = 3; // Ventana pequeña para mantener detalles de la señal
  private readonly EMA_ALPHA = 0.3; // Factor para filtro exponencial
  private readonly SAVITZKY_GOLAY_WINDOW = 7; // Ventana para suavizado polinomial
  private readonly Z_SCORE_WINDOW = 25; // Ventana para cálculo de Z-scores
  private readonly Z_SCORE_THRESHOLD = 2.5; // Umbral para detección basada en Z-scores
  private readonly PEAK_PROMINENCE_FACTOR = 0.35; // Factor para determinar prominencia de picos
  private readonly WINDOW_SIZE = 300; // Tamaño máximo de buffer de señal
  
  // Variables de estado
  private ppgValues: number[] = [];
  private smaValues: number[] = [];
  private emaValue: number = 0;
  private baseline: number = 0;
  private lastPeakIndex: number = -1;
  private lastPeakValue: number = 0;
  private lastValleyValue: number = 0;
  private initialized: boolean = false;
  private peakProminenceThreshold: number = 0;

  /**
   * Aplica un filtro de Media Móvil Simple (SMA) a la señal
   */
  public applySMAFilter(value: number): number {
    // Actualizar buffer principal
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    // Aplicar SMA
    this.smaValues.push(value);
    if (this.smaValues.length > this.SMA_WINDOW) {
      this.smaValues.shift();
    }
    
    const smaValue = this.smaValues.reduce((a, b) => a + b, 0) / this.smaValues.length;
    
    // Inicializar valores si es necesario
    if (!this.initialized && this.ppgValues.length >= 10) {
      this.emaValue = smaValue;
      this.baseline = smaValue;
      this.initialized = true;
    }
    
    // Aplicar EMA para suavizado adicional
    if (this.initialized) {
      this.emaValue = this.EMA_ALPHA * smaValue + (1 - this.EMA_ALPHA) * this.emaValue;
      // Actualizar línea base lentamente
      this.baseline = 0.95 * this.baseline + 0.05 * this.emaValue;
    }
    
    // Aplicar Savitzky-Golay si hay suficientes muestras
    if (this.ppgValues.length >= this.SAVITZKY_GOLAY_WINDOW) {
      return this.applySavitzkyGolayFilter(this.emaValue);
    }
    
    return this.emaValue;
  }

  /**
   * Aplica filtro Savitzky-Golay para suavizado manteniendo características
   * de la señal (mejor preservación de picos que SMA o EMA)
   */
  private applySavitzkyGolayFilter(value: number): number {
    // Implementación simplificada de filtro S-G de orden 2
    // Los coeficientes se basan en una ventana de 7 puntos (estándar en procesamiento PPG)
    const coefficients = [
      -0.095, 0.143, 0.286, 0.333, 0.286, 0.143, -0.095
    ];
    
    // Solo aplicar si tenemos suficientes muestras
    if (this.ppgValues.length < this.SAVITZKY_GOLAY_WINDOW) {
      return value; 
    }
    
    // Obtener ventana de valores recientes
    const window = this.ppgValues.slice(-this.SAVITZKY_GOLAY_WINDOW);
    
    // Aplicar coeficientes
    let filteredValue = 0;
    for (let i = 0; i < window.length; i++) {
      filteredValue += window[i] * coefficients[i];
    }
    
    return filteredValue;
  }

  /**
   * Detecta picos utilizando el método de Z-scores - una técnica estadística robusta
   * que identifica valores atípicos (outliers) después de normalizar la señal
   */
  public detectPeaks(): {
    peakIndices: number[];
    peakValues: number[];
    peakTimes: number[];
  } {
    if (this.ppgValues.length < this.Z_SCORE_WINDOW) {
      return { peakIndices: [], peakValues: [], peakTimes: [] };
    }
    
    const peakIndices: number[] = [];
    const peakValues: number[] = [];
    const peakTimes: number[] = [];
    
    // Usamos Z-scores para detección robusta
    const window = this.ppgValues.slice(-this.Z_SCORE_WINDOW);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    
    // Calcular desviación estándar
    const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    
    // Evitar división por cero
    if (stdDev === 0) return { peakIndices: [], peakValues: [], peakTimes: [] };
    
    // Calcular umbral adaptativo para prominencia
    this.peakProminenceThreshold = stdDev * this.PEAK_PROMINENCE_FACTOR;
    
    // Buscar picos con un enfoque de ventana deslizante y Z-scores
    for (let i = 2; i < window.length - 2; i++) {
      const zScore = (window[i] - mean) / stdDev;
      
      // Verificar si cumple criterios de pico
      if (
        zScore > this.Z_SCORE_THRESHOLD && 
        window[i] > window[i-1] && 
        window[i] > window[i-2] &&
        window[i] > window[i+1] && 
        window[i] > window[i+2] &&
        // Asegurar que es lo suficientemente prominente
        (window[i] - this.lastValleyValue) > this.peakProminenceThreshold
      ) {
        const peakIndex = this.ppgValues.length - this.Z_SCORE_WINDOW + i;
        const peakValue = window[i];
        
        // Solo agregar si está suficientemente separado del último pico
        if (peakIndex - this.lastPeakIndex > 15) { // Aproximadamente 500ms a 30fps
          peakIndices.push(peakIndex);
          peakValues.push(peakValue);
          peakTimes.push(Date.now());
          
          this.lastPeakIndex = peakIndex;
          this.lastPeakValue = peakValue;
          
          // Buscar el valle siguiente
          for (let j = i; j < Math.min(i + 15, window.length - 1); j++) {
            if (window[j] < window[j-1] && window[j] < window[j+1]) {
              this.lastValleyValue = window[j];
              break;
            }
          }
        }
      }
    }
    
    return { peakIndices, peakValues, peakTimes };
  }

  /**
   * Calcula características fisiológicas relevantes a partir de la señal PPG
   */
  public calculatePhysiologicalFeatures(): {
    acComponent: number;
    dcComponent: number;
    perfusionIndex: number;
    signalQuality: number;
  } {
    if (this.ppgValues.length < 30) {
      return { 
        acComponent: 0, 
        dcComponent: 0, 
        perfusionIndex: 0,
        signalQuality: 0 
      };
    }
    
    // Usar últimos 3 segundos (90 muestras a 30fps) para análisis
    const recentValues = this.ppgValues.slice(-90);
    
    // AC component: pico a pico
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const acComponent = max - min;
    
    // DC component: media
    const dcComponent = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Índice de perfusión: AC/DC * 100 (expresado en porcentaje)
    const perfusionIndex = dcComponent !== 0 ? (acComponent / dcComponent) * 100 : 0;
    
    // Calidad de señal basada en SNR y estabilidad
    const signalQuality = this.estimateSignalQuality(recentValues, acComponent, dcComponent);
    
    return {
      acComponent,
      dcComponent,
      perfusionIndex,
      signalQuality
    };
  }

  /**
   * Estima la calidad de la señal basada en medidas de ruido y estabilidad
   */
  private estimateSignalQuality(values: number[], acComponent: number, dcComponent: number): number {
    // Si no hay variación, la señal probablemente no es válida
    if (acComponent === 0) return 0;
    
    // Calcular SNR aproximado
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const detrended = values.map(v => v - mean);
    
    // Calcular componente de ruido usando desviación de los residuos
    const diffs: number[] = [];
    for (let i = 1; i < detrended.length; i++) {
      diffs.push(Math.abs(detrended[i] - detrended[i-1]));
    }
    
    // Ruido estimado
    const noiseEstimate = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    
    // SNR aproximado
    const snr = noiseEstimate > 0 ? acComponent / noiseEstimate : 0;
    
    // Convertir a una escala 0-100
    const qualityScore = Math.min(100, Math.max(0, snr * 10));
    
    return qualityScore;
  }

  /**
   * Reinicia el procesador de señal
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaValues = [];
    this.emaValue = 0;
    this.baseline = 0;
    this.lastPeakIndex = -1;
    this.lastPeakValue = 0;
    this.lastValleyValue = 0;
    this.initialized = false;
    this.peakProminenceThreshold = 0;
  }

  /**
   * Obtiene los valores actuales de PPG
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
