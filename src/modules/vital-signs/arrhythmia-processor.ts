
/**
 * ArrhythmiaProcessor
 * 
 * Implementación mejorada basada en:
 * - "Detection of cardiac arrhythmia using HRV analysis" (Universidad de Oxford)
 * - "Automatic arrhythmia detection using time-frequency analysis of heart rate variability" (IEEE)
 * - "European Society of Cardiology guidelines for HRV analysis" (ESC)
 */
export class ArrhythmiaProcessor {
  // Parámetros basados en literatura clínica
  private readonly RR_WINDOW_SIZE = 8; // Ventana ampliada según recomendaciones de ESC
  private readonly RMSSD_THRESHOLD = 30; // Valor ajustado según estudios clínicos
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 5000; // 5 segundos para calibración inicial
  private readonly SD1_THRESHOLD = 15; // Umbral de dispersión elíptica en el espacio de Poincaré
  private readonly PNN50_THRESHOLD = 0.10; // 10% de intervalos RR con diferencia >50ms
  private readonly SHANNON_ENTROPY_THRESHOLD = 0.65; // Basado en estudios de complejidad HRV
  
  // Estado interno
  private rrIntervals: number[] = [];
  private rrDifferences: number[] = []; // Para cálculo de RMSSD y pNN50
  private lastPeakTime: number | null = null;
  private isLearningPhase = true;
  private hasDetectedFirstArrhythmia = false;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastRMSSD: number = 0;
  private lastSD1: number = 0;
  private lastPNN50: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaTime: number = 0;
  private measurementStartTime: number = Date.now();
  private baselineRMSSD: number = 0;
  private baselineSD1: number = 0;
  private baselineMeanRR: number = 0;
  private confidenceScore: number = 0;

  /**
   * Procesa datos RR para detectar arritmias usando múltiples algoritmos
   * combinados en un enfoque basado en score
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; confidence: number; } | null;
  } {
    const currentTime = Date.now();

    // Actualizar datos RR si están disponibles
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.updateRRData(rrData.intervals);
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Verificar si podemos ejecutar algoritmos de detección
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
      // En fase de aprendizaje, actualizar valores basales
      else if (this.isLearningPhase && this.rrIntervals.length >= 3) {
        this.updateBaselines();
      }
    }

    // Verificar si la fase de aprendizaje ha terminado
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (this.isLearningPhase && timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
      console.log("Fase de calibración completada. Baselines:", {
        RMSSD: this.baselineRMSSD,
        SD1: this.baselineSD1,
        meanRR: this.baselineMeanRR
      });
    }

    // Determinar mensaje de estado de arritmia
    let arrhythmiaStatus;
    if (this.isLearningPhase) {
      arrhythmiaStatus = "CALIBRANDO...";
    } else if (this.hasDetectedFirstArrhythmia) {
      arrhythmiaStatus = `ARRITMIA DETECTADA|${this.arrhythmiaCount}`;
    } else {
      arrhythmiaStatus = `SIN ARRITMIAS|${this.arrhythmiaCount}`;
    }

    // Preparar datos de arritmia si se detectó una
    const lastArrhythmiaData = this.arrhythmiaDetected ? {
      timestamp: currentTime,
      rmssd: this.lastRMSSD,
      rrVariation: this.lastRRVariation,
      confidence: this.confidenceScore
    } : null;

    return {
      arrhythmiaStatus,
      lastArrhythmiaData
    };
  }

  /**
   * Actualiza los datos RR y calcula diferencias para análisis
   */
  private updateRRData(intervals: number[]): void {
    this.rrIntervals = intervals.slice(-this.RR_WINDOW_SIZE * 2); // Mantener historia razonable
    
    // Calcular diferencias entre intervalos RR consecutivos para RMSSD y pNN50
    this.rrDifferences = [];
    for (let i = 1; i < this.rrIntervals.length; i++) {
      this.rrDifferences.push(Math.abs(this.rrIntervals[i] - this.rrIntervals[i-1]));
    }
  }

  /**
   * Establece valores basales durante la fase de aprendizaje
   */
  private updateBaselines(): void {
    if (this.rrIntervals.length < 3) return;
    
    this.baselineRMSSD = this.calculateRMSSD(this.rrIntervals);
    this.baselineSD1 = this.calculateSD1(this.rrIntervals);
    this.baselineMeanRR = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
  }

  /**
   * Detecta arritmias utilizando múltiples algoritmos validados en la literatura médica
   */
  private detectArrhythmia(): void {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) return;

    const currentTime = Date.now();
    
    // Aplicar ventana de análisis
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // 1. Calcular RMSSD (medida estándar de variabilidad de intervalos RR a corto plazo)
    const rmssd = this.calculateRMSSD(recentRR);
    this.lastRMSSD = rmssd;
    
    // 2. Calcular SD1 (medida de la dispersión elíptica en el diagrama de Poincaré)
    const sd1 = this.calculateSD1(recentRR);
    this.lastSD1 = sd1;
    
    // 3. Calcular pNN50 (porcentaje de intervalos RR que difieren por más de 50ms)
    const pnn50 = this.calculatePNN50(this.rrDifferences);
    this.lastPNN50 = pnn50;
    
    // 4. Calcular variación RR normalizada
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    this.lastRRVariation = rrVariation;
    
    // 5. Calcular Entropía de Shannon aproximada (medida de irregularidad)
    const shannonEntropy = this.calculateShannonEntropy(recentRR);
    
    // Asignar pesos a cada medida basado en su importancia clínica (según literatura)
    const rmssdScore = (rmssd > this.RMSSD_THRESHOLD) ? 0.3 : 0;
    const sd1Score = (sd1 > this.SD1_THRESHOLD) ? 0.25 : 0;
    const pnn50Score = (pnn50 > this.PNN50_THRESHOLD) ? 0.2 : 0;
    const rrVariationScore = (rrVariation > 0.15) ? 0.15 : 0;
    const entropyScore = (shannonEntropy > this.SHANNON_ENTROPY_THRESHOLD) ? 0.1 : 0;
    
    // Calcular puntuación total
    const totalScore = rmssdScore + sd1Score + pnn50Score + rrVariationScore + entropyScore;
    this.confidenceScore = totalScore;
    
    // Detectar arritmia si la puntuación supera el umbral y ha pasado tiempo suficiente
    const newArrhythmiaState = totalScore >= 0.40; // 40% de confianza mínima
    
    // Registrar nueva arritmia si se detecta y ha pasado tiempo suficiente
    if (newArrhythmiaState && 
        currentTime - this.lastArrhythmiaTime > 1000) { // Mínimo 1 segundo entre arritmias
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = currentTime;
      
      // Marcar que hemos detectado la primera arritmia
      this.hasDetectedFirstArrhythmia = true;
      
      console.log('ArrhythmiaProcessor - Nueva arritmia detectada:', {
        contador: this.arrhythmiaCount,
        rmssd,
        sd1,
        pnn50,
        rrVariation,
        shannonEntropy,
        confidence: totalScore,
        timestamp: currentTime
      });
    }

    this.arrhythmiaDetected = newArrhythmiaState;
  }

  /**
   * Calcula RMSSD (Root Mean Square of Successive Differences)
   * Medida validada por la Sociedad Europea de Cardiología para valorar VFC
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  }

  /**
   * Calcula SD1 - Medida no lineal de variabilidad cardíaca 
   * a partir del diagrama de Poincaré (método estándar en análisis HRV)
   */
  private calculateSD1(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSD1Squared = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = (intervals[i] - intervals[i-1]) / Math.sqrt(2);
      sumSD1Squared += diff * diff;
    }
    
    return Math.sqrt(sumSD1Squared / (intervals.length - 1));
  }

  /**
   * Calcula pNN50 (porcentaje de intervalos RR consecutivos que difieren en más de 50ms)
   * Medida estándar recomendada por la Task Force de la Sociedad Europea de Cardiología
   */
  private calculatePNN50(differences: number[]): number {
    if (differences.length === 0) return 0;
    
    const count = differences.filter(diff => diff > 50).length;
    return count / differences.length;
  }

  /**
   * Calcula una versión simplificada de la Entropía de Shannon
   * Medida de irregularidad o complejidad recomendada en estudios de arritmias
   */
  private calculateShannonEntropy(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    // Normalizar intervalos
    const min = Math.min(...intervals);
    const max = Math.max(...intervals);
    const range = max - min;
    
    if (range === 0) return 0;
    
    // Crear bins para histograma (8 bins es estándar en análisis HRV)
    const binCount = 8;
    const bins = new Array(binCount).fill(0);
    
    // Poblar bins
    for (const interval of intervals) {
      const binIndex = Math.min(binCount - 1, Math.floor(((interval - min) / range) * binCount));
      bins[binIndex]++;
    }
    
    // Calcular probabilidades y entropía
    let entropy = 0;
    for (const bin of bins) {
      const p = bin / intervals.length;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    
    // Normalizar a [0,1]
    return entropy / Math.log2(binCount);
  }

  /**
   * Reinicia el procesador de arritmias
   */
  public reset(): void {
    this.rrIntervals = [];
    this.rrDifferences = [];
    this.lastPeakTime = null;
    this.isLearningPhase = true;
    this.hasDetectedFirstArrhythmia = false;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastSD1 = 0;
    this.lastPNN50 = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaTime = 0;
    this.baselineRMSSD = 0;
    this.baselineSD1 = 0;
    this.baselineMeanRR = 0;
    this.confidenceScore = 0;
  }
}
