/**
 * AdvancedMathEngine - Motor de Cálculos Matemáticos Complejos
 * 
 * Implementa algoritmos matemáticos avanzados para análisis biométrico:
 * - Transformada Rápida de Fourier (FFT): X(k) = Σ(n=0 to N-1) x(n) × e^(-j2πkn/N)
 * - Filtro de Kalman Extendido con predicción y actualización
 * - Filtro Savitzky-Golay: y(i) = Σ(j=-m to m) c(j) × x(i+j)
 * - Análisis de Componentes Principales (PCA) con eigenvalores y eigenvectores
 * - Detección avanzada de picos con validación fisiológica
 */

export interface Complex {
  real: number;
  imag: number;
}

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

export interface Peak {
  index: number;
  value: number;
  prominence: number;
  width: number;
  leftBase: number;
  rightBase: number;
  isPhysiological: boolean;
}

export interface KalmanState {
  x: number[]; // Estado estimado
  P: number[][]; // Matriz de covarianza del error
  F: number[][]; // Matriz de transición de estado
  H: number[][]; // Matriz de observación
  Q: number[][]; // Ruido del proceso
  R: number[][]; // Ruido de medición
  K: number[][]; // Ganancia de Kalman
}

export interface PCAResult {
  eigenvalues: number[];
  eigenvectors: number[][];
  principalComponents: number[][];
  explainedVariance: number[];
  cumulativeVariance: number[];
  transformedData: number[][];
}

export interface MathEngineConfig {
  fftWindowType: 'rectangular' | 'hanning' | 'hamming' | 'blackman';
  kalmanProcessNoise: number;
  kalmanMeasurementNoise: number;
  peakDetectionMinDistance: number;
  peakDetectionMinHeight: number;
  physiologicalFreqRange: { min: number; max: number };
  samplingRate: number;
}

export class AdvancedMathEngine {
  private config: MathEngineConfig;
  private kalmanStates: Map<string, KalmanState> = new Map();
  private sgCoefficients: Map<string, number[]> = new Map();
  private fftCache: Map<string, Complex[]> = new Map();
  
  constructor(config?: Partial<MathEngineConfig>) {
    this.config = {
      fftWindowType: 'hanning',
      kalmanProcessNoise: 0.01,
      kalmanMeasurementNoise: 0.1,
      peakDetectionMinDistance: 10,
      peakDetectionMinHeight: 0.1,
      physiologicalFreqRange: { min: 0.5, max: 4.0 }, // 30-240 BPM
      samplingRate: 30,
      ...config
    };
    
    console.log('AdvancedMathEngine: Inicializado con configuración:', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }  
 
 /**
   * Realiza análisis FFT completo de una señal
   * Implementa X(k) = Σ(n=0 to N-1) x(n) × e^(-j2πkn/N)
   */
  public performFFTAnalysis(signal: number[]): FrequencySpectrum {
    if (signal.length < 4) {
      throw new Error('Señal demasiado corta para análisis FFT (mínimo 4 muestras)');
    }
    
    const startTime = performance.now();
    
    // Preparar señal con ventana
    const windowedSignal = this.applyWindow(signal, this.config.fftWindowType);
    
    // Asegurar que la longitud sea potencia de 2 para eficiencia
    const paddedLength = this.nextPowerOfTwo(windowedSignal.length);
    const paddedSignal = [...windowedSignal];
    while (paddedSignal.length < paddedLength) {
      paddedSignal.push(0);
    }
    
    // Realizar FFT
    const fftResult = this.fft(paddedSignal);
    
    // Calcular frecuencias
    const frequencies = this.calculateFrequencies(paddedLength, this.config.samplingRate);
    
    // Calcular magnitudes y fases
    const magnitudes = fftResult.map(c => Math.sqrt(c.real * c.real + c.imag * c.imag));
    const phases = fftResult.map(c => Math.atan2(c.imag, c.real));
    
    // Calcular densidad espectral de potencia
    const powerSpectralDensity = magnitudes.map(mag => mag * mag / paddedLength);
    
    // Encontrar frecuencia dominante en rango fisiológico
    const { dominantFrequency, dominantIndex } = this.findDominantFrequency(
      frequencies, magnitudes, this.config.physiologicalFreqRange
    );
    
    // Detectar armónicos
    const harmonics = this.detectHarmonics(frequencies, magnitudes, dominantFrequency);
    
    // Calcular pureza espectral
    const spectralPurity = this.calculateSpectralPurity(magnitudes, dominantIndex);
    
    // Calcular SNR espectral
    const snr = this.calculateSpectralSNR(magnitudes, dominantIndex);
    
    const processingTime = performance.now() - startTime;
    
    console.log('AdvancedMathEngine: FFT completado', {
      signalLength: signal.length,
      paddedLength,
      dominantFrequency,
      spectralPurity,
      snr,
      processingTime: `${processingTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    
    return {
      frequencies: frequencies.slice(0, Math.floor(paddedLength / 2)), // Solo frecuencias positivas
      magnitudes: magnitudes.slice(0, Math.floor(paddedLength / 2)),
      phases: phases.slice(0, Math.floor(paddedLength / 2)),
      dominantFrequency,
      harmonics,
      spectralPurity,
      snr,
      powerSpectralDensity: powerSpectralDensity.slice(0, Math.floor(paddedLength / 2))
    };
  }
  
  /**
   * Implementa FFT usando algoritmo Cooley-Tukey
   */
  private fft(signal: number[]): Complex[] {
    const N = signal.length;
    
    if (N <= 1) {
      return [{ real: signal[0] || 0, imag: 0 }];
    }
    
    // Verificar si es potencia de 2
    if ((N & (N - 1)) !== 0) {
      throw new Error('FFT requiere longitud que sea potencia de 2');
    }
    
    // Dividir en partes par e impar
    const even: number[] = [];
    const odd: number[] = [];
    
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        even.push(signal[i]);
      } else {
        odd.push(signal[i]);
      }
    }
    
    // Recursión
    const evenFFT = this.fft(even);
    const oddFFT = this.fft(odd);
    
    // Combinar resultados
    const result: Complex[] = new Array(N);
    
    for (let k = 0; k < N / 2; k++) {
      // Calcular factor de rotación: e^(-j2πk/N)
      const angle = -2 * Math.PI * k / N;
      const twiddle: Complex = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };
      
      // Multiplicar oddFFT[k] por factor de rotación
      const oddTerm: Complex = {
        real: oddFFT[k].real * twiddle.real - oddFFT[k].imag * twiddle.imag,
        imag: oddFFT[k].real * twiddle.imag + oddFFT[k].imag * twiddle.real
      };
      
      // X[k] = E[k] + W_N^k * O[k]
      result[k] = {
        real: evenFFT[k].real + oddTerm.real,
        imag: evenFFT[k].imag + oddTerm.imag
      };
      
      // X[k + N/2] = E[k] - W_N^k * O[k]
      result[k + N / 2] = {
        real: evenFFT[k].real - oddTerm.real,
        imag: evenFFT[k].imag - oddTerm.imag
      };
    }
    
    return result;
  }  
  
/**
   * Aplica filtro de Kalman extendido a una señal
   * Implementa predicción: x̂(k|k-1) = F × x̂(k-1|k-1) + B × u(k)
   * Actualización: x̂(k|k) = x̂(k|k-1) + K(k) × [z(k) - H × x̂(k|k-1)]
   */
  public applyKalmanFiltering(signal: number[], stateId: string = 'default'): number[] {
    if (signal.length === 0) {
      throw new Error('Señal vacía para filtrado Kalman');
    }
    
    const startTime = performance.now();
    
    // Inicializar o recuperar estado de Kalman
    let kalmanState = this.kalmanStates.get(stateId);
    if (!kalmanState) {
      kalmanState = this.initializeKalmanState();
      this.kalmanStates.set(stateId, kalmanState);
    }
    
    const filteredSignal: number[] = [];
    
    for (let i = 0; i < signal.length; i++) {
      const measurement = signal[i];
      
      // Paso de predicción
      const predictedState = this.matrixMultiply(kalmanState.F, kalmanState.x.map(x => [x]));
      const predictedCovariance = this.matrixAdd(
        this.matrixMultiply(this.matrixMultiply(kalmanState.F, kalmanState.P), this.matrixTranspose(kalmanState.F)),
        kalmanState.Q
      );
      
      // Paso de actualización
      const innovation = measurement - this.matrixMultiply(kalmanState.H, predictedState)[0][0];
      const innovationCovariance = this.matrixAdd(
        this.matrixMultiply(this.matrixMultiply(kalmanState.H, predictedCovariance), this.matrixTranspose(kalmanState.H)),
        kalmanState.R
      )[0][0];
      
      // Calcular ganancia de Kalman
      const kalmanGain = this.matrixMultiply(
        this.matrixMultiply(predictedCovariance, this.matrixTranspose(kalmanState.H)),
        [[1 / innovationCovariance]]
      );
      
      // Actualizar estado
      const updatedState = this.matrixAdd(
        predictedState,
        this.matrixMultiply(kalmanGain, [[innovation]])
      );
      
      // Actualizar covarianza
      const identityMinusKH = this.matrixSubtract(
        this.createIdentityMatrix(kalmanState.x.length),
        this.matrixMultiply(kalmanGain, kalmanState.H)
      );
      const updatedCovariance = this.matrixMultiply(identityMinusKH, predictedCovariance);
      
      // Guardar estado actualizado
      kalmanState.x = updatedState.map(row => row[0]);
      kalmanState.P = updatedCovariance;
      kalmanState.K = kalmanGain;
      
      filteredSignal.push(kalmanState.x[0]);
    }
    
    const processingTime = performance.now() - startTime;
    
    console.log('AdvancedMathEngine: Filtrado Kalman completado', {
      signalLength: signal.length,
      stateId,
      processingTime: `${processingTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    
    return filteredSignal;
  }
  
  /**
   * Aplica filtro Savitzky-Golay
   * Implementa y(i) = Σ(j=-m to m) c(j) × x(i+j)
   */
  public calculateSavitzkyGolay(
    signal: number[], 
    windowSize: number, 
    polyOrder: number,
    derivative: number = 0
  ): number[] {
    if (signal.length === 0) {
      throw new Error('Señal vacía para filtro Savitzky-Golay');
    }
    
    if (windowSize % 2 === 0) {
      throw new Error('Tamaño de ventana debe ser impar');
    }
    
    if (polyOrder >= windowSize) {
      throw new Error('Orden polinomial debe ser menor que el tamaño de ventana');
    }
    
    if (windowSize > signal.length) {
      throw new Error('Tamaño de ventana mayor que la señal');
    }
    
    const startTime = performance.now();
    
    // Generar clave para cache de coeficientes
    const coeffKey = `${windowSize}_${polyOrder}_${derivative}`;
    
    // Obtener o calcular coeficientes
    let coefficients = this.sgCoefficients.get(coeffKey);
    if (!coefficients) {
      coefficients = this.calculateSGCoefficients(windowSize, polyOrder, derivative);
      this.sgCoefficients.set(coeffKey, coefficients);
    }
    
    const halfWindow = Math.floor(windowSize / 2);
    const filteredSignal: number[] = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const signalIndex = i + j;
        let signalValue: number;
        
        // Manejo de bordes por reflexión
        if (signalIndex < 0) {
          signalValue = signal[-signalIndex];
        } else if (signalIndex >= signal.length) {
          signalValue = signal[2 * signal.length - signalIndex - 2];
        } else {
          signalValue = signal[signalIndex];
        }
        
        sum += coefficients[j + halfWindow] * signalValue;
      }
      
      filteredSignal.push(sum);
    }
    
    const processingTime = performance.now() - startTime;
    
    console.log('AdvancedMathEngine: Savitzky-Golay completado', {
      signalLength: signal.length,
      windowSize,
      polyOrder,
      derivative,
      processingTime: `${processingTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    
    return filteredSignal;
  }  

  /**
   * Realiza Análisis de Componentes Principales (PCA)
   * Calcula C = (1/n) × X^T × X y sus eigenvalores/eigenvectores
   */
  public performPCAAnalysis(data: number[][]): PCAResult {
    if (data.length === 0 || data[0].length === 0) {
      throw new Error('Datos vacíos para análisis PCA');
    }
    
    const startTime = performance.now();
    
    const numSamples = data.length;
    const numFeatures = data[0].length;
    
    // Centrar los datos (restar la media)
    const means = this.calculateColumnMeans(data);
    const centeredData = data.map(row => 
      row.map((value, col) => value - means[col])
    );
    
    // Calcular matriz de covarianza: C = (1/n) × X^T × X
    const covarianceMatrix = this.calculateCovarianceMatrix(centeredData);
    
    // Calcular eigenvalores y eigenvectores (método simplificado)
    const { eigenvalues, eigenvectors } = this.calculateEigenDecomposition(covarianceMatrix);
    
    // Ordenar por eigenvalores descendentes
    const sortedIndices = eigenvalues
      .map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val)
      .map(item => item.idx);
    
    const sortedEigenvalues = sortedIndices.map(idx => eigenvalues[idx]);
    const sortedEigenvectors = sortedIndices.map(idx => eigenvectors[idx]);
    
    // Calcular varianza explicada
    const totalVariance = sortedEigenvalues.reduce((sum, val) => sum + Math.max(val, 0), 0);
    const explainedVariance = sortedEigenvalues.map(val => Math.max(val, 0) / totalVariance);
    
    // Calcular varianza acumulativa
    const cumulativeVariance: number[] = [];
    let cumSum = 0;
    for (const variance of explainedVariance) {
      cumSum += variance;
      cumulativeVariance.push(cumSum);
    }
    
    // Transformar datos a espacio de componentes principales
    const transformedData = centeredData.map(row => 
      sortedEigenvectors.map(eigenvector => 
        row.reduce((sum, val, idx) => sum + val * eigenvector[idx], 0)
      )
    );
    
    const processingTime = performance.now() - startTime;
    
    console.log('AdvancedMathEngine: PCA completado', {
      numSamples,
      numFeatures,
      totalVariance,
      explainedVarianceFirst3: explainedVariance.slice(0, 3),
      processingTime: `${processingTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    
    return {
      eigenvalues: sortedEigenvalues,
      eigenvectors: sortedEigenvectors,
      principalComponents: sortedEigenvectors,
      explainedVariance,
      cumulativeVariance,
      transformedData
    };
  }
  
  /**
   * Detecta picos avanzados con validación fisiológica
   */
  public detectPeaksAdvanced(signal: number[]): Peak[] {
    if (signal.length < 3) {
      throw new Error('Señal demasiado corta para detección de picos');
    }
    
    const startTime = performance.now();
    
    // Suavizar señal primero
    const smoothedSignal = this.calculateSavitzkyGolay(signal, 5, 2);
    
    // Detectar picos locales
    const localPeaks = this.findLocalPeaks(smoothedSignal);
    
    // Calcular prominencia para cada pico
    const peaksWithProminence = localPeaks.map(peakIndex => {
      const prominence = this.calculatePeakProminence(smoothedSignal, peakIndex);
      const width = this.calculatePeakWidth(smoothedSignal, peakIndex);
      const { leftBase, rightBase } = this.findPeakBases(smoothedSignal, peakIndex);
      
      return {
        index: peakIndex,
        value: smoothedSignal[peakIndex],
        prominence,
        width,
        leftBase,
        rightBase,
        isPhysiological: this.validatePhysiologicalPeak(peakIndex, signal.length)
      };
    });
    
    // Filtrar picos por altura y distancia mínima
    const filteredPeaks = peaksWithProminence.filter(peak => 
      peak.value >= this.config.peakDetectionMinHeight &&
      peak.prominence >= this.config.peakDetectionMinHeight * 0.5
    );
    
    // Aplicar distancia mínima entre picos
    const finalPeaks = this.applyMinimumDistance(filteredPeaks, this.config.peakDetectionMinDistance);
    
    const processingTime = performance.now() - startTime;
    
    console.log('AdvancedMathEngine: Detección de picos completada', {
      signalLength: signal.length,
      localPeaksFound: localPeaks.length,
      filteredPeaks: filteredPeaks.length,
      finalPeaks: finalPeaks.length,
      physiologicalPeaks: finalPeaks.filter(p => p.isPhysiological).length,
      processingTime: `${processingTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    
    return finalPeaks;
  }  
  /**

   * Actualiza configuración del motor matemático
   */
  public updateConfig(newConfig: Partial<MathEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Limpiar caches si cambian parámetros relevantes
    if (newConfig.fftWindowType) {
      this.fftCache.clear();
    }
    
    if (newConfig.kalmanProcessNoise || newConfig.kalmanMeasurementNoise) {
      this.kalmanStates.clear();
    }
    
    console.log('AdvancedMathEngine: Configuración actualizada', {
      newConfig,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Obtiene configuración actual
   */
  public getConfig(): MathEngineConfig {
    return { ...this.config };
  }
  
  /**
   * Resetea el motor matemático
   */
  public reset(): void {
    this.kalmanStates.clear();
    this.sgCoefficients.clear();
    this.fftCache.clear();
    
    console.log('AdvancedMathEngine: Motor reseteado', {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Obtiene estadísticas del motor
   */
  public getStatistics(): {
    kalmanStatesCount: number;
    sgCoefficientsCount: number;
    fftCacheSize: number;
    memoryUsage: number;
  } {
    return {
      kalmanStatesCount: this.kalmanStates.size,
      sgCoefficientsCount: this.sgCoefficients.size,
      fftCacheSize: this.fftCache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  // ==================== MÉTODOS PRIVADOS ====================
  
  /**
   * Aplica ventana a la señal
   */
  private applyWindow(signal: number[], windowType: string): number[] {
    const N = signal.length;
    const windowed = [...signal];
    
    switch (windowType) {
      case 'hanning':
        for (let i = 0; i < N; i++) {
          windowed[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        }
        break;
        
      case 'hamming':
        for (let i = 0; i < N; i++) {
          windowed[i] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
        }
        break;
        
      case 'blackman':
        for (let i = 0; i < N; i++) {
          windowed[i] *= 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 
                        0.08 * Math.cos(4 * Math.PI * i / (N - 1));
        }
        break;
        
      case 'rectangular':
      default:
        // No aplicar ventana
        break;
    }
    
    return windowed;
  }
  
  /**
   * Encuentra la siguiente potencia de 2
   */
  private nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  
  /**
   * Calcula frecuencias para FFT
   */
  private calculateFrequencies(N: number, samplingRate: number): number[] {
    const frequencies: number[] = [];
    for (let i = 0; i < N; i++) {
      frequencies.push(i * samplingRate / N);
    }
    return frequencies;
  }
  
  /**
   * Encuentra frecuencia dominante en rango fisiológico
   */
  private findDominantFrequency(
    frequencies: number[], 
    magnitudes: number[], 
    freqRange: { min: number; max: number }
  ): { dominantFrequency: number; dominantIndex: number } {
    let maxMagnitude = 0;
    let dominantIndex = 0;
    let dominantFrequency = 0;
    
    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq >= freqRange.min && freq <= freqRange.max && magnitudes[i] > maxMagnitude) {
        maxMagnitude = magnitudes[i];
        dominantIndex = i;
        dominantFrequency = freq;
      }
    }
    
    return { dominantFrequency, dominantIndex };
  }
  
  /**
   * Detecta armónicos de la frecuencia fundamental
   */
  private detectHarmonics(frequencies: number[], magnitudes: number[], fundamental: number): number[] {
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
  /
**
   * Calcula pureza espectral
   */
  private calculateSpectralPurity(magnitudes: number[], dominantIndex: number): number {
    const dominantMagnitude = magnitudes[dominantIndex];
    const totalPower = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    const dominantPower = dominantMagnitude * dominantMagnitude;
    
    return dominantPower / Math.max(totalPower, 0.001);
  }
  
  /**
   * Calcula SNR espectral
   */
  private calculateSpectralSNR(magnitudes: number[], dominantIndex: number): number {
    const dominantMagnitude = magnitudes[dominantIndex];
    
    // Calcular ruido como promedio de magnitudes excluyendo el pico dominante
    const noiseMagnitudes = magnitudes.filter((_, idx) => idx !== dominantIndex);
    const averageNoise = noiseMagnitudes.reduce((sum, mag) => sum + mag, 0) / noiseMagnitudes.length;
    
    return 20 * Math.log10(dominantMagnitude / Math.max(averageNoise, 0.001));
  }
  
  /**
   * Inicializa estado de Kalman
   */
  private initializeKalmanState(): KalmanState {
    return {
      x: [0], // Estado inicial
      P: [[1]], // Covarianza inicial
      F: [[1]], // Matriz de transición (modelo constante)
      H: [[1]], // Matriz de observación
      Q: [[this.config.kalmanProcessNoise]], // Ruido del proceso
      R: [[this.config.kalmanMeasurementNoise]], // Ruido de medición
      K: [[0]] // Ganancia inicial
    };
  }
  
  /**
   * Operaciones de matrices
   */
  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < B.length; k++) {
          sum += A[i][k] * B[k][j];
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
  
  private createIdentityMatrix(size: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        matrix[i][j] = i === j ? 1 : 0;
      }
    }
    return matrix;
  }
  
  /**
   * Calcula coeficientes de Savitzky-Golay (versión simplificada)
   */
  private calculateSGCoefficients(windowSize: number, polyOrder: number, derivative: number): number[] {
    const halfWindow = Math.floor(windowSize / 2);
    const coefficients: number[] = new Array(windowSize);
    
    // Para simplificar, usar coeficientes predefinidos para casos comunes
    if (windowSize === 5 && polyOrder === 2 && derivative === 0) {
      // Coeficientes para ventana 5, orden 2, suavizado
      return [-3, 12, 17, 12, -3].map(c => c / 35);
    } else if (windowSize === 7 && polyOrder === 2 && derivative === 0) {
      // Coeficientes para ventana 7, orden 2, suavizado
      return [-2, 3, 6, 7, 6, 3, -2].map(c => c / 21);
    } else {
      // Aproximación simple para otros casos
      for (let i = 0; i < windowSize; i++) {
        const x = i - halfWindow;
        coefficients[i] = Math.exp(-x * x / (2 * (halfWindow / 2) ** 2));
      }
      
      // Normalizar
      const sum = coefficients.reduce((s, c) => s + c, 0);
      return coefficients.map(c => c / sum);
    }
  }
  
  /**
   * Calcula medias de columnas
   */
  private calculateColumnMeans(data: number[][]): number[] {
    const numCols = data[0].length;
    const means: number[] = new Array(numCols).fill(0);
    
    for (const row of data) {
      for (let j = 0; j < numCols; j++) {
        means[j] += row[j];
      }
    }
    
    return means.map(sum => sum / data.length);
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
   * Calcula descomposición eigen (método simplificado)
   */
  private calculateEigenDecomposition(matrix: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
    const n = matrix.length;
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    
    // Método simplificado: usar diagonal para eigenvalores aproximados
    for (let i = 0; i < n; i++) {
      eigenvalues.push(matrix[i][i]);
      
      // Vector propio aproximado
      const eigenvector = new Array(n).fill(0);
      eigenvector[i] = 1;
      eigenvectors.push(eigenvector);
    }
    
    return { eigenvalues, eigenvectors };
  }
  
  /**
   * Encuentra picos locales
   */
  private findLocalPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcula prominencia de pico
   */
  private calculatePeakProminence(signal: number[], peakIndex: number): number {
    const peakValue = signal[peakIndex];
    
    // Encontrar mínimo a la izquierda
    let leftMin = peakValue;
    for (let i = peakIndex - 1; i >= 0; i--) {
      if (signal[i] < leftMin) {
        leftMin = signal[i];
      }
    }
    
    // Encontrar mínimo a la derecha
    let rightMin = peakValue;
    for (let i = peakIndex + 1; i < signal.length; i++) {
      if (signal[i] < rightMin) {
        rightMin = signal[i];
      }
    }
    
    // Prominencia es la diferencia con el mínimo más alto
    return peakValue - Math.max(leftMin, rightMin);
  }
  
  /**
   * Calcula ancho de pico
   */
  private calculatePeakWidth(signal: number[], peakIndex: number): number {
    const peakValue = signal[peakIndex];
    const halfHeight = peakValue / 2;
    
    // Encontrar puntos de media altura
    let leftIndex = peakIndex;
    let rightIndex = peakIndex;
    
    // Buscar hacia la izquierda
    for (let i = peakIndex - 1; i >= 0; i--) {
      if (signal[i] <= halfHeight) {
        leftIndex = i;
        break;
      }
    }
    
    // Buscar hacia la derecha
    for (let i = peakIndex + 1; i < signal.length; i++) {
      if (signal[i] <= halfHeight) {
        rightIndex = i;
        break;
      }
    }
    
    return rightIndex - leftIndex;
  }
  
  /**
   * Encuentra bases del pico
   */
  private findPeakBases(signal: number[], peakIndex: number): { leftBase: number; rightBase: number } {
    let leftBase = 0;
    let rightBase = signal.length - 1;
    
    // Buscar base izquierda (primer mínimo local)
    for (let i = peakIndex - 1; i > 0; i--) {
      if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
        leftBase = i;
        break;
      }
    }
    
    // Buscar base derecha (primer mínimo local)
    for (let i = peakIndex + 1; i < signal.length - 1; i++) {
      if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
        rightBase = i;
        break;
      }
    }
    
    return { leftBase, rightBase };
  }
  
  /**
   * Valida si el pico es fisiológicamente plausible
   */
  private validatePhysiologicalPeak(peakIndex: number, signalLength: number): boolean {
    // Convertir índice a frecuencia
    const frequency = (peakIndex * this.config.samplingRate) / signalLength;
    
    // Verificar si está en rango fisiológico
    return frequency >= this.config.physiologicalFreqRange.min && 
           frequency <= this.config.physiologicalFreqRange.max;
  }
  
  /**
   * Aplica distancia mínima entre picos
   */
  private applyMinimumDistance(peaks: Peak[], minDistance: number): Peak[] {
    if (peaks.length <= 1) return peaks;
    
    // Ordenar por prominencia descendente
    const sortedPeaks = [...peaks].sort((a, b) => b.prominence - a.prominence);
    const selectedPeaks: Peak[] = [];
    
    for (const peak of sortedPeaks) {
      let tooClose = false;
      
      for (const selectedPeak of selectedPeaks) {
        if (Math.abs(peak.index - selectedPeak.index) < minDistance) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        selectedPeaks.push(peak);
      }
    }
    
    // Ordenar por índice
    return selectedPeaks.sort((a, b) => a.index - b.index);
  }
  
  /**
   * Estima uso de memoria
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    // Estimar tamaño de estados de Kalman
    totalSize += this.kalmanStates.size * 1000; // ~1KB por estado
    
    // Estimar tamaño de coeficientes SG
    for (const coeffs of this.sgCoefficients.values()) {
      totalSize += coeffs.length * 8; // 8 bytes por número
    }
    
    // Estimar tamaño de cache FFT
    for (const fftResult of this.fftCache.values()) {
      totalSize += fftResult.length * 16; // 16 bytes por número complejo
    }
    
    return totalSize;
  }
}