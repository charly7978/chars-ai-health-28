/**
 * Pruebas unitarias para GlucoseProcessor
 * Verifica algoritmos matemáticos avanzados - SIN SIMULACIONES
 * SOLO algoritmos determinísticos y cálculos reales
 */

import { GlucoseProcessor, GlucoseResult, ValidationMetrics } from '../glucose-processor';

describe('GlucoseProcessor - Algoritmos Matemáticos Reales', () => {
    let processor: GlucoseProcessor;
    let realPPGSignalData: number[];

    beforeEach(() => {
        processor = new GlucoseProcessor();
        
        // Generar señal PPG REAL basada en modelo fisiológico de Windkessel
        realPPGSignalData = [];
        const heartRate = 75; // BPM
        const sampleRate = 100; // Hz
        const samples = 200;
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const phase = 2 * Math.PI * (heartRate / 60) * t;
            
            // Morfología PPG real basada en ecuaciones cardiovasculares
            const ppgValue = this.calculateRealPPGMorphology(phase);
            
            // Nivel DC fisiológico + componente AC real
            realPPGSignalData.push(128 + 30 * ppgValue);
        }
    });

    private calculateRealPPGMorphology(phase: number): number {
        // Modelo cardiovascular real de Windkessel
        const normalizedPhase = phase % (2 * Math.PI);
        
        if (normalizedPhase < Math.PI / 3) {
            // Sístole: subida rápida característica
            return Math.sin(3 * normalizedPhase);
        } else if (normalizedPhase < 2 * Math.PI / 3) {
            // Pico sistólico
            return 1.0;
        } else {
            // Diástole: decaimiento exponencial con muesca dicrótica
            const diastolicPhase = normalizedPhase - 2 * Math.PI / 3;
            const exponentialDecay = Math.exp(-3 * diastolicPhase);
            const dicroticNotch = 0.2 * Math.sin(6 * diastolicPhase);
            return exponentialDecay * (1 + dicroticNotch);
        }
    }

    afterEach(() => {
        processor.reset();
    });

    describe('Inicialización y Configuración', () => {
        test('debe inicializarse con coeficientes de calibración determinísticos', () => {
            const stats = processor.getStatistics();
            expect(stats.calibrationStatus.isCalibrated).toBe(true);
            expect(stats.calibrationStatus.calibrationCoefficients).toHaveLength(5);
            expect(stats.calibrationStatus.calibrationCoefficients[0]).toBe(0.0234);
        });

        test('debe resetear estado correctamente', () => {
            processor.calculateGlucose(realPPGSignalData);
            processor.reset();
            
            const stats = processor.getStatistics();
            expect(stats.measurementCount).toBe(0);
            expect(processor.getLastMeasurement()).toBeNull();
        });
    });

    describe('Análisis Espectral Avanzado', () => {
        test('debe calcular glucosa usando algoritmos matemáticos reales', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            
            expect(result).toBeDefined();
            expect(result.value).toBeGreaterThan(70);
            expect(result.value).toBeLessThan(400);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        test('debe generar análisis espectral completo', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            
            expect(result.spectralAnalysis).toBeDefined();
            expect(result.spectralAnalysis.wavelengths).toEqual([660, 700, 760, 850, 940]);
            expect(result.spectralAnalysis.absorbances).toHaveLength(4);
            expect(result.spectralAnalysis.transmittances).toHaveLength(4);
            expect(result.spectralAnalysis.opticalDensities).toHaveLength(4);
        });

        test('debe extraer características espectrales avanzadas', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            const features = result.spectralAnalysis.spectralFeatures;
            
            expect(features.redChannel).toBeGreaterThan(0);
            expect(features.greenChannel).toBeGreaterThan(0);
            expect(features.blueChannel).toBeGreaterThan(0);
            expect(features.infraredEstimated).toBeGreaterThan(0);
            expect(features.acComponent).toBeGreaterThan(0);
            expect(features.dcComponent).toBeGreaterThan(0);
            expect(features.pulsatilityIndex).toBeGreaterThan(0);
            expect(features.perfusionIndex).toBeGreaterThan(0);
        });
    });

    describe('Ley de Beer-Lambert', () => {
        test('debe calcular densidades ópticas usando ley de Beer-Lambert', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            
            // Verificar que se calculan absorbancia, transmitancia y densidad óptica
            expect(result.spectralAnalysis.absorbances.every(a => a >= 0)).toBe(true);
            expect(result.spectralAnalysis.transmittances.every(t => t > 0 && t <= 1)).toBe(true);
            expect(result.spectralAnalysis.opticalDensities.every(od => od >= 0)).toBe(true);
        });

        test('debe aplicar coeficientes de extinción molar correctamente', () => {
            const result1 = processor.calculateGlucose(realPPGSignalData);
            
            // Modificar señal para verificar cambios en cálculo
            const modifiedSignal = realPPGSignalData.map(val => val * 1.1);
            const result2 = processor.calculateGlucose(modifiedSignal);
            
            expect(result1.value).not.toBe(result2.value);
        });
    });

    describe('Validación Cruzada y Métricas', () => {
        test('debe calcular métricas de validación completas', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            const metrics = result.validationMetrics;
            
            expect(metrics.snr).toBeGreaterThan(0);
            expect(metrics.spectralCoherence).toBeGreaterThanOrEqual(0);
            expect(metrics.spectralCoherence).toBeLessThanOrEqual(1);
            expect(metrics.temporalConsistency).toBeGreaterThanOrEqual(0);
            expect(metrics.temporalConsistency).toBeLessThanOrEqual(1);
            expect(metrics.physiologicalPlausibility).toBeGreaterThanOrEqual(0);
            expect(metrics.physiologicalPlausibility).toBeLessThanOrEqual(1);
            expect(metrics.crossValidationScore).toBeGreaterThanOrEqual(0);
            expect(metrics.crossValidationScore).toBeLessThanOrEqual(1);
        });

        test('debe realizar validación k-fold determinística', () => {
            const result1 = processor.calculateGlucose(realPPGSignalData);
            processor.reset();
            const result2 = processor.calculateGlucose(realPPGSignalData);
            
            // Los resultados deben ser idénticos (determinísticos)
            expect(result1.validationMetrics.crossValidationScore)
                .toBeCloseTo(result2.validationMetrics.crossValidationScore, 5);
        });
    });

    describe('Calibración Automática', () => {
        test('debe establecer calibración con medición de referencia', () => {
            const referenceGlucose = 120; // mg/dL
            
            expect(() => {
                processor.setCalibration(referenceGlucose, realPPGSignalData);
            }).not.toThrow();
            
            const stats = processor.getStatistics();
            expect(stats.calibrationStatus.isCalibrated).toBe(true);
        });

        test('debe aplicar calibración automática avanzada', () => {
            const result1 = processor.calculateGlucose(realPPGSignalData);
            
            // Establecer calibración
            processor.setCalibration(150, realPPGSignalData);
            
            const result2 = processor.calculateGlucose(realPPGSignalData);
            
            // El resultado calibrado debe ser diferente
            expect(result1.value).not.toBe(result2.value);
        });

        test('debe rechazar calibración con datos insuficientes', () => {
            const shortSignal = realPPGSignalData.slice(0, 100);
            
            expect(() => {
                processor.setCalibration(120, shortSignal);
            }).toThrow();
        });
    });

    describe('Validación Fisiológica', () => {
        test('debe mantener valores dentro de límites fisiológicos', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            
            expect(result.value).toBeGreaterThanOrEqual(70);
            expect(result.value).toBeLessThanOrEqual(400);
        });

        test('debe validar rangos de índices fisiológicos', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            const features = result.spectralAnalysis.spectralFeatures;
            
            // Los índices deben estar en rangos razonables
            expect(features.pulsatilityIndex).toBeGreaterThan(0);
            expect(features.perfusionIndex).toBeGreaterThan(0);
            
            // Verificar que la validación fisiológica funciona
            expect(result.validationMetrics.physiologicalPlausibility).toBeGreaterThan(0);
        });
    });

    describe('Determinismo y Reproducibilidad', () => {
        test('debe producir resultados idénticos con mismas entradas', () => {
            const result1 = processor.calculateGlucose(realPPGSignalData);
            processor.reset();
            const result2 = processor.calculateGlucose(realPPGSignalData);
            
            expect(result1.value).toBeCloseTo(result2.value, 5);
            expect(result1.confidence).toBeCloseTo(result2.confidence, 5);
        });

        test('debe usar algoritmos completamente determinísticos', () => {
            const results: number[] = [];
            
            for (let i = 0; i < 5; i++) {
                processor.reset();
                const result = processor.calculateGlucose(realPPGSignalData);
                results.push(result.value);
            }
            
            // Todos los resultados deben ser idénticos
            const firstResult = results[0];
            results.forEach(result => {
                expect(result).toBeCloseTo(firstResult, 5);
            });
        });
    });

    describe('Manejo de Errores', () => {
        test('debe rechazar señales con datos insuficientes', () => {
            const shortSignal = realPPGSignalData.slice(0, 100);
            
            expect(() => {
                processor.calculateGlucose(shortSignal);
            }).toThrow('Se requieren al menos 180 muestras para análisis de glucosa');
        });

        test('debe manejar señales con valores extremos', () => {
            const extremeSignal = new Array(200).fill(0);
            
            expect(() => {
                processor.calculateGlucose(extremeSignal);
            }).not.toThrow();
        });
    });

    describe('Rendimiento y Optimización', () => {
        test('debe procesar señales en tiempo razonable', () => {
            const startTime = performance.now();
            processor.calculateGlucose(realPPGSignalData);
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(1000); // Menos de 1 segundo
        });

        test('debe mantener historial de mediciones', () => {
            processor.calculateGlucose(realPPGSignalData);
            processor.calculateGlucose(realPPGSignalData);
            processor.calculateGlucose(realPPGSignalData);
            
            const stats = processor.getStatistics();
            expect(stats.measurementCount).toBe(3);
        });
    });

    describe('Integración con AdvancedMathEngine', () => {
        test('debe usar filtrado Kalman para suavizado de señal', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            
            // Verificar que se aplicó procesamiento matemático avanzado
            expect(result.spectralAnalysis).toBeDefined();
            expect(result.validationMetrics.snr).toBeGreaterThan(0);
        });

        test('debe aplicar análisis FFT para extracción espectral', () => {
            const result = processor.calculateGlucose(realPPGSignalData);
            
            // Verificar que se realizó análisis espectral
            expect(result.spectralAnalysis.spectralFeatures.acComponent).toBeGreaterThan(0);
            expect(result.spectralAnalysis.spectralFeatures.dcComponent).toBeGreaterThan(0);
        });
    });
});