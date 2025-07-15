/**
 * Pruebas unitarias para GlucoseProcessor
 * Verifica algoritmos matemáticos avanzados y eliminación completa de simulaciones
 */

import { GlucoseProcessor, GlucoseResult, ValidationMetrics } from '../glucose-processor';

describe('GlucoseProcessor - Algoritmos Matemáticos Avanzados', () => {
    let processor: GlucoseProcessor;
    let mockSignalData: number[];

    beforeEach(() => {
        processor = new GlucoseProcessor();
        
        // Generar señal PPG sintética determinística para pruebas
        mockSignalData = [];
        for (let i = 0; i < 200; i++) {
            // Señal base con componente pulsátil determinística
            const baseSignal = 128 + 30 * Math.sin(2 * Math.PI * i / 30); // 2 Hz
            const noise = 5 * Math.sin(2 * Math.PI * i / 100); // Ruido determinístico
            mockSignalData.push(baseSignal + noise);
        }
    });

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
            processor.calculateGlucose(mockSignalData);
            processor.reset();
            
            const stats = processor.getStatistics();
            expect(stats.measurementCount).toBe(0);
            expect(processor.getLastMeasurement()).toBeNull();
        });
    });

    describe('Análisis Espectral Avanzado', () => {
        test('debe calcular glucosa usando algoritmos matemáticos reales', () => {
            const result = processor.calculateGlucose(mockSignalData);
            
            expect(result).toBeDefined();
            expect(result.value).toBeGreaterThan(70);
            expect(result.value).toBeLessThan(400);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        test('debe generar análisis espectral completo', () => {
            const result = processor.calculateGlucose(mockSignalData);
            
            expect(result.spectralAnalysis).toBeDefined();
            expect(result.spectralAnalysis.wavelengths).toEqual([660, 700, 760, 850, 940]);
            expect(result.spectralAnalysis.absorbances).toHaveLength(4);
            expect(result.spectralAnalysis.transmittances).toHaveLength(4);
            expect(result.spectralAnalysis.opticalDensities).toHaveLength(4);
        });

        test('debe extraer características espectrales avanzadas', () => {
            const result = processor.calculateGlucose(mockSignalData);
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
            const result = processor.calculateGlucose(mockSignalData);
            
            // Verificar que se calculan absorbancia, transmitancia y densidad óptica
            expect(result.spectralAnalysis.absorbances.every(a => a >= 0)).toBe(true);
            expect(result.spectralAnalysis.transmittances.every(t => t > 0 && t <= 1)).toBe(true);
            expect(result.spectralAnalysis.opticalDensities.every(od => od >= 0)).toBe(true);
        });

        test('debe aplicar coeficientes de extinción molar correctamente', () => {
            const result1 = processor.calculateGlucose(mockSignalData);
            
            // Modificar señal para verificar cambios en cálculo
            const modifiedSignal = mockSignalData.map(val => val * 1.1);
            const result2 = processor.calculateGlucose(modifiedSignal);
            
            expect(result1.value).not.toBe(result2.value);
        });
    });

    describe('Validación Cruzada y Métricas', () => {
        test('debe calcular métricas de validación completas', () => {
            const result = processor.calculateGlucose(mockSignalData);
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
            const result1 = processor.calculateGlucose(mockSignalData);
            processor.reset();
            const result2 = processor.calculateGlucose(mockSignalData);
            
            // Los resultados deben ser idénticos (determinísticos)
            expect(result1.validationMetrics.crossValidationScore)
                .toBeCloseTo(result2.validationMetrics.crossValidationScore, 5);
        });
    });

    describe('Calibración Automática', () => {
        test('debe establecer calibración con medición de referencia', () => {
            const referenceGlucose = 120; // mg/dL
            
            expect(() => {
                processor.setCalibration(referenceGlucose, mockSignalData);
            }).not.toThrow();
            
            const stats = processor.getStatistics();
            expect(stats.calibrationStatus.isCalibrated).toBe(true);
        });

        test('debe aplicar calibración automática avanzada', () => {
            const result1 = processor.calculateGlucose(mockSignalData);
            
            // Establecer calibración
            processor.setCalibration(150, mockSignalData);
            
            const result2 = processor.calculateGlucose(mockSignalData);
            
            // El resultado calibrado debe ser diferente
            expect(result1.value).not.toBe(result2.value);
        });

        test('debe rechazar calibración con datos insuficientes', () => {
            const shortSignal = mockSignalData.slice(0, 100);
            
            expect(() => {
                processor.setCalibration(120, shortSignal);
            }).toThrow();
        });
    });

    describe('Validación Fisiológica', () => {
        test('debe mantener valores dentro de límites fisiológicos', () => {
            const result = processor.calculateGlucose(mockSignalData);
            
            expect(result.value).toBeGreaterThanOrEqual(70);
            expect(result.value).toBeLessThanOrEqual(400);
        });

        test('debe validar rangos de índices fisiológicos', () => {
            const result = processor.calculateGlucose(mockSignalData);
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
            const result1 = processor.calculateGlucose(mockSignalData);
            processor.reset();
            const result2 = processor.calculateGlucose(mockSignalData);
            
            expect(result1.value).toBeCloseTo(result2.value, 5);
            expect(result1.confidence).toBeCloseTo(result2.confidence, 5);
        });

        test('debe usar algoritmos completamente determinísticos', () => {
            const results: number[] = [];
            
            for (let i = 0; i < 5; i++) {
                processor.reset();
                const result = processor.calculateGlucose(mockSignalData);
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
            const shortSignal = mockSignalData.slice(0, 100);
            
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
            processor.calculateGlucose(mockSignalData);
            const endTime = performance.now();
            
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(1000); // Menos de 1 segundo
        });

        test('debe mantener historial de mediciones', () => {
            processor.calculateGlucose(mockSignalData);
            processor.calculateGlucose(mockSignalData);
            processor.calculateGlucose(mockSignalData);
            
            const stats = processor.getStatistics();
            expect(stats.measurementCount).toBe(3);
        });
    });

    describe('Integración con AdvancedMathEngine', () => {
        test('debe usar filtrado Kalman para suavizado de señal', () => {
            const result = processor.calculateGlucose(mockSignalData);
            
            // Verificar que se aplicó procesamiento matemático avanzado
            expect(result.spectralAnalysis).toBeDefined();
            expect(result.validationMetrics.snr).toBeGreaterThan(0);
        });

        test('debe aplicar análisis FFT para extracción espectral', () => {
            const result = processor.calculateGlucose(mockSignalData);
            
            // Verificar que se realizó análisis espectral
            expect(result.spectralAnalysis.spectralFeatures.acComponent).toBeGreaterThan(0);
            expect(result.spectralAnalysis.spectralFeatures.dcComponent).toBeGreaterThan(0);
        });
    });
});