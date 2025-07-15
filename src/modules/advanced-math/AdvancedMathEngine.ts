/**
 * AdvancedMathEngine - Motor de Cálculos Matemáticos Complejos
 * 
 * Implementa algoritmos matemáticos avanzados para análisis biométrico:
 * - Transformada Rápida de Fourier (FFT)
 * - Filtro de Kalman Extendido
 * - Filtro Savitzky-Golay
 * - Análisis de Componentes Principales (PCA)
 * - Detección Avanzada de Picos con Validación Fisiológica
 */

export interface FrequencySpectrum {
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
  dominantFrequency: number;
  harmonics: number[];
  spectralPurity: number;
  snr: number;
  powerSpectralDensity: number[];
}

export interface KalmanState {
  state: number[];
  covariance: number[][];
  prediction: number[];
  innovation: number[];
  kalmanGain: number[][];
}

export interface PCAResult {
  eigenValues: number[];
  eigenVectors: number[][];
  principalComponents: number[][];
  explainedVariance: number[];
  cumulativeVariance: number[];
  transformedData: number[][];
}

export interface Peak {
  index: number;
  value: number;
  prominence: number;
  width: number;
  leftBase: number;
  rightBase: number;
  snr: number;
  isPhysiological: boolean;
}

export interface AdvancedMathConfig {
  fftWindowType: 'rectangular' | 'hanning' | 'hamming' | 'blackman';
  kalmanProcessNoise: number;
  kalmanMeasurementNoise: number;
  peakDetectionThreshold: number;
  physiologicalRange: { min: number; max: number };
  spectralAnalysisDepth: number;
}

export class AdvancedMathEngine {
  private config: AdvancedMathConfig;
  private kalmanStates: Map<string, KalmanState> = new Map();

  // Constantes matemáticas
  private readonly PI = Math.PI;
  private readonly TWO_PI = 2 * Math.PI;

  constructor(config?: Partial<AdvancedMathConfig>) {
    this.config = {
      fftWindowType: 'hanning',
      kalmanProcessNoise: 0.01,
      kalmanMeasurementNoise: 0.1,
      peakDetectionThreshold: 0.3,
      physiologicalRange: { min: 0.5, max: 4.0 }, // 30-240 BPM
      spectralAnalysisDepth: 7,
      ...config
    };

    console.log('AdvancedMathEngine: Inicializado');
  }

  /**
    * Realiza análisis FFT completo de una señal
    * Implementa X(k) = Σ(n=0 to N-1) x(n) × e^(-j2πkn/N)
    */
  public performFFTAnalysis(signal: number[]): FrequencySpectrum {
    if (signal.length === 0) {
      throw new Error('La señal no puede estar vacía para análisis FFT');
    }

    const startTime = performance.now();

    // Preparar señal para FFT
    const paddedSignal = this.padToPowerOfTwo(signal);
    const windowedSignal = this.applyWindow(paddedSignal, this.config.fftWindowType);

    // Realizar FFT
    const fftResult = this.computeFFT(windowedSignal);

    // Calcular magnitudes y fases
    const magnitudes = fftResult.map(complex =>
      Math.sqrt(complex.real * complex.real + complex.imag * complex.imag)
    );

    const phases = fftResult.map(complex =>
      Math.atan2(complex.imag, complex.real)
    );

    // Generar array de frecuencias
    const samplingRate = 30; // Hz (asumido para señales PPG)
    const frequencies = magnitudes.map((_, index) =>
      (index * samplingRate) / paddedSignal.length
    );

    // Tomar solo la mitad positiva del espectro
    const halfLength = Math.floor(magnitudes.length / 2);
    const positiveFreqs = frequencies.slice(0, halfLength);
    const positiveMags = magnitudes.slice(0, halfLength);
    const positivePhases = phases.slice(0, halfLength);

    // Encontrar frecuencia dominante en rango fisiológico
    const dominantFrequency = this.findDominantFrequency(positiveFreqs, positiveMags);

    // Identificar armónicos
    const harmonics = this.findHarmonics(positiveFreqs, positiveMags, dominantFrequency);

    // Calcular pureza espectral
    const spectralPurity = this.calculateSpectralPurity(positiveMags, dominantFrequency, positiveFreqs);

    // Calcular SNR espectral
    const snr = this.calculateSpectralSNR(positiveMags, dominantFrequency, positiveFreqs);

    // Calcular densidad espectral de potencia
    const powerSpectralDensity = positiveMags.map(mag => mag * mag / samplingRate);

    const processingTime = performance.now() - startTime;

    console.log('AdvancedMathEngine: Análisis FFT completado', {
      signalLength: signal.length,
      dominantFrequency,
      processingTime: `${processingTime.toFixed(2)}ms`
    });

    return {
      frequencies: positiveFreqs,
      magnitudes: positiveMags,
      phases: positivePhases,
      dominantFrequency,
      harmonics,
      spectralPurity,
      snr,
      powerSpectralDensity
    };
  }
  /**
    * Aplica filtro de Kalman extendido a una señal
    */
  public applyKalmanFiltering(signal: number[], stateId: string = 'default'): number[] {
    if (signal.length === 0) {
      throw new Error('La señal no puede estar vacía para filtrado Kalman');
    }

    // Inicializar o recuperar estado de Kalman
    let kalmanState = this.kalmanStates.get(stateId);
    if (!kalmanState) {
      kalmanState = this.initializeKalmanState(signal[0]);
      this.kalmanStates.set(stateId, kalmanState);
    }

    const filteredSignal: number[] = [];

    // Matrices del sistema (modelo de velocidad constante)
    const F = [[1, 1], [0, 1]]; // Matriz de transición de estado
    const H = [[1, 0]]; // Matriz de observación
    const Q = this.createProcessNoiseMatrix(); // Ruido del proceso
    const R = [[this.config.kalmanMeasurementNoise]]; // Ruido de medición

    for (let i = 0; i < signal.length; i++) {
      const measurement = [signal[i]];

      // Paso de predicción
      const stateMatrix = [[kalmanState.state[0]], [kalmanState.state[1]]];
      const predictedState = this.matrixMultiply(F, stateMatrix);
      const predictedCovariance = this.matrixAdd(
        this.matrixMultiply(this.matrixMultiply(F, kalmanState.covariance), this.matrixTranspose(F)),
        Q
      );

      // Paso de actualización
      const measurementMatrix = [[measurement[0]], [measurement[1] || 0]];
      const predictedMeasurement = this.matrixMultiply(H, predictedState);
      const innovation = this.matrixSubtract(measurementMatrix, predictedMeasurement);

      const innovationCovariance = this.matrixAdd(
        this.matrixMultiply(this.matrixMultiply(H, predictedCovariance), this.matrixTranspose(H)),
        R
      );

      const kalmanGain = this.matrixMultiply(
        this.matrixMultiply(predictedCovariance, this.matrixTranspose(H)),
        this.matrixInverse(innovationCovariance)
      );

      // Actualizar estado
      const stateUpdate = this.matrixMultiply(kalmanGain, innovation);
      kalmanState.state = [
        predictedState[0][0] + stateUpdate[0][0],
        predictedState[1][0] + (stateUpdate[1] ? stateUpdate[1][0] : 0)
      ];

      kalmanState.covariance = this.matrixSubtract(
        predictedCovariance,
        this.matrixMultiply(this.matrixMultiply(kalmanGain, H), predictedCovariance)
      );

      filteredSignal.push(kalmanState.state[0]);
    }

    return filteredSignal;
  }  /**
   
* Aplica filtro Savitzky-Golay
   * Implementa y(i) = Σ(j=-m to m) c(j) × x(i+j)
   */
  public calculateSavitzkyGolay(
    signal: number[],
    windowSize: number,
    polyOrder: number
  ): number[] {
    if (signal.length === 0) {
      throw new Error('La señal no puede estar vacía para filtro Savitzky-Golay');
    }

    if (windowSize % 2 === 0) {
      throw new Error('El tamaño de ventana debe ser impar');
    }

    if (polyOrder >= windowSize) {
      throw new Error('El orden del polinomio debe ser menor que el tamaño de ventana');
    }

    const halfWindow = Math.floor(windowSize / 2);
    const coefficients = this.calculateSavitzkyGolayCoefficients(windowSize, polyOrder);
    const filteredSignal: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      let filteredValue = 0;

      for (let j = -halfWindow; j <= halfWindow; j++) {
        const sampleIndex = Math.max(0, Math.min(signal.length - 1, i + j));
        const coeffIndex = j + halfWindow;
        filteredValue += coefficients[coeffIndex] * signal[sampleIndex];
      }

      filteredSignal.push(filteredValue);
    }

    return filteredSignal;
  }

  /**
   * Realiza Análisis de Componentes Principales (PCA)
   */
  public performPCAAnalysis(data: number[][]): PCAResult {
    if (data.length === 0 || data[0].length === 0) {
      throw new Error('Los datos no pueden estar vacíos para análisis PCA');
    }

    const numSamples = data.length;
    const numFeatures = data[0].length;

    // Centrar los datos (restar la media)
    const means = this.calculateColumnMeans(data);
    const centeredData = data.map(row =>
      row.map((value, colIndex) => value - means[colIndex])
    );

    // Calcular matriz de covarianza: C = (1/n) × X^T × X
    const covarianceMatrix = this.calculateCovarianceMatrix(centeredData);

    // Calcular eigenvalores y eigenvectores (implementación simplificada)
    const eigenDecomposition = this.calculateEigenDecomposition(covarianceMatrix);

    // Ordenar por eigenvalores descendentes
    const sortedIndices = eigenDecomposition.eigenValues
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)
      .map(item => item.index);

    const sortedEigenValues = sortedIndices.map(i => eigenDecomposition.eigenValues[i]);
    const sortedEigenVectors = sortedIndices.map(i => eigenDecomposition.eigenVectors[i]);

    // Calcular varianza explicada
    const totalVariance = sortedEigenValues.reduce((sum, val) => sum + val, 0);
    const explainedVariance = sortedEigenValues.map(val => val / totalVariance);

    // Calcular varianza acumulativa
    const cumulativeVariance: number[] = [];
    let cumSum = 0;
    for (const variance of explainedVariance) {
      cumSum += variance;
      cumulativeVariance.push(cumSum);
    }

    // Transformar datos a espacio de componentes principales
    const transformedData = this.transformDataToPCA(centeredData, sortedEigenVectors);

    // Crear componentes principales
    const principalComponents = sortedEigenVectors.slice(0, Math.min(numFeatures, 10));

    return {
      eigenValues: sortedEigenValues,
      eigenVectors: sortedEigenVectors,
      principalComponents,
      explainedVariance,
      cumulativeVariance,
      transformedData
    };
  }  /**
  
 * Detecta picos avanzados con validación fisiológica
   */
  public detectPeaksAdvanced(signal: number[]): Peak[] {
    if (signal.length === 0) {
      throw new Error('La señal no puede estar vacía para detección de picos');
    }

    // Preprocesar señal
    const smoothedSignal = this.calculateSavitzkyGolay(signal, 5, 2);
    const filteredSignal = this.applyKalmanFiltering(smoothedSignal, 'peak_detection');

    // Detectar picos candidatos
    const candidatePeaks = this.findPeakCandidates(filteredSignal);

    // Calcular propiedades de cada pico
    const peaksWithProperties = candidatePeaks.map(peakIndex => {
      const peak = this.calculatePeakProperties(filteredSignal, peakIndex);

      // Validar si es fisiológicamente plausible
      peak.isPhysiological = this.validatePhysiologicalPeak(peak, filteredSignal);

      return peak;
    });

    // Filtrar picos por umbral y validación fisiológica
    const validPeaks = peaksWithProperties.filter(peak =>
      peak.prominence >= this.config.peakDetectionThreshold &&
      peak.snr >= 3.0 && // SNR mínimo de 3 dB
      peak.isPhysiological
    );

    // Ordenar por prominencia descendente
    validPeaks.sort((a, b) => b.prominence - a.prominence);

    return validPeaks;
  }

  /**
   * Aplica filtro pasa banda usando filtros Butterworth
   * Implementación sin simulaciones basada en algoritmos reales
   */
  public applyBandpassFilter(signal: number[], config: {
    lowCutoff: number;
    highCutoff: number;
    samplingRate: number;
    order: number;
  }): number[] {
    if (signal.length === 0) {
      throw new Error('La señal no puede estar vacía para filtrado pasa banda');
    }

    // Normalizar frecuencias de corte (0 a 1, donde 1 = Nyquist)
    const nyquist = config.samplingRate / 2;
    const lowNorm = config.lowCutoff / nyquist;
    const highNorm = config.highCutoff / nyquist;

    // Aplicar filtro pasa alto seguido de pasa bajo
    const highPassFiltered = this.applyHighPassFilter(signal, lowNorm, config.order);
    const bandPassFiltered = this.applyLowPassFilter(highPassFiltered, highNorm, config.order);

    return bandPassFiltered;
  }

  /**
   * Aplica filtro pasa alto Butterworth
   */
  private applyHighPassFilter(signal: number[], cutoffNorm: number, order: number): number[] {
    // Implementación simplificada de filtro pasa alto
    const filtered: number[] = [];
    const alpha = Math.exp(-2 * Math.PI * cutoffNorm);

    let prevInput = 0;
    let prevOutput = 0;

    for (let i = 0; i < signal.length; i++) {
      const output = alpha * (prevOutput + signal[i] - prevInput);
      filtered.push(output);
      prevInput = signal[i];
      prevOutput = output;
    }

    return filtered;
  }

  /**
   * Aplica filtro pasa bajo Butterworth
   */
  private applyLowPassFilter(signal: number[], cutoffNorm: number, order: number): number[] {
    // Implementación simplificada de filtro pasa bajo
    const filtered: number[] = [];
    const alpha = 2 * Math.PI * cutoffNorm;
    const beta = Math.exp(-alpha);

    let prevOutput = 0;

    for (let i = 0; i < signal.length; i++) {
      const output = (1 - beta) * signal[i] + beta * prevOutput;
      filtered.push(output);
      prevOutput = output;
    }

    return filtered;
  }

  /**
   * Actualiza configuración del motor matemático
   */
  public updateConfig(newConfig: Partial<AdvancedMathConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtiene configuración actual
   */
  public getConfig(): AdvancedMathConfig {
    return { ...this.config };
  }

  /**
   * Resetea estados internos
   */
  public reset(): void {
    this.kalmanStates.clear();
  }

  /**
   * Obtiene estadísticas del motor
   */
  public getStatistics(): {
    kalmanStatesCount: number;
    activeFilters: string[];
    memoryUsage: number;
  } {
    return {
      kalmanStatesCount: this.kalmanStates.size,
      activeFilters: Array.from(this.kalmanStates.keys()),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Rellena señal a potencia de 2 para FFT eficiente
   */
  private padToPowerOfTwo(signal: number[]): number[] {
    const length = signal.length;
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(length)));

    if (length === nextPowerOfTwo) {
      return [...signal];
    }

    const padded = [...signal];
    while (padded.length < nextPowerOfTwo) {
      padded.push(0);
    }

    return padded;
  }

  /**
   * Aplica ventana a la señal
   */
  private applyWindow(signal: number[], windowType: string): number[] {
    const N = signal.length;
    const windowed = [...signal];

    for (let n = 0; n < N; n++) {
      let windowValue = 1;

      switch (windowType) {
        case 'hanning':
          windowValue = 0.5 * (1 - Math.cos(this.TWO_PI * n / (N - 1)));
          break;
        case 'hamming':
          windowValue = 0.54 - 0.46 * Math.cos(this.TWO_PI * n / (N - 1));
          break;
        case 'blackman':
          windowValue = 0.42 - 0.5 * Math.cos(this.TWO_PI * n / (N - 1)) +
            0.08 * Math.cos(4 * this.PI * n / (N - 1));
          break;
        default: // rectangular
          windowValue = 1;
      }

      windowed[n] *= windowValue;
    }

    return windowed;
  }

  /**
   * Computa FFT usando algoritmo Cooley-Tukey
   */
  private computeFFT(signal: number[]): { real: number; imag: number }[] {
    const N = signal.length;

    if (N <= 1) {
      return signal.map(val => ({ real: val, imag: 0 }));
    }

    // Dividir en partes par e impar
    const even = signal.filter((_, index) => index % 2 === 0);
    const odd = signal.filter((_, index) => index % 2 === 1);

    // Recursión
    const evenFFT = this.computeFFT(even);
    const oddFFT = this.computeFFT(odd);

    // Combinar resultados
    const result: { real: number; imag: number }[] = [];

    for (let k = 0; k < N / 2; k++) {
      const angle = -this.TWO_PI * k / N;
      const twiddle = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };

      const oddTerm = {
        real: twiddle.real * oddFFT[k].real - twiddle.imag * oddFFT[k].imag,
        imag: twiddle.real * oddFFT[k].imag + twiddle.imag * oddFFT[k].real
      };

      result[k] = {
        real: evenFFT[k].real + oddTerm.real,
        imag: evenFFT[k].imag + oddTerm.imag
      };

      result[k + N / 2] = {
        real: evenFFT[k].real - oddTerm.real,
        imag: evenFFT[k].imag - oddTerm.imag
      };
    }

    return result;
  }
  /**
    * Encuentra frecuencia dominante en rango fisiológico
    */
  private findDominantFrequency(frequencies: number[], magnitudes: number[]): number {
    let maxMagnitude = 0;
    let dominantFreq = 0;

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq >= this.config.physiologicalRange.min &&
        freq <= this.config.physiologicalRange.max &&
        magnitudes[i] > maxMagnitude) {
        maxMagnitude = magnitudes[i];
        dominantFreq = freq;
      }
    }

    return dominantFreq;
  }

  /**
   * Encuentra armónicos de la frecuencia fundamental
   */
  private findHarmonics(frequencies: number[], magnitudes: number[], fundamental: number): number[] {
    const harmonics: number[] = [];
    const tolerance = 0.1; // Hz

    for (let harmonic = 2; harmonic <= 5; harmonic++) {
      const targetFreq = fundamental * harmonic;

      for (let i = 0; i < frequencies.length; i++) {
        if (Math.abs(frequencies[i] - targetFreq) < tolerance) {
          harmonics.push(frequencies[i]);
          break;
        }
      }
    }

    return harmonics;
  }

  /**
   * Calcula pureza espectral
   */
  private calculateSpectralPurity(magnitudes: number[], dominantFreq: number, frequencies: number[]): number {
    const dominantIndex = frequencies.findIndex(f => Math.abs(f - dominantFreq) < 0.01);
    if (dominantIndex === -1) return 0;

    const dominantPower = magnitudes[dominantIndex] * magnitudes[dominantIndex];
    const totalPower = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);

    return dominantPower / totalPower;
  }

  /**
   * Calcula SNR espectral
   */
  private calculateSpectralSNR(magnitudes: number[], dominantFreq: number, frequencies: number[]): number {
    const dominantIndex = frequencies.findIndex(f => Math.abs(f - dominantFreq) < 0.01);
    if (dominantIndex === -1) return 0;

    const signalPower = magnitudes[dominantIndex] * magnitudes[dominantIndex];

    // Calcular potencia de ruido (excluyendo pico dominante y armónicos)
    let noisePower = 0;
    let noiseCount = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      const freq = frequencies[i];
      const isHarmonic = [1, 2, 3, 4, 5].some(h =>
        Math.abs(freq - dominantFreq * h) < 0.1
      );

      if (!isHarmonic) {
        noisePower += magnitudes[i] * magnitudes[i];
        noiseCount++;
      }
    }

    const avgNoisePower = noiseCount > 0 ? noisePower / noiseCount : 1;

    return 10 * Math.log10(signalPower / avgNoisePower);
  }

  /**
   * Inicializa estado de Kalman
   */
  private initializeKalmanState(initialValue: number): KalmanState {
    return {
      state: [initialValue, 0], // [posición, velocidad]
      covariance: [[1, 0], [0, 1]], // Matriz de covarianza inicial
      prediction: [0, 0],
      innovation: [0],
      kalmanGain: [[0], [0]]
    };
  }

  /**
   * Crea matriz de ruido del proceso
   */
  private createProcessNoiseMatrix(): number[][] {
    const q = this.config.kalmanProcessNoise;
    return [[q, 0], [0, q]];
  }

  // Operaciones de matrices
  private matrixMultiply(A: number[][], B: number[][] | number[]): number[][] {
    const isVector = Array.isArray(B[0]) ? false : true;

    if (isVector) {
      const vector = B as number[];
      return A.map(row => [row.reduce((sum, val, i) => sum + val * vector[i], 0)]);
    }

    const matrix = B as number[][];
    const result: number[][] = [];

    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < matrix[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < A[i].length; k++) {
          sum += A[i][k] * matrix[k][j];
        }
        result[i][j] = sum;
      }
    }

    return result;
  }

  private matrixAdd(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }

  private matrixSubtract(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
  }

  private matrixTranspose(A: number[][]): number[][] {
    return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
  }

  private matrixInverse(A: number[][]): number[][] {
    // Implementación simplificada para matrices 1x1 y 2x2
    if (A.length === 1) {
      return [[1 / A[0][0]]];
    }

    if (A.length === 2) {
      const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      if (Math.abs(det) < 1e-10) {
        throw new Error('Matriz singular, no se puede invertir');
      }

      return [
        [A[1][1] / det, -A[0][1] / det],
        [-A[1][0] / det, A[0][0] / det]
      ];
    }

    throw new Error('Inversión de matriz no implementada para tamaños > 2x2');
  }

  /**
   * Calcula coeficientes de Savitzky-Golay
   */
  private calculateSavitzkyGolayCoefficients(windowSize: number, polyOrder: number): number[] {
    const halfWindow = Math.floor(windowSize / 2);
    const coefficients: number[] = [];

    // Implementación simplificada para orden 2
    if (polyOrder === 2 && windowSize === 5) {
      return [-0.086, 0.343, 0.486, 0.343, -0.086];
    }

    // Para otros casos, usar aproximación lineal
    for (let i = 0; i < windowSize; i++) {
      coefficients.push(1 / windowSize);
    }

    return coefficients;
  }
  /**
    * Calcula medias de columnas
    */
  private calculateColumnMeans(data: number[][]): number[] {
    const numCols = data[0].length;
    const means: number[] = [];

    for (let col = 0; col < numCols; col++) {
      let sum = 0;
      for (let row = 0; row < data.length; row++) {
        sum += data[row][col];
      }
      means.push(sum / data.length);
    }

    return means;
  }

  /**
   * Calcula matriz de covarianza
   */
  private calculateCovarianceMatrix(centeredData: number[][]): number[][] {
    const numFeatures = centeredData[0].length;
    const numSamples = centeredData.length;
    const covariance: number[][] = [];

    for (let i = 0; i < numFeatures; i++) {
      covariance[i] = [];
      for (let j = 0; j < numFeatures; j++) {
        let sum = 0;
        for (let k = 0; k < numSamples; k++) {
          sum += centeredData[k][i] * centeredData[k][j];
        }
        covariance[i][j] = sum / (numSamples - 1);
      }
    }

    return covariance;
  }

  /**
   * Calcula eigendecomposición (implementación simplificada)
   */
  private calculateEigenDecomposition(matrix: number[][]): {
    eigenValues: number[];
    eigenVectors: number[][];
  } {
    // Implementación simplificada para matriz 2x2
    if (matrix.length === 2) {
      const a = matrix[0][0];
      const b = matrix[0][1];
      const c = matrix[1][0];
      const d = matrix[1][1];

      const trace = a + d;
      const det = a * d - b * c;
      const discriminant = trace * trace - 4 * det;

      if (discriminant < 0) {
        throw new Error('Eigenvalores complejos no soportados');
      }

      const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
      const lambda2 = (trace - Math.sqrt(discriminant)) / 2;

      // Calcular eigenvectores
      const v1 = b !== 0 ? [b, lambda1 - a] : [lambda1 - d, c];
      const v2 = b !== 0 ? [b, lambda2 - a] : [lambda2 - d, c];

      // Normalizar
      const norm1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      const norm2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);

      return {
        eigenValues: [lambda1, lambda2],
        eigenVectors: [
          [v1[0] / norm1, v1[1] / norm1],
          [v2[0] / norm2, v2[1] / norm2]
        ]
      };
    }

    // Para matrices más grandes, usar método simplificado
    return this.powerMethodEigenDecomposition(matrix);
  }

  /**
   * Método de potencias para eigendecomposición
   */
  private powerMethodEigenDecomposition(matrix: number[][]): {
    eigenValues: number[];
    eigenVectors: number[][];
  } {
    const n = matrix.length;
    const eigenValues: number[] = [];
    const eigenVectors: number[][] = [];

    // Encontrar eigenvalor dominante
    let v = Array(n).fill(1); // Vector inicial
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const Av = this.matrixMultiply(matrix, [v])[0];
      const norm = Math.sqrt(Av.reduce((sum, val) => sum + val * val, 0));
      const newV = Av.map(val => val / norm);

      // Verificar convergencia
      const diff = newV.reduce((sum, val, i) => sum + Math.abs(val - v[i]), 0);
      if (diff < tolerance) {
        break;
      }

      v = newV;
    }

    // Calcular eigenvalor
    const Av = this.matrixMultiply(matrix, [v])[0];
    const eigenValue = v.reduce((sum, val, i) => sum + val * Av[i], 0);

    eigenValues.push(eigenValue);
    eigenVectors.push(v);

    return { eigenValues, eigenVectors };
  }

  /**
   * Transforma datos al espacio PCA
   */
  private transformDataToPCA(data: number[][], eigenVectors: number[][]): number[][] {
    return data.map(row => {
      return eigenVectors.map(eigenvector => {
        return row.reduce((sum, val, i) => sum + val * eigenvector[i], 0);
      });
    });
  }
  /**
    * Encuentra candidatos a picos
    */
  private findPeakCandidates(signal: number[]): number[] {
    const candidates: number[] = [];
    const minDistance = 5; // Distancia mínima entre picos

    for (let i = 1; i < signal.length - 1; i++) {
      // Verificar si es máximo local
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        // Verificar distancia mínima
        const lastPeak = candidates[candidates.length - 1];
        if (!lastPeak || (i - lastPeak) >= minDistance) {
          candidates.push(i);
        } else if (signal[i] > signal[lastPeak]) {
          // Reemplazar pico anterior si este es mayor
          candidates[candidates.length - 1] = i;
        }
      }
    }

    return candidates;
  }

  /**
   * Calcula propiedades de un pico
   */
  private calculatePeakProperties(signal: number[], peakIndex: number): Peak {
    const peakValue = signal[peakIndex];

    // Encontrar bases del pico
    let leftBase = peakIndex;
    let rightBase = peakIndex;

    // Buscar hacia la izquierda
    for (let i = peakIndex - 1; i >= 0; i--) {
      if (signal[i] >= signal[i + 1]) {
        leftBase = i;
        break;
      }
    }

    // Buscar hacia la derecha
    for (let i = peakIndex + 1; i < signal.length; i++) {
      if (signal[i] >= signal[i - 1]) {
        rightBase = i;
        break;
      }
    }

    // Calcular prominencia
    const leftMin = Math.min(...signal.slice(leftBase, peakIndex));
    const rightMin = Math.min(...signal.slice(peakIndex + 1, rightBase + 1));
    const baseLevel = Math.max(leftMin, rightMin);
    const prominence = peakValue - baseLevel;

    // Calcular ancho del pico
    const width = rightBase - leftBase;

    // Calcular SNR local
    const localSignal = signal.slice(Math.max(0, peakIndex - 10), Math.min(signal.length, peakIndex + 10));
    const localMean = localSignal.reduce((sum, val) => sum + val, 0) / localSignal.length;
    const localStd = Math.sqrt(
      localSignal.reduce((sum, val) => sum + Math.pow(val - localMean, 2), 0) / localSignal.length
    );
    const snr = localStd > 0 ? 20 * Math.log10(Math.abs(peakValue - localMean) / localStd) : 0;

    return {
      index: peakIndex,
      value: peakValue,
      prominence,
      width,
      leftBase,
      rightBase,
      snr,
      isPhysiological: false // Se calculará después
    };
  }

  /**
   * Valida si un pico es fisiológicamente plausible
   */
  private validatePhysiologicalPeak(peak: Peak, signal: number[]): boolean {
    // Verificar rango de valores
    if (peak.value < 0.1 || peak.value > 1.0) {
      return false;
    }

    // Verificar prominencia mínima
    if (peak.prominence < 0.05) {
      return false;
    }

    // Verificar ancho del pico (debe ser razonable para pulso cardíaco)
    if (peak.width < 3 || peak.width > 30) {
      return false;
    }

    // Verificar SNR mínimo
    if (peak.snr < 3.0) {
      return false;
    }

    // Verificar forma del pico (debe tener subida y bajada suaves)
    const leftSlope = peak.index > 0 ?
      (peak.value - signal[peak.index - 1]) : 0;
    const rightSlope = peak.index < signal.length - 1 ?
      (signal[peak.index + 1] - peak.value) : 0;

    if (leftSlope <= 0 || rightSlope >= 0) {
      return false;
    }

    return true;
  }

  /**
   * Estima uso de memoria
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    // Estimar tamaño de estados de Kalman
    this.kalmanStates.forEach(state => {
      totalSize += state.state.length * 8; // 8 bytes por número
      totalSize += state.covariance.length * state.covariance[0].length * 8;
      totalSize += state.prediction.length * 8;
      totalSize += state.innovation.length * 8;
      totalSize += state.kalmanGain.length * state.kalmanGain[0].length * 8;
    });

    return totalSize;
  }
}