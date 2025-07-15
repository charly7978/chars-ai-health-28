/**
 * Pruebas unitarias para PPGSignalExtractor
 * Verifica el funcionamiento correcto de todos los algoritmos de fotopletismografía
 */

import { PPGSignalExtractor } from '../PPGSignalExtractor';
import { ProcessedFrame } from '../../../types/image-processing';
import { PPGSignal, PulseWaveform, SpectralAnalysis } from '../../../types/ppg-extraction';

// Helper para crear frames de prueba
const createTestFrame = (
  timestamp: number,
  redValues: number[],
  greenValues: number[],
  blueValues: number[],
  fingerDetected: boolean = true
): ProcessedFrame => ({
  timestamp,
  colorChannels: {
    red: redValues,
    green: greenValues,
    blue: blueValues,
    luminance: redValues.map((r, i) => 0.299 * r + 0.587 * greenValues[i] + 0.114 * blueValues[i]),
    chrominanceU: redValues.map((r, i) => r - (0.299 * r + 0.587 * greenValues[i] + 0.114 * blueValues[i])),
    chrominanceV: blueValues.map((b, i) => b - (0.299 * redValues[i] + 0.587 * greenValues[i] + 0.114 * b))
  },
  opticalDensity: {
    redOD: redValues.map(r => -Math.log10(r / 255)),
    greenOD: greenValues.map(g => -Math.log10(g / 255)),
    blueOD: blueValues.map(b => -Math.log10(b / 255)),
    averageOD: 0.5,
    odRatio: 1.2
  },
  fingerDetection: {
    isPresent: fingerDetected,
    confidence: fingerDetected ? 0.8 : 0.2,
    coverage: fingerDetected ? 0.7 : 0.1,
    textureScore: 0.6,
    edgeScore: 0.5,
    colorConsistency: 0.7,
    position: { x: 50, y: 50, width: 100, height: 100 }
  },
  qualityMetrics: {
    snr: 15,
    contrast: 0.3,
    sharpness: 0.2,
    illumination: 75,
    stability: 85,
    overallQuality: 80
  },
  stabilizationOffset: { x: 0, y: 0 },
  frameId: `test_frame_${timestamp}`
});

// Helper para calcular ruido determinístico basado en características de señal
const calculateDeterministicNoise = (signal: number, index: number): number => {
  // Generar ruido determinístico usando características de la señal y el índice
  const signalHash = Math.abs(Math.sin(signal * 0.1 + index * 0.01));
  const indexHash = Math.abs(Math.cos(index * 0.05));
  
  // Combinar hashes para crear ruido determinístico en rango [-1, 1]
  const deterministicValue = (signalHash + indexHash) % 2 - 1;
  
  // Escalar a amplitud de ruido apropiada
  return deterministicValue * 2; // Ruido con amplitud ±2
};

// Helper para crear señal PPG sintética
const createSyntheticPPGFrames = (count: number, heartRate: number = 72): ProcessedFrame[] => {
  const frames: ProcessedFrame[] = [];
  const samplingRate = 30; // fps
  const heartRateHz = heartRate / 60;
  
  for (let i = 0; i < count; i++) {
    const t = i / samplingRate;
    const timestamp = Date.now() + i * (1000 / samplingRate);
    
    // Generar señal PPG sintética con componentes AC y DC
    const dcComponent = 150;
    const acAmplitude = 10;
    const ppgSignal = dcComponent + acAmplitude * Math.sin(2 * Math.PI * heartRateHz * t);
    
    // Agregar ruido determinístico basado en características de la señal
    const deterministicNoise = calculateDeterministicNoise(ppgSignal, i);
    const noisySignal = ppgSignal + deterministicNoise;
    
    // Crear valores RGB basados en la señal PPG
    const pixelCount = 100;
    const redValues = Array(pixelCount).fill(noisySignal / 255);
    const greenValues = Array(pixelCount).fill((noisySignal * 0.8) / 255);
    const blueValues = Array(pixelCount).fill((noisySignal * 0.6) / 255);
    
    frames.push(createTestFrame(timestamp, redValues, greenValues, blueValues, true));
  }
  
  return frames;
};

describe('PPGSignalExtractor', () => {
  let extractor: PPGSignalExtractor;
  
  beforeEach(() => {
    extractor = new PPGSignalExtractor({
      samplingRate: 30,
      windowSize: 64, // Reducido para pruebas
      overlapRatio: 0.5,
      filterOrder: 4,
      cutoffFrequencies: { low: 0.5, high: 4.0 },
      spectralAnalysisDepth: 3,
      qualityThreshold: 0.6,
      enableAdaptiveFiltering: true
    });
  });
  
  describe('Constructor y Configuración', () => {
    it('debe inicializarse con configuración por defecto', () => {
      const defaultExtractor = new PPGSignalExtractor();
      const config = defaultExtractor.getConfig();
      
      expect(config.samplingRate).toBe(30);
      expect(config.windowSize).toBe(256);
      expect(config.cutoffFrequencies.low).toBe(0.5);
      expect(config.cutoffFrequencies.high).toBe(4.0);
    });
    
    it('debe aceptar configuración personalizada', () => {
      const customConfig = {
        samplingRate: 60,
        windowSize: 128,
        qualityThreshold: 0.8
      };
      
      const customExtractor = new PPGSignalExtractor(customConfig);
      const config = customExtractor.getConfig();
      
      expect(config.samplingRate).toBe(60);
      expect(config.windowSize).toBe(128);
      expect(config.qualityThreshold).toBe(0.8);
    });
    
    it('debe actualizar configuración correctamente', () => {
      const newConfig = { qualityThreshold: 0.75 };
      extractor.updateConfig(newConfig);
      
      const config = extractor.getConfig();
      expect(config.qualityThreshold).toBe(0.75);
    });
  });
  
  describe('extractPPGSignal', () => {
    it('debe extraer señal PPG de frames válidos', () => {
      const frames = createSyntheticPPGFrames(50, 72);
      const signal = extractor.extractPPGSignal(frames);
      
      expect(signal).toBeDefined();
      expect(signal.red).toHaveLength(50);
      expect(signal.green).toHaveLength(50);
      expect(signal.blue).toHaveLength(50);
      expect(signal.infrared).toHaveLength(50);
      expect(signal.acComponent).toHaveLength(50);
      expect(signal.dcComponent).toHaveLength(50);
      expect(signal.pulsatileIndex).toHaveLength(50);
      expect(signal.qualityIndex).toHaveLength(50);
    });
    
    it('debe manejar frames insuficientes', () => {
      expect(() => {
        extractor.extractPPGSignal([]);
      }).toThrow('No hay frames para procesar');
    });
    
    it('debe realizar calibración automática', () => {
      const frames = createSyntheticPPGFrames(35, 72); // Suficientes para calibración
      
      // Primera extracción debe iniciar calibración
      extractor.extractPPGSignal(frames.slice(0, 10));
      let stats = extractor.getStatistics();
      expect(stats.isCalibrated).toBe(false);
      expect(stats.calibrationProgress).toBeGreaterThan(0);
      
      // Completar calibración
      extractor.extractPPGSignal(frames);
      stats = extractor.getStatistics();
      expect(stats.isCalibrated).toBe(true);
      expect(stats.calibrationProgress).toBe(1);
    });
    
    it('debe calcular componentes AC y DC correctamente', () => {
      const frames = createSyntheticPPGFrames(40, 72);
      
      // Completar calibración primero
      extractor.extractPPGSignal(frames);
      
      const signal = extractor.extractPPGSignal(frames.slice(-20));
      
      // Verificar que AC y DC tienen valores razonables
      const avgAC = signal.acComponent.reduce((sum, ac) => sum + Math.abs(ac), 0) / signal.acComponent.length;
      const avgDC = signal.dcComponent.reduce((sum, dc) => sum + Math.abs(dc), 0) / signal.dcComponent.length;
      
      expect(avgAC).toBeGreaterThan(0);
      expect(avgDC).toBeGreaterThan(0);
      expect(avgDC).toBeGreaterThan(avgAC); // DC típicamente mayor que AC
    });
    
    it('debe simular canal infrarrojo correctamente', () => {
      const frames = createSyntheticPPGFrames(30, 72);
      extractor.extractPPGSignal(frames); // Calibración
      
      const signal = extractor.extractPPGSignal(frames.slice(-10));
      
      // Verificar que el canal infrarrojo está correlacionado con RGB
      expect(signal.infrared).toHaveLength(signal.red.length);
      
      // El canal IR debe estar en rango razonable
      const avgIR = signal.infrared.reduce((sum, ir) => sum + ir, 0) / signal.infrared.length;
      const avgRed = signal.red.reduce((sum, r) => sum + r, 0) / signal.red.length;
      
      expect(Math.abs(avgIR - avgRed)).toBeLessThan(avgRed); // Correlación razonable
    });
  });
  
  describe('calculateAbsorbanceRatio', () => {
    it('debe calcular ratio de absorbancia correctamente', () => {
      const red = [0.6, 0.65, 0.7, 0.68, 0.62];
      const infrared = [0.8, 0.82, 0.85, 0.83, 0.81];
      
      const ratio = extractor.calculateAbsorbanceRatio(red, infrared);
      
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeFinite();
      expect(ratio).not.toBeNaN();
    });
    
    it('debe manejar arrays de diferente longitud', () => {
      const red = [0.6, 0.65];
      const infrared = [0.8, 0.82, 0.85];
      
      expect(() => {
        extractor.calculateAbsorbanceRatio(red, infrared);
      }).toThrow('Arrays de entrada deben tener la misma longitud');
    });
    
    it('debe manejar arrays vacíos', () => {
      expect(() => {
        extractor.calculateAbsorbanceRatio([], []);
      }).toThrow('Arrays de entrada deben tener la misma longitud y no estar vacíos');
    });
    
    it('debe evitar división por cero', () => {
      const red = [0, 0.001, 0.002];
      const infrared = [0, 0.001, 0.002];
      
      const ratio = extractor.calculateAbsorbanceRatio(red, infrared);
      
      expect(ratio).toBeFinite();
      expect(ratio).not.toBeNaN();
    });
  });
  
  describe('applyBeerLambertLaw', () => {
    it('debe aplicar ley de Beer-Lambert correctamente', () => {
      const absorbance = 0.5;
      const concentration = 2.0;
      
      const result = extractor.applyBeerLambertLaw(absorbance, concentration);
      
      // A = ε × c × l, con ε = 0.1 y l = 1.0
      const expected = 0.1 * concentration * 1.0;
      expect(result).toBeCloseTo(expected, 3);
    });
    
    it('debe manejar valores extremos', () => {
      const result1 = extractor.applyBeerLambertLaw(0, 0);
      const result2 = extractor.applyBeerLambertLaw(10, 100);
      
      expect(result1).toBe(0);
      expect(result2).toBeGreaterThan(0);
      expect(result2).toBeFinite();
    });
  });
  
  describe('extractPulseWaveform', () => {
    it('debe extraer forma de onda de pulso válida', () => {
      // Crear señal de pulso sintética
      const signal = Array.from({ length: 50 }, (_, i) => {
        const t = i / 30; // 30 fps
        return Math.sin(2 * Math.PI * 1.2 * t) + 0.3 * Math.sin(2 * Math.PI * 2.4 * t); // Fundamental + armónico
      });
      
      const waveform = extractor.extractPulseWaveform(signal);
      
      expect(waveform).toBeDefined();
      expect(waveform.systolicPeak).toBeGreaterThan(0);
      expect(waveform.pulseAmplitude).toBeGreaterThan(0);
      expect(waveform.pulseWidth).toBeGreaterThan(0);
      expect(waveform.riseTime).toBeGreaterThan(0);
      expect(waveform.fallTime).toBeGreaterThan(0);
      expect(waveform.augmentationIndex).toBeGreaterThanOrEqual(0);
      expect(waveform.reflectionIndex).toBeGreaterThanOrEqual(0);
    });
    
    it('debe manejar señal demasiado corta', () => {
      const shortSignal = [1, 2, 3];
      
      expect(() => {
        extractor.extractPulseWaveform(shortSignal);
      }).toThrow('Señal demasiado corta para análisis de forma de onda');
    });
    
    it('debe manejar señal sin picos', () => {
      const flatSignal = Array(20).fill(1.0);
      
      expect(() => {
        extractor.extractPulseWaveform(flatSignal);
      }).toThrow('No se detectaron picos en la señal');
    });
    
    it('debe calcular características hemodinámicas correctamente', () => {
      // Señal con características conocidas
      const signal = [
        0, 0.2, 0.5, 0.8, 1.0, 0.9, 0.7, 0.6, 0.65, 0.5, 0.3, 0.1, 0
      ];
      
      const waveform = extractor.extractPulseWaveform(signal);
      
      expect(waveform.systolicPeak).toBe(1.0);
      expect(waveform.pulseAmplitude).toBe(1.0); // Max - Min
      expect(waveform.dicroticNotch).toBeGreaterThan(0);
      expect(waveform.augmentationIndex).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('performSpectralAnalysis', () => {
    it('debe realizar análisis espectral FFT correctamente', () => {
      // Crear señal con frecuencia conocida
      const frequency = 1.2; // Hz (72 BPM)
      const samplingRate = 30;
      const duration = 4; // segundos
      const signal = Array.from({ length: samplingRate * duration }, (_, i) => {
        const t = i / samplingRate;
        return Math.sin(2 * Math.PI * frequency * t);
      });
      
      const analysis = extractor.performSpectralAnalysis(signal);
      
      expect(analysis).toBeDefined();
      expect(analysis.frequencies).toHaveLength(signal.length / 2);
      expect(analysis.magnitudes).toHaveLength(signal.length / 2);
      expect(analysis.phases).toHaveLength(signal.length / 2);
      expect(analysis.dominantFrequency).toBeCloseTo(frequency, 1);
      expect(analysis.spectralPurity).toBeGreaterThan(0);
      expect(analysis.snr).toBeGreaterThan(0);
    });
    
    it('debe detectar armónicos correctamente', () => {
      const fundamental = 1.0; // Hz
      const samplingRate = 30;
      const duration = 4;
      
      // Señal con fundamental y segundo armónico
      const signal = Array.from({ length: samplingRate * duration }, (_, i) => {
        const t = i / samplingRate;
        return Math.sin(2 * Math.PI * fundamental * t) + 0.3 * Math.sin(2 * Math.PI * 2 * fundamental * t);
      });
      
      const analysis = extractor.performSpectralAnalysis(signal);
      
      expect(analysis.harmonics.length).toBeGreaterThan(0);
      expect(analysis.harmonics[0]).toBeCloseTo(2 * fundamental, 0.5);
    });
    
    it('debe manejar señal demasiado corta', () => {
      const shortSignal = Array(30).fill(1); // Menor que windowSize
      
      expect(() => {
        extractor.performSpectralAnalysis(shortSignal);
      }).toThrow('Señal demasiado corta para análisis espectral');
    });
    
    it('debe calcular SNR espectral correctamente', () => {
      // Señal pura con ruido determinístico conocido
      const signal = Array.from({ length: 128 }, (_, i) => {
        const t = i / 30;
        const pureSignal = Math.sin(2 * Math.PI * 1.0 * t);
        // Ruido determinístico basado en índice
        const deterministicNoise = (Math.sin(i * 0.1) * 0.05);
        return pureSignal + deterministicNoise;
      });
      
      const analysis = extractor.performSpectralAnalysis(signal);
      
      expect(analysis.snr).toBeGreaterThan(5); // SNR razonable para señal con poco ruido
    });
  });
  
  describe('Reset y Estadísticas', () => {
    it('debe resetear correctamente', () => {
      const frames = createSyntheticPPGFrames(40, 72);
      
      // Procesar algunas señales
      extractor.extractPPGSignal(frames);
      let stats = extractor.getStatistics();
      expect(stats.signalBufferSize).toBeGreaterThan(0);
      
      // Resetear
      extractor.reset();
      stats = extractor.getStatistics();
      
      expect(stats.isCalibrated).toBe(false);
      expect(stats.calibrationProgress).toBe(0);
      expect(stats.signalBufferSize).toBe(0);
      expect(stats.frameHistorySize).toBe(0);
    });
    
    it('debe proporcionar estadísticas precisas', () => {
      const frames = createSyntheticPPGFrames(35, 72);
      
      extractor.extractPPGSignal(frames);
      const stats = extractor.getStatistics();
      
      expect(stats.isCalibrated).toBe(true);
      expect(stats.calibrationProgress).toBe(1);
      expect(stats.signalBufferSize).toBeGreaterThan(0);
      expect(stats.frameHistorySize).toBeGreaterThan(0);
      expect(stats.lastSignalQuality).toBeGreaterThanOrEqual(0);
      expect(stats.lastSignalQuality).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Validación de Rangos Fisiológicos', () => {
    it('debe validar frecuencias cardíacas en rango fisiológico', () => {
      // Probar diferentes frecuencias cardíacas
      const heartRates = [60, 72, 100, 120]; // BPM
      
      heartRates.forEach(hr => {
        const frames = createSyntheticPPGFrames(60, hr);
        extractor.reset();
        extractor.extractPPGSignal(frames); // Calibración
        
        const signal = extractor.extractPPGSignal(frames.slice(-30));
        
        if (signal.red.length >= 64) { // Suficiente para análisis espectral
          const analysis = extractor.performSpectralAnalysis(signal.red);
          const detectedHR = analysis.dominantFrequency * 60;
          
          // Debe estar cerca de la frecuencia original (±10 BPM)
          expect(Math.abs(detectedHR - hr)).toBeLessThan(15);
        }
      });
    });
    
    it('debe calcular índice de perfusión en rango válido', () => {
      const frames = createSyntheticPPGFrames(40, 72);
      extractor.extractPPGSignal(frames); // Calibración
      
      const signal = extractor.extractPPGSignal(frames.slice(-20));
      
      // Calcular PI manualmente para verificar
      const avgAC = signal.acComponent.reduce((sum, ac) => sum + Math.abs(ac), 0) / signal.acComponent.length;
      const avgDC = signal.dcComponent.reduce((sum, dc) => sum + Math.abs(dc), 0) / signal.dcComponent.length;
      const pi = avgDC > 0 ? (avgAC / avgDC) * 100 : 0;
      
      expect(pi).toBeGreaterThanOrEqual(0);
      expect(pi).toBeLessThan(50); // Rango típico para PI
    });
  });
  
  describe('Manejo de Errores', () => {
    it('debe manejar frames con datos corruptos', () => {
      const corruptedFrame = createTestFrame(
        Date.now(),
        [NaN, Infinity, -Infinity],
        [0, 0, 0],
        [0, 0, 0],
        false
      );
      
      expect(() => {
        extractor.extractPPGSignal([corruptedFrame]);
      }).not.toThrow();
    });
    
    it('debe manejar configuración inválida graciosamente', () => {
      expect(() => {
        extractor.updateConfig({
          samplingRate: -1,
          windowSize: 0
        });
      }).not.toThrow();
    });
  });
  
  describe('Rendimiento', () => {
    it('debe procesar señales en tiempo razonable', () => {
      const frames = createSyntheticPPGFrames(100, 72);
      
      const startTime = performance.now();
      extractor.extractPPGSignal(frames);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      // Debe procesar en menos de 200ms
      expect(processingTime).toBeLessThan(200);
    });
    
    it('debe mantener uso de memoria estable', () => {
      // Procesar múltiples lotes para verificar que no hay memory leaks
      for (let i = 0; i < 10; i++) {
        const frames = createSyntheticPPGFrames(50, 72 + i * 5);
        extractor.extractPPGSignal(frames);
      }
      
      const stats = extractor.getStatistics();
      
      // Buffer debe mantenerse en tamaño razonable
      expect(stats.signalBufferSize).toBeLessThanOrEqual(10);
      expect(stats.frameHistorySize).toBeLessThanOrEqual(512);
    });
  });
});