/**
 * Pruebas unitarias para AdvancedMathEngine
 * Verifica el funcionamiento correcto de todos los algoritmos matemáticos complejos
 */

import { AdvancedMathEngine, FrequencySpectrum, PCAResult, Peak } from '../AdvancedMathEngine';

// Helper para crear señales de prueba determinísticas
const createSinusoidalSignal = (length: number, frequency: number, amplitude: number = 1, phase: number = 0): number[] => {
  const signal: number[] = [];
  for (let i = 0; i < length; i++) {
    signal.push(amplitude * Math.sin(2 * Math.PI * frequency * i / length + phase));
  }
  return signal;
};

const createNoiseSignal = (length: number, seed: number = 12345): number[] => {
  const signal: number[] = [];
  let currentSeed = seed;
  
  for (let i = 0; i < length; i++) {
    // Generador pseudoaleatorio determinístico
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const noise = (currentSeed / 233280) - 0.5;
    signal.push(noise);
  }
  
  return signal;
};

const createPulseSignal = (length: number, pulseWidth: number = 10): number[] => {
  const signal = Array(length).fill(0);
  const pulsePositions = [20, 50, 80, 110, 140]; // Posiciones de pulsos
  
  pulsePositions.forEach(pos => {
    for (let i = 0; i < pulseWidth && pos + i < length; i++) {
      signal[pos + i] = 1.0 * Math.exp(-Math.pow(i - pulseWidth/2, 2) / (2 * Math.pow(pulseWidth/4, 2)));
    }
  });
  
  return signal;
};

describe('AdvancedMathEngine', () => {
  let mathEngine: AdvancedMathEngine;
  
  beforeEach(() => {
    mathEngine = new AdvancedMathEngine({
      fftWindowType: 'hanning',
      kalmanProcessNoise: 0.01,
      kalmanMeasurementNoise: 0.1,
      peakDetectionThreshold: 0.3,
      physiologicalRange: { min: 0.5, max: 4.0 },
      spectralAnalysisDepth: 7
    });
  });
  
  describe('Constructor y Configuración', () => {
    it('debe inicializarse con configuración por defecto', () => {
      const defaultEngine = new AdvancedMathEngine();
      const config = defaultEngine.getConfig();
      
      expect(config.fftWindowType).toBe('hanning');
      expect(config.kalmanProcessNoise).toBe(0.01);
      expect(config.kalmanMeasurementNoise).toBe(0.1);
      expect(config.peakDetectionThreshold).toBe(0.3);
    });
    
    it('debe aceptar configuración personalizada', () => {
      const customConfig = {
        fftWindowType: 'blackman' as const,
        kalmanProcessNoise: 0.05,
        peakDetectionThreshold: 0.5
      };
      
      const customEngine = new AdvancedMathEngine(customConfig);
      const config = customEngine.getConfig();
      
      expect(config.fftWindowType).toBe('blackman');
      expect(config.kalmanProcessNoise).toBe(0.05);
      expect(config.peakDetectionThreshold).toBe(0.5);
    });
    
    it('debe actualizar configuración correctamente', () => {
      const newConfig = { kalmanProcessNoise: 0.02 };
      mathEngine.updateConfig(newConfig);
      
      const config = mathEngine.getConfig();
      expect(config.kalmanProcessNoise).toBe(0.02);
    });
  });
  
  describe('performFFTAnalysis', () => {
    it('debe realizar análisis FFT de señal sinusoidal', () => {
      // Crear señal sinusoidal con frecuencia conocida
      const frequency = 2; // 2 Hz
      const signal = createSinusoidalSignal(64, frequency, 1.0);
      
      const spectrum = mathEngine.performFFTAnalysis(signal);
      
      expect(spectrum).toBeDefined();
      expect(spectrum.frequencies).toHaveLength(32); // Mitad del espectro
      expect(spectrum.magnitudes).toHaveLength(32);
      expect(spectrum.phases).toHaveLength(32);
      expect(spectrum.dominantFrequency).toBeCloseTo(frequency, 0.5);
    });
    
    it('debe manejar señales vacías', () => {
      expect(() => mathEngine.performFFTAnalysis([])).toThrow('La señal no puede estar vacía para análisis FFT');
    });
    
    it('debe identificar armónicos correctamente', () => {
      // Crear señal con fundamental y armónicos
      const fundamental = 1.5; // 1.5 Hz
      const signal1 = createSinusoidalSignal(128, fundamental, 1.0);
      const signal2 = createSinusoidalSignal(128, fundamental * 2, 0.5); // Segundo armónico
      const combinedSignal = signal1.map((val, i) => val + signal2[i]);
      
      const spectrum = mathEngine.performFFTAnalysis(combinedSignal);
      
      expect(spectrum.dominantFrequency).toBeCloseTo(fundamental, 0.2);
      expect(spectrum.harmonics.length).toBeGreaterThan(0);
    });
    
    it('debe calcular pureza espectral', () => {
      const pureSignal = createSinusoidalSignal(64, 2.0, 1.0);
      const noisySignal = pureSignal.map((val, i) => val + createNoiseSignal(1, i + 1000)[0] * 0.1);
      
      const pureSpectrum = mathEngine.performFFTAnalysis(pureSignal);
      const noisySpectrum = mathEngine.performFFTAnalysis(noisySignal);
      
      expect(pureSpectrum.spectralPurity).toBeGreaterThan(noisySpectrum.spectralPurity);
      expect(pureSpectrum.snr).toBeGreaterThan(noisySpectrum.snr);
    });
    
    it('debe aplicar diferentes tipos de ventana', () => {
      const signal = createSinusoidalSignal(32, 1.0);
      
      const windowTypes: Array<'rectangular' | 'hanning' | 'hamming' | 'blackman'> = 
        ['rectangular', 'hanning', 'hamming', 'blackman'];
      
      windowTypes.forEach(windowType => {
        mathEngine.updateConfig({ fftWindowType: windowType });
        const spectrum = mathEngine.performFFTAnalysis(signal);
        
        expect(spectrum).toBeDefined();
        expect(spectrum.dominantFrequency).toBeGreaterThan(0);
      });
    });
  });
  
  describe('applyKalmanFiltering', () => {
    it('debe filtrar señal ruidosa', () => {
      const cleanSignal = createSinusoidalSignal(50, 1.0, 1.0);
      const noise = createNoiseSignal(50, 54321);
      const noisySignal = cleanSignal.map((val, i) => val + noise[i] * 0.3);
      
      const filteredSignal = mathEngine.applyKalmanFiltering(noisySignal);
      
      expect(filteredSignal).toHaveLength(noisySignal.length);
      
      // El filtro debe reducir la varianza
      const noisyVariance = this.calculateVariance(noisySignal);
      const filteredVariance = this.calculateVariance(filteredSignal);
      
      expect(filteredVariance).toBeLessThan(noisyVariance);
    });
    
    it('debe manejar múltiples estados de Kalman', () => {
      const signal1 = createSinusoidalSignal(30, 1.0);
      const signal2 = createSinusoidalSignal(30, 2.0);
      
      const filtered1 = mathEngine.applyKalmanFiltering(signal1, 'state1');
      const filtered2 = mathEngine.applyKalmanFiltering(signal2, 'state2');
      
      expect(filtered1).toHaveLength(30);
      expect(filtered2).toHaveLength(30);
      
      const stats = mathEngine.getStatistics();
      expect(stats.kalmanStatesCount).toBe(2);
      expect(stats.activeFilters).toContain('state1');
      expect(stats.activeFilters).toContain('state2');
    });
    
    it('debe manejar señales vacías', () => {
      expect(() => mathEngine.applyKalmanFiltering([])).toThrow('La señal no puede estar vacía para filtrado Kalman');
    });
    
    it('debe mantener estado entre llamadas', () => {
      const signal1 = [1, 2, 3, 4, 5];
      const signal2 = [6, 7, 8, 9, 10];
      
      const filtered1 = mathEngine.applyKalmanFiltering(signal1, 'persistent');
      const filtered2 = mathEngine.applyKalmanFiltering(signal2, 'persistent');
      
      expect(filtered1).toHaveLength(5);
      expect(filtered2).toHaveLength(5);
      
      // El segundo filtrado debe usar el estado del primero
      const stats = mathEngine.getStatistics();
      expect(stats.kalmanStatesCount).toBe(1);
    });
  });
  
  describe('calculateSavitzkyGolay', () => {
    it('debe suavizar señal ruidosa', () => {
      const cleanSignal = createSinusoidalSignal(50, 1.0);
      const noise = createNoiseSignal(50, 98765);
      const noisySignal = cleanSignal.map((val, i) => val + noise[i] * 0.2);
      
      const smoothedSignal = mathEngine.calculateSavitzkyGolay(noisySignal, 5, 2);
      
      expect(smoothedSignal).toHaveLength(noisySignal.length);
      
      // La señal suavizada debe tener menor varianza
      const noisyVariance = this.calculateVariance(noisySignal);
      const smoothedVariance = this.calculateVariance(smoothedSignal);
      
      expect(smoothedVariance).toBeLessThan(noisyVariance);
    });
    
    it('debe validar parámetros de entrada', () => {
      const signal = [1, 2, 3, 4, 5];
      
      // Tamaño de ventana par
      expect(() => mathEngine.calculateSavitzkyGolay(signal, 4, 2)).toThrow('El tamaño de ventana debe ser impar');
      
      // Orden polinomial muy alto
      expect(() => mathEngine.calculateSavitzkyGolay(signal, 5, 5)).toThrow('El orden del polinomio debe ser menor que el tamaño de ventana');
      
      // Señal vacía
      expect(() => mathEngine.calculateSavitzkyGolay([], 5, 2)).toThrow('La señal no puede estar vacía para filtro Savitzky-Golay');
    });
    
    it('debe preservar tendencias en la señal', () => {
      // Crear señal con tendencia lineal
      const trendSignal = Array(20).fill(0).map((_, i) => i * 0.1);
      const smoothedSignal = mathEngine.calculateSavitzkyGolay(trendSignal, 5, 2);
      
      expect(smoothedSignal).toHaveLength(20);
      
      // La tendencia debe preservarse
      const originalSlope = (trendSignal[19] - trendSignal[0]) / 19;
      const smoothedSlope = (smoothedSignal[19] - smoothedSignal[0]) / 19;
      
      expect(Math.abs(smoothedSlope - originalSlope)).toBeLessThan(0.01);
    });
  });
  
  describe('performPCAAnalysis', () => {
    it('debe realizar análisis PCA en datos 2D', () => {
      // Crear datos correlacionados
      const data: number[][] = [];
      for (let i = 0; i < 50; i++) {
        const x = i * 0.1;
        const y = x * 2 + createNoiseSignal(1, i + 2000)[0] * 0.1;
        data.push([x, y]);
      }
      
      const pcaResult = mathEngine.performPCAAnalysis(data);
      
      expect(pcaResult).toBeDefined();
      expect(pcaResult.eigenValues).toHaveLength(2);
      expect(pcaResult.eigenVectors).toHaveLength(2);
      expect(pcaResult.explainedVariance).toHaveLength(2);
      expect(pcaResult.cumulativeVariance).toHaveLength(2);
      
      // La primera componente debe explicar la mayor varianza
      expect(pcaResult.explainedVariance[0]).toBeGreaterThan(pcaResult.explainedVariance[1]);
      
      // La varianza acumulativa debe ser creciente
      expect(pcaResult.cumulativeVariance[1]).toBeGreaterThan(pcaResult.cumulativeVariance[0]);
      expect(pcaResult.cumulativeVariance[1]).toBeCloseTo(1.0, 1);
    });
    
    it('debe manejar datos vacíos', () => {
      expect(() => mathEngine.performPCAAnalysis([])).toThrow('Los datos no pueden estar vacíos para análisis PCA');
      expect(() => mathEngine.performPCAAnalysis([[]])).toThrow('Los datos no pueden estar vacíos para análisis PCA');
    });
    
    it('debe centrar los datos correctamente', () => {
      const data = [[1, 2], [3, 4], [5, 6]];
      const pcaResult = mathEngine.performPCAAnalysis(data);
      
      expect(pcaResult.transformedData).toBeDefined();
      expect(pcaResult.transformedData).toHaveLength(3);
      
      // Los datos transformados deben estar centrados
      const transformedMeans = [0, 1].map(col => {
        const sum = pcaResult.transformedData.reduce((s, row) => s + row[col], 0);
        return sum / pcaResult.transformedData.length;
      });
      
      transformedMeans.forEach(mean => {
        expect(Math.abs(mean)).toBeLessThan(1e-10);
      });
    });
  });
  
  describe('detectPeaksAdvanced', () => {
    it('debe detectar picos en señal de pulso', () => {
      const pulseSignal = createPulseSignal(200, 8);
      const peaks = mathEngine.detectPeaksAdvanced(pulseSignal);
      
      expect(peaks.length).toBeGreaterThan(0);
      
      peaks.forEach(peak => {
        expect(peak.index).toBeGreaterThanOrEqual(0);
        expect(peak.index).toBeLessThan(pulseSignal.length);
        expect(peak.value).toBeGreaterThan(0);
        expect(peak.prominence).toBeGreaterThan(0);
        expect(peak.width).toBeGreaterThan(0);
        expect(peak.snr).toBeGreaterThan(0);
      });
    });
    
    it('debe validar picos fisiológicamente', () => {
      const pulseSignal = createPulseSignal(150, 6);
      const peaks = mathEngine.detectPeaksAdvanced(pulseSignal);
      
      // Todos los picos detectados deben ser fisiológicamente válidos
      peaks.forEach(peak => {
        expect(peak.isPhysiological).toBe(true);
        expect(peak.prominence).toBeGreaterThanOrEqual(mathEngine.getConfig().peakDetectionThreshold);
        expect(peak.snr).toBeGreaterThanOrEqual(3.0);
      });
    });
    
    it('debe filtrar picos por umbral', () => {
      const weakPulseSignal = createPulseSignal(100, 4).map(val => val * 0.2); // Pulsos débiles
      
      // Configurar umbral alto
      mathEngine.updateConfig({ peakDetectionThreshold: 0.5 });
      const peaks = mathEngine.detectPeaksAdvanced(weakPulseSignal);
      
      // No debe detectar picos débiles
      expect(peaks.length).toBe(0);
    });
    
    it('debe manejar señales vacías', () => {
      expect(() => mathEngine.detectPeaksAdvanced([])).toThrow('La señal no puede estar vacía para detección de picos');
    });
    
    it('debe ordenar picos por prominencia', () => {
      const signal = createPulseSignal(120, 10);
      // Añadir un pico más prominente
      signal[60] = 1.5;
      signal[61] = 1.8;
      signal[62] = 1.5;
      
      const peaks = mathEngine.detectPeaksAdvanced(signal);
      
      if (peaks.length > 1) {
        // Los picos deben estar ordenados por prominencia descendente
        for (let i = 1; i < peaks.length; i++) {
          expect(peaks[i - 1].prominence).toBeGreaterThanOrEqual(peaks[i].prominence);
        }
      }
    });
  });
  
  describe('Reset y Estadísticas', () => {
    it('debe resetear estados correctamente', () => {
      // Crear algunos estados
      const signal1 = [1, 2, 3, 4, 5];
      const signal2 = [6, 7, 8, 9, 10];
      
      mathEngine.applyKalmanFiltering(signal1, 'test1');
      mathEngine.applyKalmanFiltering(signal2, 'test2');
      
      let stats = mathEngine.getStatistics();
      expect(stats.kalmanStatesCount).toBe(2);
      
      // Resetear
      mathEngine.reset();
      
      stats = mathEngine.getStatistics();
      expect(stats.kalmanStatesCount).toBe(0);
      expect(stats.activeFilters).toHaveLength(0);
    });
    
    it('debe proporcionar estadísticas correctas', () => {
      const signal = [1, 2, 3, 4, 5];
      mathEngine.applyKalmanFiltering(signal, 'stats_test');
      
      const stats = mathEngine.getStatistics();
      
      expect(stats.kalmanStatesCount).toBe(1);
      expect(stats.activeFilters).toContain('stats_test');
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });
  
  describe('Integración de Algoritmos', () => {
    it('debe integrar FFT y detección de picos', () => {
      // Crear señal compleja con múltiples componentes
      const signal1 = createSinusoidalSignal(128, 1.2, 1.0); // Componente principal
      const signal2 = createSinusoidalSignal(128, 2.4, 0.3); // Armónico
      const noise = createNoiseSignal(128, 11111);
      
      const complexSignal = signal1.map((val, i) => val + signal2[i] + noise[i] * 0.1);
      
      // Análisis FFT
      const spectrum = mathEngine.performFFTAnalysis(complexSignal);
      expect(spectrum.dominantFrequency).toBeCloseTo(1.2, 0.3);
      
      // Detección de picos en señal filtrada
      const filteredSignal = mathEngine.applyKalmanFiltering(complexSignal);
      const peaks = mathEngine.detectPeaksAdvanced(filteredSignal);
      
      expect(peaks.length).toBeGreaterThan(0);
    });
    
    it('debe mantener coherencia entre filtros', () => {
      const originalSignal = createSinusoidalSignal(64, 1.5, 1.0);
      const noisySignal = originalSignal.map((val, i) => val + createNoiseSignal(1, i + 5000)[0] * 0.2);
      
      // Aplicar diferentes filtros
      const kalmanFiltered = mathEngine.applyKalmanFiltering(noisySignal);
      const savgolFiltered = mathEngine.calculateSavitzkyGolay(noisySignal, 5, 2);
      
      // Ambos filtros deben reducir el ruido
      const originalVariance = this.calculateVariance(noisySignal);
      const kalmanVariance = this.calculateVariance(kalmanFiltered);
      const savgolVariance = this.calculateVariance(savgolFiltered);
      
      expect(kalmanVariance).toBeLessThan(originalVariance);
      expect(savgolVariance).toBeLessThan(originalVariance);
    });
  });
  
  // Helper method para calcular varianza
  private calculateVariance(signal: number[]): number {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    return variance;
  }
});