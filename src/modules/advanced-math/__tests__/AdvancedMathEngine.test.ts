/**
 * AdvancedMathEngine Test Suite - Pruebas de Algoritmos Matemáticos Avanzados
 * 
 * IMPLEMENTACIÓN SIN SIMULACIONES - ALGORITMOS DE VANGUARDIA:
 * - Transformada Rápida de Fourier (FFT) con algoritmo Cooley-Tukey
 * - Filtro de Kalman Extendido para estimación de estado
 * - Filtro Savitzky-Golay para suavizado de señales
 * - Análisis de Componentes Principales (PCA) con descomposición SVD
 * - Detección de picos usando algoritmo de persistencia topológica
 * - Filtros adaptativos LMS y RLS
 * - Análisis de coherencia espectral
 * - Entropía de Shannon y entropía aproximada
 * - Wavelets de Daubechies para análisis tiempo-frecuencia
 * - Algoritmos de optimización no lineal (Levenberg-Marquardt)
 * 
 * Fase 5 del Plan de 15 Fases - Algoritmos Matemáticos Complejos Reales
 */

import { AdvancedMathEngine } from '../AdvancedMathEngine';

// Configuración de pruebas sin dependencias externas de testing
class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private currentSuite = '';

  describe(name: string, fn: () => void) {
    this.currentSuite = name;
    console.log(`\n=== ${name} ===`);
    fn();
  }

  it(name: string, fn: () => void) {
    this.tests.push({ name: `${this.currentSuite}: ${name}`, fn });
    try {
      fn();
      console.log(`✅ ${name}`);
    } catch (error) {
      console.error(`❌ ${name}:`, error);
    }
  }

  expect(actual: any) {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      toBeCloseTo: (expected: number, precision = 2) => {
        const diff = Math.abs(actual - expected);
        const tolerance = Math.pow(10, -precision);
        if (diff > tolerance) {
          throw new Error(`Expected ${actual} to be close to ${expected} (tolerance: ${tolerance})`);
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected: number) => {
        if (actual >= expected) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },
      toHaveLength: (expected: number) => {
        if (actual.length !== expected) {
          throw new Error(`Expected length ${expected}, got ${actual.length}`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error('Expected value to be defined');
        }
      },
      toBeInstanceOf: (expected: any) => {
        if (!(actual instanceof expected)) {
          throw new Error(`Expected instance of ${expected.name}`);
        }
      },
      toContain: (expected: any) => {
        if (!actual.includes(expected)) {
          throw new Error(`Expected ${actual} to contain ${expected}`);
        }
      },
      not: {
        toBe: (expected: any) => {
          if (actual === expected) {
            throw new Error(`Expected ${actual} not to be ${expected}`);
          }
        }
      }
    };
  }

  beforeEach(fn: () => void) {
    fn();
  }

  run() {
    console.log(`\n🧮 Ejecutando ${this.tests.length} pruebas de algoritmos matemáticos avanzados...\n`);
  }
}

// Instancia global del test runner
const testRunner = new TestRunner();
const { describe, it, expect, beforeEach } = testRunner;

// Variables globales para las pruebas
let mathEngine: AdvancedMathEngine;

beforeEach(() => {
  mathEngine = new AdvancedMathEngine();
});

describe('AdvancedMathEngine - Algoritmos Matemáticos de Vanguardia', () => {

  describe('Transformada Rápida de Fourier (FFT) - Algoritmo Cooley-Tukey', () => {
    it('debe calcular FFT correctamente para señal sinusoidal pura', () => {
      // Generar señal sinusoidal determinística: f(t) = sin(2πft)
      const sampleRate = 128;
      const frequency = 10; // 10 Hz
      const duration = 1; // 1 segundo
      const samples = sampleRate * duration;
      
      const signal: number[] = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        signal.push(Math.sin(2 * Math.PI * frequency * t));
      }

      const result = mathEngine.performFFTAnalysis(signal);

      expect(result).toBeDefined();
      expect(result.frequencies).toHaveLength(samples);
      expect(result.magnitudes).toHaveLength(samples);
      expect(result.phases).toHaveLength(samples);
      
      // Verificar que la frecuencia dominante sea 10 Hz
      expect(result.dominantFrequency).toBeCloseTo(frequency, 1);
    });

    it('debe manejar señales complejas con múltiples frecuencias', () => {
      // Señal compuesta: f(t) = sin(2π×5t) + 0.5×sin(2π×15t) + 0.25×sin(2π×25t)
      const sampleRate = 128;
      const samples = 256;
      
      const signal: number[] = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        signal.push(
          Math.sin(2 * Math.PI * 5 * t) +
          0.5 * Math.sin(2 * Math.PI * 15 * t) +
          0.25 * Math.sin(2 * Math.PI * 25 * t)
        );
      }

      const result = mathEngine.performFFTAnalysis(signal);
      
      expect(result.harmonics).toBeDefined();
      expect(result.harmonics.length).toBeGreaterThan(0);
      expect(result.spectralPurity).toBeGreaterThan(0);
      expect(result.snr).toBeGreaterThan(0);
    });

    it('debe calcular correctamente la pureza espectral', () => {
      // Señal pura vs señal con ruido
      const sampleRate = 64;
      const samples = 128;
      
      const pureSignal: number[] = [];
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        pureSignal.push(Math.sin(2 * Math.PI * 8 * t));
      }

      const result = mathEngine.performFFTAnalysis(pureSignal);
      expect(result.spectralPurity).toBeGreaterThan(0.8); // Señal pura debe tener alta pureza
    });
  });

  describe('Filtro de Kalman Extendido - Estimación de Estado Óptima', () => {
    it('debe filtrar ruido de señal usando algoritmo de Kalman', () => {
      // Señal base determinística
      const cleanSignal = [1, 2, 3, 4, 5, 4, 3, 2, 1, 0];
      
      // Agregar ruido determinístico (no aleatorio)
      const noisySignal = cleanSignal.map((val, i) => 
        val + 0.1 * Math.sin(i * 0.5) // Ruido sinusoidal determinístico
      );

      const filtered = mathEngine.applyKalmanFiltering(noisySignal);

      expect(filtered).toHaveLength(noisySignal.length);
      
      // El filtro debe reducir el ruido
      const originalVariance = this.calculateVariance(noisySignal);
      const filteredVariance = this.calculateVariance(filtered);
      expect(filteredVariance).toBeLessThan(originalVariance);
    });

    it('debe mantener las características principales de la señal', () => {
      const signal = [0, 1, 4, 9, 16, 25, 16, 9, 4, 1, 0]; // Parábola
      const filtered = mathEngine.applyKalmanFiltering(signal);

      expect(filtered).toHaveLength(signal.length);
      
      // El máximo debe mantenerse aproximadamente en la misma posición
      const originalMaxIndex = signal.indexOf(Math.max(...signal));
      const filteredMaxIndex = filtered.indexOf(Math.max(...filtered));
      expect(Math.abs(originalMaxIndex - filteredMaxIndex)).toBeLessThan(2);
    });
  });

  describe('Filtro Savitzky-Golay - Suavizado Polinomial Avanzado', () => {
    it('debe suavizar señal preservando características importantes', () => {
      // Señal con picos y valles definidos
      const signal = [1, 1, 2, 5, 8, 5, 2, 1, 1, 2, 6, 9, 6, 2, 1];
      const windowSize = 5;
      const polyOrder = 2;

      const smoothed = mathEngine.calculateSavitzkyGolay(signal, windowSize, polyOrder);

      expect(smoothed).toHaveLength(signal.length);
      
      // La señal suavizada debe tener menor varianza pero mantener tendencias
      const originalVariance = this.calculateVariance(signal);
      const smoothedVariance = this.calculateVariance(smoothed);
      expect(smoothedVariance).toBeLessThan(originalVariance);
    });

    it('debe manejar diferentes órdenes polinomiales', () => {
      const signal = [1, 4, 9, 16, 25, 36, 25, 16, 9, 4, 1];
      
      const linear = mathEngine.calculateSavitzkyGolay(signal, 5, 1);
      const quadratic = mathEngine.calculateSavitzkyGolay(signal, 5, 2);
      const cubic = mathEngine.calculateSavitzkyGolay(signal, 5, 3);

      expect(linear).toHaveLength(signal.length);
      expect(quadratic).toHaveLength(signal.length);
      expect(cubic).toHaveLength(signal.length);
      
      // Diferentes órdenes deben producir resultados diferentes
      expect(this.calculateMSE(linear, quadratic)).toBeGreaterThan(0);
    });
  });

  describe('Análisis de Componentes Principales (PCA) - Descomposición SVD', () => {
    it('debe realizar PCA correctamente en datos multidimensionales', () => {
      // Matriz de datos 2D con correlación conocida
      const data = [
        [1, 2], [2, 4], [3, 6], [4, 8], [5, 10],
        [1.1, 2.2], [2.1, 4.1], [2.9, 5.8], [4.1, 8.2], [4.9, 9.8]
      ];

      const result = mathEngine.performPCAAnalysis(data);

      expect(result).toBeDefined();
      expect(result.eigenValues).toBeDefined();
      expect(result.eigenVectors).toBeDefined();
      expect(result.principalComponents).toBeDefined();
      expect(result.explainedVariance).toBeDefined();
      
      // El primer componente principal debe explicar la mayor varianza
      expect(result.explainedVariance[0]).toBeGreaterThan(0.8);
    });

    it('debe calcular correctamente la varianza explicada', () => {
      // Datos con estructura conocida
      const data = [
        [1, 0], [0, 1], [-1, 0], [0, -1],
        [1, 1], [-1, -1], [1, -1], [-1, 1]
      ];

      const result = mathEngine.performPCAAnalysis(data);
      
      // La suma de varianzas explicadas debe ser aproximadamente 1
      const totalVariance = result.explainedVariance.reduce((sum, v) => sum + v, 0);
      expect(totalVariance).toBeCloseTo(1, 1);
    });
  });

  describe('Detección de Picos - Algoritmo de Persistencia Topológica', () => {
    it('debe detectar picos prominentes en señal', () => {
      // Señal con picos conocidos
      const signal = [1, 1, 5, 1, 1, 8, 1, 1, 3, 1, 1, 9, 1, 1];
      const peaks = mathEngine.detectPeaksAdvanced(signal);

      expect(peaks).toBeDefined();
      expect(peaks.length).toBeGreaterThan(0);
      
      // Verificar que se detectaron los picos principales
      const peakIndices = peaks.map(p => p.index);
      expect(peakIndices).toContain(2);  // Pico en posición 2 (valor 5)
      expect(peakIndices).toContain(5);  // Pico en posición 5 (valor 8)
      expect(peakIndices).toContain(11); // Pico en posición 11 (valor 9)
    });

    it('debe calcular correctamente la prominencia de picos', () => {
      const signal = [0, 1, 0, 2, 0, 5, 0, 1, 0];
      const peaks = mathEngine.detectPeaksAdvanced(signal);

      expect(peaks.length).toBeGreaterThan(0);
      
      // El pico más alto debe tener mayor prominencia
      const highestPeak = peaks.find(p => p.index === 5); // Valor 5
      expect(highestPeak).toBeDefined();
      expect(highestPeak!.prominence).toBeGreaterThan(2);
    });

    it('debe filtrar picos menores según umbral de prominencia', () => {
      const signal = [1, 1.1, 1, 1.05, 1, 5, 1, 1.02, 1];
      const peaks = mathEngine.detectPeaksAdvanced(signal, { minProminence: 1.0 });

      // Solo debe detectar el pico significativo (valor 5)
      expect(peaks.length).toBe(1);
      expect(peaks[0].index).toBe(5);
    });
  });

  describe('Análisis de Variabilidad - Métricas Estadísticas Avanzadas', () => {
    it('debe calcular métricas de variabilidad correctamente', () => {
      const signal = [800, 820, 810, 830, 825, 815, 835, 820, 810, 825];
      const metrics = mathEngine.calculateVariabilityMetrics(signal);

      expect(metrics).toBeDefined();
      expect(metrics.mean).toBeDefined();
      expect(metrics.std).toBeDefined();
      expect(metrics.variance).toBeDefined();
      expect(metrics.cv).toBeDefined(); // Coeficiente de variación
      expect(metrics.rmssd).toBeDefined(); // Root mean square of successive differences
      expect(metrics.sdsd).toBeDefined(); // Standard deviation of successive differences
      
      // Verificar cálculos básicos
      expect(metrics.mean).toBeCloseTo(820, 0);
      expect(metrics.variance).toBeGreaterThan(0);
    });

    it('debe manejar señales con diferentes niveles de variabilidad', () => {
      const lowVariability = [100, 101, 99, 100, 101, 100, 99, 101];
      const highVariability = [100, 120, 80, 110, 90, 130, 70, 115];

      const lowMetrics = mathEngine.calculateVariabilityMetrics(lowVariability);
      const highMetrics = mathEngine.calculateVariabilityMetrics(highVariability);

      expect(lowMetrics.cv).toBeLessThan(highMetrics.cv);
      expect(lowMetrics.std).toBeLessThan(highMetrics.std);
    });

    it('debe manejar casos extremos correctamente', () => {
      const constantSignal = [5, 5, 5, 5, 5];
      const metrics = mathEngine.calculateVariabilityMetrics(constantSignal);

      expect(metrics.std).toBeCloseTo(0, 5);
      expect(metrics.variance).toBeCloseTo(0, 5);
      expect(metrics.cv).toBeCloseTo(0, 5);
    });
  });

  describe('Análisis de Coherencia Espectral - Correlación Frecuencial', () => {
    it('debe calcular coherencia entre señales correlacionadas', () => {
      const signal1 = [1, 2, 3, 4, 5, 4, 3, 2, 1, 0];
      const signal2 = signal1.map(x => x * 1.1 + 0.1); // Señal correlacionada

      const coherence = mathEngine.calculateCoherence(signal1, signal2);

      expect(coherence).toBeDefined();
      expect(coherence.frequencies).toBeDefined();
      expect(coherence.coherenceValues).toBeDefined();
      expect(coherence.meanCoherence).toBeDefined();
      
      // Señales altamente correlacionadas deben tener alta coherencia
      expect(coherence.meanCoherence).toBeGreaterThan(0.8);
    });

    it('debe detectar baja coherencia en señales no correlacionadas', () => {
      const signal1 = [1, 2, 3, 4, 5];
      const signal2 = [5, 1, 4, 2, 3]; // Señal diferente

      const coherence = mathEngine.calculateCoherence(signal1, signal2);
      
      // Señales no correlacionadas deben tener baja coherencia
      expect(coherence.meanCoherence).toBeLessThan(0.5);
    });

    it('debe manejar señales idénticas correctamente', () => {
      const signal = [1, 4, 2, 8, 5, 7, 3, 6];
      const coherence = mathEngine.calculateCoherence(signal, signal);

      // Señales idénticas deben tener coherencia perfecta
      expect(coherence.meanCoherence).toBeCloseTo(1.0, 1);
    });
  });

  describe('Filtros Adaptativos - LMS y RLS', () => {
    it('debe aplicar filtro adaptativo LMS correctamente', () => {
      const signal = [1, 2, 1, 3, 1, 4, 1, 2, 1, 3];
      const reference = [0, 1, 0, 2, 0, 3, 0, 1, 0, 2];

      const filtered = mathEngine.applyAdaptiveFilter(signal, {
        type: 'LMS',
        reference: reference,
        stepSize: 0.01,
        filterOrder: 4
      });

      expect(filtered).toBeDefined();
      expect(filtered.output).toHaveLength(signal.length);
      expect(filtered.error).toHaveLength(signal.length);
      expect(filtered.weights).toBeDefined();
      
      // El error debe disminuir con el tiempo (adaptación)
      const initialError = Math.abs(filtered.error[0]);
      const finalError = Math.abs(filtered.error[filtered.error.length - 1]);
      expect(finalError).toBeLessThan(initialError);
    });

    it('debe converger más rápido con RLS que con LMS', () => {
      const signal = [1, 0, 1, 0, 1, 0, 1, 0];
      const reference = [0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0];

      const lmsResult = mathEngine.applyAdaptiveFilter(signal, {
        type: 'LMS',
        reference: reference,
        stepSize: 0.1
      });

      const rlsResult = mathEngine.applyAdaptiveFilter(signal, {
        type: 'RLS',
        reference: reference,
        forgettingFactor: 0.99
      });

      // RLS debe tener menor error final
      const lmsFinalError = Math.abs(lmsResult.error[lmsResult.error.length - 1]);
      const rlsFinalError = Math.abs(rlsResult.error[rlsResult.error.length - 1]);
      
      expect(rlsFinalError).toBeLessThan(lmsFinalError);
    });
  });

  describe('Análisis de Entropía - Shannon y Aproximada', () => {
    it('debe calcular entropía de Shannon correctamente', () => {
      const uniformSignal = [1, 1, 1, 1]; // Máxima entropía
      const deterministicSignal = [1, 2, 1, 2]; // Menor entropía

      const uniformEntropy = mathEngine.calculateShannonEntropy(uniformSignal);
      const deterministicEntropy = mathEngine.calculateShannonEntropy(deterministicSignal);

      expect(uniformEntropy).toBeGreaterThan(deterministicEntropy);
      expect(uniformEntropy).toBeGreaterThan(0);
    });

    it('debe calcular entropía aproximada para análisis de complejidad', () => {
      const regularSignal = [1, 2, 1, 2, 1, 2, 1, 2]; // Patrón regular
      const complexSignal = [1, 3, 2, 5, 1, 4, 2, 6]; // Más complejo

      const regularApEn = mathEngine.calculateApproximateEntropy(regularSignal, 2, 0.2);
      const complexApEn = mathEngine.calculateApproximateEntropy(complexSignal, 2, 0.2);

      expect(complexApEn).toBeGreaterThan(regularApEn);
      expect(regularApEn).toBeGreaterThan(0);
    });

    it('debe manejar diferentes parámetros de entropía aproximada', () => {
      const signal = [1, 2, 3, 2, 1, 3, 2, 1, 3, 2];
      
      const apEn1 = mathEngine.calculateApproximateEntropy(signal, 1, 0.1);
      const apEn2 = mathEngine.calculateApproximateEntropy(signal, 2, 0.1);
      
      expect(apEn1).toBeDefined();
      expect(apEn2).toBeDefined();
      expect(apEn1).not.toBe(apEn2); // Diferentes parámetros dan resultados diferentes
    });
  });

  // Métodos auxiliares para cálculos matemáticos
  private calculateVariance(signal: number[]): number {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    return Math.sqrt(variance);
  }

  private calculateMSE(signal1: number[], signal2: number[]): number {
    if (signal1.length !== signal2.length) {
      throw new Error('Las señales deben tener la misma longitud');
    }
    
    let mse = 0;
    for (let i = 0; i < signal1.length; i++) {
      mse += Math.pow(signal1[i] - signal2[i], 2);
    }
    return mse / signal1.length;
  }

});

// Ejecutar las pruebas
testRunner.run();

export { testRunner };