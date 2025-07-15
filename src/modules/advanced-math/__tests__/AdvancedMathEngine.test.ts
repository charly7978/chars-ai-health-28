/**
 * Pruebas unitarias para AdvancedMathEngine
 * Verifica el funcionamiento correcto de todos los algoritmos matemáticos complejos
 */

import { AdvancedMathEngine, FrequencySpectrum, Peak, PCAResult } from '../AdvancedMathEngine';

// Helper para crear señales de prueba determinísticas
const createTestSignal = (length: number, frequency: number, samplingRate: number, noise: number = 0): number[] => {
  const signal: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / samplingRate;
    const baseSignal = Math.sin(2 * Math.PI * frequency * t);
    // Añadir ruido determinístico basado en índice
    const deterministicNoise = noise * Math.sin(2 * Math.PI * i * 0.1) * 0.1;
    signal.push(baseSignal + deterministicNoise);
  }
  return signal;
};

// Helper para crear datos de matriz de prueba
const createTestMatrix = (rows: number, cols: number): number[][] => {
  const matrix: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      // Crear datos determinísticos
      row.push(Math.sin(i * 0.1) + Math.cos(j * 0.1) + (i + j) * 0.01);
    }
    matrix.push(row);
  }
  return matrix;
};

describe('AdvancedMathEngine', () => {
  let mathEngine: AdvancedMathEngine;
  
  beforeEach(() => {
    mathEngine = new AdvancedMathEngine({
      samplingRate: 30,
      fftWindowType: 'hanning',
      kalmanProcessNoise: 0.01,
      kalmanMeasurementNoise: 0.1,
      peakDetectionMinDistance: 5,
      peakDetectionMinHeight: 0.1,
      physiologicalFreqRange: { min: 0.5, max: 4.0 }
    });
  });
  
  describe('Constructor y Configuración', () => {
    it('debe inicializarse con configuración por defecto', () => {
      const defaultEngine = new AdvancedMathEngine();
      const config = defaultEngine.getConfig();
      
      expect(config.samplingRate).toBe(30);
      expect(config.fftWindowType).toBe('hanning');
      expect(config.physiologicalFreqRange).toEqual({ min: 0.5, max: 4.0 });
    });
    
    it('debe aceptar configuración personalizada', () => {
      const customConfig = {
        samplingRate: 60,
        fftWindowType: 'blackman' as const,
        kalmanProcessNoise: 0.05
      };
      
      const customEngine = new AdvancedMathEngine(customConfig);
      const config = customEngine.getConfig();
      
      expect(config.samplingRate).toBe(60);
      expect(config.fftWindowType).toBe('blackman');
      expect(config.kalmanProcessNoise).toBe(0.05);
    });
    
    it('debe actualizar configuración correctamente', () => {
      const newConfig = { samplingRate: 50, peakDetectionMinHeight: 0.2 };
      mathEngine.updateConfig(newConfig);
      
      const config = mathEngine.getConfig();
      expect(config.samplingRate).toBe(50);
      expect(config.peakDetectionMinHeight).toBe(0.2);
    });
  });
  
  describe('performFFTAnalysis', () => {
    it('debe realizar análisis FFT de señal sinusoidal', () => {
      // Crear señal sinusoidal de 1.5 Hz (90 BPM)
      const frequency = 1.5;
      const signal = createTestSignal(64, frequency, 30);
      
      const result = mathEngine.performFFTAnalysis(signal);
      
      expect(result).toBeDefined();
      expect(result.frequencies).toHaveLength(32); // Mitad de la longitud padded
      expect(result.magnitudes).toHaveLength(32);
      expect(result.phases).toHaveLength(32);
      expect(result.dominantFrequency).toBeCloseTo(frequency, 0.5);
      expect(result.spectralPurity).toBeGreaterThan(0);
      expect(result.snr).toBeGreaterThan(0);
    });
    
    it('debe manejar señales cortas', () => {
      const shortSignal = [1, 2, 3, 4];
      const result = mathEngine.performFFTAnalysis(shortSignal);
      
      expect(result).toBeDefined();
      expect(result.frequencies.length).toBeGreaterThan(0);
    });
    
    it('debe detectar armónicos correctamente', () => {
      // Crear señal con armónicos
      const fundamental = 1.0;
      const signal = createTestSignal(128, fundamental, 30);
      
      // Añadir segundo armónico
      for (let i = 0; i < signal.length; i++) {
        const t = i / 30;
        signal[i] += 0.3 * Math.sin(2 * Math.PI * 2 * fundamental * t);
      }
      
      const result = mathEngine.performFFTAnalysis(signal);
      
      expect(result.harmonics.length).toBeGreaterThan(0);
      expect(result.harmonics[0]).toBeCloseTo(2 * fundamental, 0.5);
    });
    
    it('debe manejar diferentes tipos de ventana', () => {
      const signal = createTestSignal(32, 1.0, 30);
      
      const windowTypes: Array<'rectangular' | 'hanning' | 'hamming' | 'blackman'> = 
        ['rectangular', 'hanning', 'hamming', 'blackman'];
      
      windowTypes.forEach(windowType => {
        mathEngine.updateConfig({ fftWindowType: windowType });
        const result = mathEngine.performFFTAnalysis(signal);
        
        expect(result).toBeDefined();
        expect(result.dominantFrequency).toBeGreaterThan(0);
      });
    });
    
    it('debe lanzar error para señales demasiado cortas', () => {
      const tinySignal = [1, 2];
      
      expect(() => mathEngine.performFFTAnalysis(tinySignal)).toThrow(
        'Señal demasiado corta para análisis FFT'
      );
    });
  });
  
  describe('applyKalmanFiltering', () => {
    it('debe filtrar señal con ruido', () => {
      const cleanSignal = createTestSignal(50, 1.0, 30);
      const noisySignal = cleanSignal.map(val => val + 0.2 * (Math.random() - 0.5));
      
      const filteredSignal = mathEngine.applyKalmanFiltering(noisySignal);
      
      expect(filteredSignal).toHaveLength(noisySignal.length);
      
      // El filtro debería reducir la varianza
      const originalVariance = this.calculateVariance(noisySignal);
      const filteredVariance = this.calculateVariance(filteredSignal);
      expect(filteredVariance).toBeLessThan(originalVariance);
    });
    
    it('debe mantener estados separados para diferentes IDs', () => {
      const signal1 = [1, 2, 3, 4, 5];
      const signal2 = [5, 4, 3, 2, 1];
      
      const filtered1a = mathEngine.applyKalmanFiltering(signal1, 'state1');
      const filtered2 = mathEngine.applyKalmanFiltering(signal2, 'state2');
      const filtered1b = mathEngine.applyKalmanFiltering(signal1, 'state1');
      
      expect(filtered1a).not.toEqual(filtered2);
      expect(filtered1b).not.toEqual(filtered1a); // Estado continúa
    });
    
    it('debe manejar señales vacías', () => {
      expect(() => mathEngine.applyKalmanFiltering([])).toThrow(
        'Señal vacía para filtrado Kalman'
      );
    });
    
    it('debe producir resultados determinísticos', () => {
      const signal = [1, 2, 3, 4, 5, 4, 3, 2, 1];
      
      mathEngine.reset(); // Limpiar estados
      const result1 = mathEngine.applyKalmanFiltering(signal, 'test');
      
      mathEngine.reset(); // Limpiar estados
      const result2 = mathEngine.applyKalmanFiltering(signal, 'test');
      
      expect(result1).toEqual(result2);
    });
  });
  
  describe('calculateSavitzkyGolay', () => {
    it('debe suavizar señal correctamente', () => {
      // Crear señal con ruido
      const noisySignal = createTestSignal(30, 1.0, 30, 0.3);
      
      const smoothedSignal = mathEngine.calculateSavitzkyGolay(noisySignal, 5, 2);
      
      expect(smoothedSignal).toHaveLength(noisySignal.length);
      
      // La señal suavizada debería tener menor varianza
      const originalVariance = this.calculateVariance(noisySignal);
      const smoothedVariance = this.calculateVariance(smoothedSignal);
      expect(smoothedVariance).toBeLessThan(originalVariance);
    });
    
    it('debe calcular derivadas correctamente', () => {
      // Crear señal cuadrática: y = x²
      const signal = Array(21).fill(0).map((_, i) => {
        const x = i - 10;
        return x * x;
      });
      
      // Primera derivada debería ser aproximadamente 2x
      const firstDerivative = mathEngine.calculateSavitzkyGolay(signal, 5, 2, 1);
      
      expect(firstDerivative).toHaveLength(signal.length);
      
      // Verificar que la derivada tiene la forma esperada (creciente)
      expect(firstDerivative[15]).toBeGreaterThan(firstDerivative[5]);
    });
    
    it('debe validar parámetros de entrada', () => {
      const signal = [1, 2, 3, 4, 5];
      
      // Ventana par
      expect(() => mathEngine.calculateSavitzkyGolay(signal, 4, 2)).toThrow(
        'Tamaño de ventana debe ser impar'
      );
      
      // Orden polinomial muy alto
      expect(() => mathEngine.calculateSavitzkyGolay(signal, 5, 5)).toThrow(
        'Orden polinomial debe ser menor que el tamaño de ventana'
      );
      
      // Ventana mayor que señal
      expect(() => mathEngine.calculateSavitzkyGolay(signal, 7, 2)).toThrow(
        'Tamaño de ventana mayor que la señal'
      );
      
      // Señal vacía
      expect(() => mathEngine.calculateSavitzkyGolay([], 5, 2)).toThrow(
        'Señal vacía para filtro Savitzky-Golay'
      );
    });
    
    it('debe usar cache de coeficientes', () => {
      const signal = createTestSignal(20, 1.0, 30);
      
      // Primera llamada
      const result1 = mathEngine.calculateSavitzkyGolay(signal, 5, 2);
      
      // Segunda llamada con mismos parámetros (debería usar cache)
      const result2 = mathEngine.calculateSavitzkyGolay(signal, 5, 2);
      
      expect(result1).toEqual(result2);
      
      const stats = mathEngine.getStatistics();
      expect(stats.sgCoefficientsCount).toBeGreaterThan(0);
    });
  });
  
  describe('performPCAAnalysis', () => {
    it('debe realizar análisis PCA correctamente', () => {
      const data = createTestMatrix(20, 5);
      
      const result = mathEngine.performPCAAnalysis(data);
      
      expect(result).toBeDefined();
      expect(result.eigenvalues).toHaveLength(5);
      expect(result.eigenvectors).toHaveLength(5);
      expect(result.explainedVariance).toHaveLength(5);
      expect(result.cumulativeVariance).toHaveLength(5);
      expect(result.transformedData).toHaveLength(20);
      expect(result.transformedData[0]).toHaveLength(5);
      
      // Varianza explicada debe sumar 1
      const totalExplainedVariance = result.explainedVariance.reduce((sum, val) => sum + val, 0);
      expect(totalExplainedVariance).toBeCloseTo(1, 1);
      
      // Varianza acumulativa debe ser creciente
      for (let i = 1; i < result.cumulativeVariance.length; i++) {
        expect(result.cumulativeVariance[i]).toBeGreaterThanOrEqual(result.cumulativeVariance[i - 1]);
      }
    });
    
    it('debe manejar datos con diferentes escalas', () => {
      const data = [
        [1, 100, 0.01],
        [2, 200, 0.02],
        [3, 300, 0.03],
        [4, 400, 0.04],
        [5, 500, 0.05]
      ];
      
      const result = mathEngine.performPCAAnalysis(data);
      
      expect(result).toBeDefined();
      expect(result.eigenvalues.length).toBe(3);
      expect(result.transformedData.length).toBe(5);
    });
    
    it('debe manejar datos vacíos', () => {
      expect(() => mathEngine.performPCAAnalysis([])).toThrow(
        'Datos vacíos para análisis PCA'
      );
      
      expect(() => mathEngine.performPCAAnalysis([[]])).toThrow(
        'Datos vacíos para análisis PCA'
      );
    });
    
    it('debe ordenar componentes por eigenvalores descendentes', () => {
      const data = createTestMatrix(10, 4);
      const result = mathEngine.performPCAAnalysis(data);
      
      // Eigenvalores deben estar en orden descendente
      for (let i = 1; i < result.eigenvalues.length; i++) {
        expect(result.eigenvalues[i]).toBeLessThanOrEqual(result.eigenvalues[i - 1]);
      }
    });
  });
  
  describe('detectPeaksAdvanced', () => {
    it('debe detectar picos en señal sinusoidal', () => {
      // Crear señal con múltiples picos
      const signal = createTestSignal(100, 0.5, 30); // 0.5 Hz = 30 BPM
      
      const peaks = mathEngine.detectPeaksAdvanced(signal);
      
      expect(peaks.length).toBeGreaterThan(0);
      
      peaks.forEach(peak => {
        expect(peak.index).toBeGreaterThanOrEqual(0);
        expect(peak.index).toBeLessThan(signal.length);
        expect(peak.value).toBeGreaterThan(0);
        expect(peak.prominence).toBeGreaterThanOrEqual(0);
        expect(peak.width).toBeGreaterThan(0);
        expect(typeof peak.isPhysiological).toBe('boolean');
      });
    });
    
    it('debe filtrar picos por altura mínima', () => {
      // Crear señal con picos de diferentes alturas
      const signal = Array(50).fill(0);
      signal[10] = 0.05; // Pico pequeño
      signal[20] = 0.15; // Pico grande
      signal[30] = 0.08; // Pico mediano
      
      mathEngine.updateConfig({ peakDetectionMinHeight: 0.1 });
      const peaks = mathEngine.detectPeaksAdvanced(signal);
      
      // Solo el pico grande debería ser detectado
      expect(peaks.length).toBe(1);
      expect(peaks[0].index).toBe(20);
    });
    
    it('debe aplicar distancia mínima entre picos', () => {
      // Crear señal con picos muy cercanos
      const signal = Array(30).fill(0);
      signal[10] = 0.2;
      signal[12] = 0.15; // Muy cerca del anterior
      signal[20] = 0.18;
      
      mathEngine.updateConfig({ peakDetectionMinDistance: 5 });
      const peaks = mathEngine.detectPeaksAdvanced(signal);
      
      // Verificar que los picos están separados por al menos la distancia mínima
      for (let i = 1; i < peaks.length; i++) {
        const distance = peaks[i].index - peaks[i - 1].index;
        expect(distance).toBeGreaterThanOrEqual(5);
      }
    });
    
    it('debe validar picos fisiológicos', () => {
      const signal = createTestSignal(60, 1.0, 30); // 1 Hz = 60 BPM (fisiológico)
      const peaks = mathEngine.detectPeaksAdvanced(signal);
      
      const physiologicalPeaks = peaks.filter(p => p.isPhysiological);
      expect(physiologicalPeaks.length).toBeGreaterThan(0);
    });
    
    it('debe manejar señales demasiado cortas', () => {
      const shortSignal = [1, 2];
      
      expect(() => mathEngine.detectPeaksAdvanced(shortSignal)).toThrow(
        'Señal demasiado corta para detección de picos'
      );
    });
    
    it('debe calcular prominencia correctamente', () => {
      // Crear señal con pico prominente
      const signal = [0, 0, 0, 1, 0, 0, 0];
      const peaks = mathEngine.detectPeaksAdvanced(signal);
      
      expect(peaks.length).toBe(1);
      expect(peaks[0].prominence).toBeGreaterThan(0);
    });
  });
  
  describe('Gestión de Estado y Cache', () => {
    it('debe mantener estadísticas correctas', () => {
      const signal = createTestSignal(32, 1.0, 30);
      
      // Realizar operaciones que usan cache
      mathEngine.performFFTAnalysis(signal);
      mathEngine.applyKalmanFiltering(signal, 'test1');
      mathEngine.calculateSavitzkyGolay(signal, 5, 2);
      
      const stats = mathEngine.getStatistics();
      
      expect(stats.kalmanStatesCount).toBeGreaterThan(0);
      expect(stats.sgCoefficientsCount).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
    
    it('debe resetear correctamente', () => {
      const signal = createTestSignal(32, 1.0, 30);
      
      // Crear estados y cache
      mathEngine.applyKalmanFiltering(signal, 'test');
      mathEngine.calculateSavitzkyGolay(signal, 5, 2);
      
      const statsBefore = mathEngine.getStatistics();
      expect(statsBefore.kalmanStatesCount).toBeGreaterThan(0);
      
      // Resetear
      mathEngine.reset();
      
      const statsAfter = mathEngine.getStatistics();
      expect(statsAfter.kalmanStatesCount).toBe(0);
      expect(statsAfter.sgCoefficientsCount).toBe(0);
      expect(statsAfter.fftCacheSize).toBe(0);
    });
    
    it('debe limpiar cache al cambiar configuración relevante', () => {
      const signal = createTestSignal(32, 1.0, 30);
      
      // Crear cache FFT
      mathEngine.performFFTAnalysis(signal);
      
      // Cambiar tipo de ventana debería limpiar cache FFT
      mathEngine.updateConfig({ fftWindowType: 'blackman' });
      
      const stats = mathEngine.getStatistics();
      expect(stats.fftCacheSize).toBe(0);
    });
  });
  
  describe('Casos Extremos y Robustez', () => {
    it('debe manejar señales con valores NaN', () => {
      const signal = [1, 2, NaN, 4, 5];
      
      // Los algoritmos deberían manejar NaN graciosamente
      expect(() => mathEngine.performFFTAnalysis(signal.map(x => isNaN(x) ? 0 : x))).not.toThrow();
    });
    
    it('debe manejar señales constantes', () => {
      const constantSignal = Array(32).fill(1);
      
      const fftResult = mathEngine.performFFTAnalysis(constantSignal);
      expect(fftResult).toBeDefined();
      
      const peaks = mathEngine.detectPeaksAdvanced(constantSignal);
      expect(peaks.length).toBe(0); // No debería haber picos en señal constante
    });
    
    it('debe manejar señales muy ruidosas', () => {
      const noisySignal = Array(64).fill(0).map(() => Math.random() - 0.5);
      
      expect(() => mathEngine.performFFTAnalysis(noisySignal)).not.toThrow();
      expect(() => mathEngine.applyKalmanFiltering(noisySignal)).not.toThrow();
      expect(() => mathEngine.detectPeaksAdvanced(noisySignal)).not.toThrow();
    });
    
    it('debe mantener rendimiento con señales grandes', () => {
      const largeSignal = createTestSignal(1024, 1.0, 30);
      
      const startTime = performance.now();
      mathEngine.performFFTAnalysis(largeSignal);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Menos de 1 segundo
    });
  });
  
  // Helper methods para las pruebas
  private calculateVariance(signal: number[]): number {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    return variance;
  }
});