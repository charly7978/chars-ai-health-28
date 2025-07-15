/**
 * Pruebas unitarias para RealTimeImageProcessor
 * Verifica el funcionamiento correcto de todos los algoritmos ópticos
 */

import { RealTimeImageProcessor } from '../RealTimeImageProcessor';
import { ColorChannels, OpticalDensity, FingerDetection, QualityMetrics } from '../../../types/image-processing';

// Helper para crear ImageData de prueba
const createTestImageData = (width: number, height: number, pattern: 'solid' | 'gradient' | 'noise' = 'solid'): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const pixelIndex = i * 4;
    
    switch (pattern) {
      case 'gradient':
        const x = i % width;
        const y = Math.floor(i / width);
        data[pixelIndex] = (x / width) * 255;     // R
        data[pixelIndex + 1] = (y / height) * 255; // G
        data[pixelIndex + 2] = 128;               // B
        data[pixelIndex + 3] = 255;               // A
        break;
        
      case 'noise':
        data[pixelIndex] = Math.random() * 255;     // R
        data[pixelIndex + 1] = Math.random() * 255; // G
        data[pixelIndex + 2] = Math.random() * 255; // B
        data[pixelIndex + 3] = 255;                 // A
        break;
        
      default: // solid
        data[pixelIndex] = 150;     // R
        data[pixelIndex + 1] = 100; // G
        data[pixelIndex + 2] = 80;  // B
        data[pixelIndex + 3] = 255; // A
    }
  }
  
  return new ImageData(data, width, height);
};

// Helper para crear canales de color de prueba
const createTestColorChannels = (size: number): ColorChannels => {
  const red = Array(size).fill(0).map((_, i) => 0.6 + (i % 10) * 0.01);
  const green = Array(size).fill(0).map((_, i) => 0.4 + (i % 8) * 0.01);
  const blue = Array(size).fill(0).map((_, i) => 0.3 + (i % 6) * 0.01);
  const luminance = red.map((r, i) => 0.299 * r + 0.587 * green[i] + 0.114 * blue[i]);
  const chrominanceU = red.map((r, i) => r - luminance[i]);
  const chrominanceV = blue.map((b, i) => b - luminance[i]);
  
  return { red, green, blue, luminance, chrominanceU, chrominanceV };
};

describe('RealTimeImageProcessor', () => {
  let processor: RealTimeImageProcessor;
  
  beforeEach(() => {
    processor = new RealTimeImageProcessor({
      roiSize: { width: 100, height: 100 },
      roiPosition: { x: 0.5, y: 0.5 },
      enableStabilization: true,
      qualityThreshold: 70,
      textureAnalysisDepth: 3,
      colorSpaceConversion: 'Lab'
    });
  });
  
  describe('Constructor y Configuración', () => {
    it('debe inicializarse con configuración por defecto', () => {
      const defaultProcessor = new RealTimeImageProcessor();
      const config = defaultProcessor.getConfig();
      
      expect(config.roiSize).toEqual({ width: 200, height: 200 });
      expect(config.roiPosition).toEqual({ x: 0.5, y: 0.5 });
      expect(config.enableStabilization).toBe(true);
      expect(config.qualityThreshold).toBe(70);
    });
    
    it('debe aceptar configuración personalizada', () => {
      const customConfig = {
        roiSize: { width: 150, height: 150 },
        qualityThreshold: 80,
        colorSpaceConversion: 'XYZ' as const
      };
      
      const customProcessor = new RealTimeImageProcessor(customConfig);
      const config = customProcessor.getConfig();
      
      expect(config.roiSize).toEqual({ width: 150, height: 150 });
      expect(config.qualityThreshold).toBe(80);
      expect(config.colorSpaceConversion).toBe('XYZ');
    });
    
    it('debe actualizar configuración correctamente', () => {
      const newConfig = { qualityThreshold: 85 };
      processor.updateConfig(newConfig);
      
      const config = processor.getConfig();
      expect(config.qualityThreshold).toBe(85);
    });
  });
  
  describe('processFrame', () => {
    it('debe procesar frame correctamente', () => {
      const imageData = createTestImageData(200, 200, 'gradient');
      const result = processor.processFrame(imageData);
      
      expect(result).toBeDefined();
      expect(result.frameId).toContain('frame_');
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.colorChannels).toBeDefined();
      expect(result.opticalDensity).toBeDefined();
      expect(result.fingerDetection).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
    });
    
    it('debe manejar imágenes pequeñas', () => {
      const imageData = createTestImageData(50, 50, 'solid');
      const result = processor.processFrame(imageData);
      
      expect(result).toBeDefined();
      expect(result.colorChannels.red.length).toBeGreaterThan(0);
    });
    
    it('debe manejar diferentes patrones de imagen', () => {
      const patterns: Array<'solid' | 'gradient' | 'noise'> = ['solid', 'gradient', 'noise'];
      
      patterns.forEach(pattern => {
        const imageData = createTestImageData(100, 100, pattern);
        const result = processor.processFrame(imageData);
        
        expect(result).toBeDefined();
        expect(result.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);
        expect(result.qualityMetrics.overallQuality).toBeLessThanOrEqual(100);
      });
    });
  });
  
  describe('extractColorChannels', () => {
    it('debe extraer canales de color correctamente', () => {
      const imageData = createTestImageData(10, 10, 'gradient');
      const channels = processor.extractColorChannels(imageData);
      
      expect(channels.red).toHaveLength(100);
      expect(channels.green).toHaveLength(100);
      expect(channels.blue).toHaveLength(100);
      expect(channels.luminance).toHaveLength(100);
      expect(channels.chrominanceU).toHaveLength(100);
      expect(channels.chrominanceV).toHaveLength(100);
    });
    
    it('debe normalizar valores correctamente', () => {
      const imageData = createTestImageData(5, 5, 'solid');
      const channels = processor.extractColorChannels(imageData);
      
      // Verificar que los valores estén normalizados (0-1)
      channels.red.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
    });
    
    it('debe calcular luminancia correctamente', () => {
      const imageData = createTestImageData(3, 3, 'solid');
      const channels = processor.extractColorChannels(imageData);
      
      // Verificar fórmula de luminancia: 0.299*R + 0.587*G + 0.114*B
      const expectedLuminance = 0.299 * channels.red[0] + 0.587 * channels.green[0] + 0.114 * channels.blue[0];
      expect(channels.luminance[0]).toBeCloseTo(expectedLuminance, 3);
    });
  });
  
  describe('calculateOpticalDensity', () => {
    it('debe calcular densidad óptica usando ley de Beer-Lambert', () => {
      const channels = createTestColorChannels(100);
      const od = processor.calculateOpticalDensity(channels);
      
      expect(od.redOD).toHaveLength(100);
      expect(od.greenOD).toHaveLength(100);
      expect(od.blueOD).toHaveLength(100);
      expect(od.averageOD).toBeGreaterThan(0);
      expect(od.odRatio).toBeGreaterThan(0);
    });
    
    it('debe manejar valores de intensidad muy bajos', () => {
      const channels: ColorChannels = {
        red: [0.001, 0.002, 0.001],
        green: [0.001, 0.001, 0.002],
        blue: [0.001, 0.001, 0.001],
        luminance: [0.001, 0.001, 0.001],
        chrominanceU: [0, 0, 0],
        chrominanceV: [0, 0, 0]
      };
      
      const od = processor.calculateOpticalDensity(channels);
      
      // No debe producir valores infinitos o NaN
      od.redOD.forEach(val => {
        expect(val).toBeFinite();
        expect(val).not.toBeNaN();
      });
    });
    
    it('debe calcular ratio espectral correctamente', () => {
      const channels = createTestColorChannels(50);
      const od = processor.calculateOpticalDensity(channels);
      
      expect(od.odRatio).toBeFinite();
      expect(od.odRatio).toBeGreaterThan(0);
    });
  });
  
  describe('detectFingerPresence', () => {
    it('debe detectar presencia de dedo con alta confianza para imagen típica de piel', () => {
      // Crear imagen que simula piel
      const skinImageData = createTestImageData(50, 50, 'solid');
      const channels = createTestColorChannels(2500); // 50x50
      
      const detection = processor.detectFingerPresence(skinImageData, channels);
      
      expect(detection.isPresent).toBeDefined();
      expect(detection.confidence).toBeGreaterThanOrEqual(0);
      expect(detection.confidence).toBeLessThanOrEqual(1);
      expect(detection.coverage).toBeGreaterThanOrEqual(0);
      expect(detection.coverage).toBeLessThanOrEqual(1);
      expect(detection.textureScore).toBeGreaterThanOrEqual(0);
      expect(detection.edgeScore).toBeGreaterThanOrEqual(0);
      expect(detection.colorConsistency).toBeGreaterThanOrEqual(0);
    });
    
    it('debe calcular posición del dedo', () => {
      const imageData = createTestImageData(20, 20, 'gradient');
      const channels = createTestColorChannels(400);
      
      const detection = processor.detectFingerPresence(imageData, channels);
      
      expect(detection.position).toBeDefined();
      expect(detection.position.x).toBeGreaterThanOrEqual(0);
      expect(detection.position.y).toBeGreaterThanOrEqual(0);
      expect(detection.position.width).toBeGreaterThanOrEqual(0);
      expect(detection.position.height).toBeGreaterThanOrEqual(0);
    });
    
    it('debe manejar imagen sin dedo', () => {
      // Imagen completamente negra (sin dedo)
      const blackImageData = createTestImageData(30, 30, 'solid');
      const blackChannels: ColorChannels = {
        red: Array(900).fill(0),
        green: Array(900).fill(0),
        blue: Array(900).fill(0),
        luminance: Array(900).fill(0),
        chrominanceU: Array(900).fill(0),
        chrominanceV: Array(900).fill(0)
      };
      
      const detection = processor.detectFingerPresence(blackImageData, blackChannels);
      
      expect(detection.confidence).toBeLessThan(0.5);
      expect(detection.coverage).toBeLessThan(0.3);
    });
  });
  
  describe('stabilizeImage', () => {
    it('debe estabilizar imagen correctamente', () => {
      const imageData1 = createTestImageData(100, 100, 'gradient');
      const imageData2 = createTestImageData(100, 100, 'gradient');
      
      // Primera imagen (referencia)
      const result1 = processor.stabilizeImage(imageData1);
      expect(result1.offset).toEqual({ x: 0, y: 0 });
      
      // Segunda imagen (debe calcular offset)
      const result2 = processor.stabilizeImage(imageData2);
      expect(result2.imageData).toBeDefined();
      expect(result2.offset).toBeDefined();
    });
    
    it('debe manejar imágenes idénticas', () => {
      const imageData = createTestImageData(50, 50, 'solid');
      
      // Establecer referencia
      processor.stabilizeImage(imageData);
      
      // Procesar imagen idéntica
      const result = processor.stabilizeImage(imageData);
      
      // Offset debe ser mínimo para imágenes idénticas
      expect(Math.abs(result.offset.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.offset.y)).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Transformaciones de Color', () => {
    it('debe transformar RGB a Lab correctamente', () => {
      const imageData = createTestImageData(5, 5, 'solid');
      
      // Configurar para usar Lab
      processor.updateConfig({ colorSpaceConversion: 'Lab' });
      const channels = processor.extractColorChannels(imageData);
      
      expect(channels.luminance).toBeDefined();
      expect(channels.chrominanceU).toBeDefined();
      expect(channels.chrominanceV).toBeDefined();
      
      // Verificar que los valores están en rangos esperados para Lab
      channels.luminance.forEach(L => {
        expect(L).toBeGreaterThanOrEqual(0);
        expect(L).toBeLessThanOrEqual(100);
      });
    });
    
    it('debe transformar RGB a XYZ correctamente', () => {
      const imageData = createTestImageData(5, 5, 'gradient');
      
      processor.updateConfig({ colorSpaceConversion: 'XYZ' });
      const channels = processor.extractColorChannels(imageData);
      
      expect(channels.luminance).toBeDefined();
      expect(channels.chrominanceU).toBeDefined();
      expect(channels.chrominanceV).toBeDefined();
      
      // Verificar que no hay valores NaN
      channels.luminance.forEach(val => {
        expect(val).not.toBeNaN();
        expect(val).toBeFinite();
      });
    });
    
    it('debe transformar RGB a YUV correctamente', () => {
      const imageData = createTestImageData(5, 5, 'noise');
      
      processor.updateConfig({ colorSpaceConversion: 'YUV' });
      const channels = processor.extractColorChannels(imageData);
      
      expect(channels.luminance).toBeDefined();
      expect(channels.chrominanceU).toBeDefined();
      expect(channels.chrominanceV).toBeDefined();
    });
  });
  
  describe('Métricas de Calidad', () => {
    it('debe calcular métricas de calidad válidas', () => {
      const imageData = createTestImageData(100, 100, 'gradient');
      const result = processor.processFrame(imageData);
      
      const quality = result.qualityMetrics;
      
      expect(quality.snr).toBeGreaterThanOrEqual(0);
      expect(quality.contrast).toBeGreaterThanOrEqual(0);
      expect(quality.sharpness).toBeGreaterThanOrEqual(0);
      expect(quality.illumination).toBeGreaterThanOrEqual(0);
      expect(quality.illumination).toBeLessThanOrEqual(100);
      expect(quality.stability).toBeGreaterThanOrEqual(0);
      expect(quality.stability).toBeLessThanOrEqual(100);
      expect(quality.overallQuality).toBeGreaterThanOrEqual(0);
      expect(quality.overallQuality).toBeLessThanOrEqual(100);
    });
    
    it('debe calcular SNR correctamente', () => {
      const imageData = createTestImageData(50, 50, 'solid');
      const result = processor.processFrame(imageData);
      
      // Imagen sólida debe tener SNR alto
      expect(result.qualityMetrics.snr).toBeGreaterThan(10);
    });
    
    it('debe detectar baja calidad en imagen ruidosa', () => {
      const imageData = createTestImageData(50, 50, 'noise');
      const result = processor.processFrame(imageData);
      
      // Imagen ruidosa debe tener calidad menor
      expect(result.qualityMetrics.overallQuality).toBeLessThan(80);
    });
  });
  
  describe('Reset y Limpieza', () => {
    it('debe resetear correctamente', () => {
      // Procesar algunos frames
      const imageData = createTestImageData(50, 50, 'gradient');
      processor.processFrame(imageData);
      processor.processFrame(imageData);
      
      // Resetear
      processor.reset();
      
      // Verificar que el estado se ha limpiado
      const result = processor.processFrame(imageData);
      expect(result.frameId).toContain('frame_1_');
    });
  });
  
  describe('Manejo de Errores', () => {
    it('debe manejar ImageData inválido graciosamente', () => {
      // Crear ImageData con datos corruptos
      const invalidData = new Uint8ClampedArray(10); // Muy pequeño
      const invalidImageData = new ImageData(invalidData, 1, 1);
      
      expect(() => {
        processor.processFrame(invalidImageData);
      }).not.toThrow();
    });
    
    it('debe manejar configuración inválida', () => {
      expect(() => {
        processor.updateConfig({
          roiSize: { width: -10, height: -10 }
        });
      }).not.toThrow();
    });
  });
  
  describe('Rendimiento', () => {
    it('debe procesar frames en tiempo razonable', () => {
      const imageData = createTestImageData(200, 200, 'gradient');
      
      const startTime = performance.now();
      processor.processFrame(imageData);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      // Debe procesar en menos de 100ms
      expect(processingTime).toBeLessThan(100);
    });
    
    it('debe mantener rendimiento consistente', () => {
      const imageData = createTestImageData(100, 100, 'noise');
      const times: number[] = [];
      
      // Procesar múltiples frames
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        processor.processFrame(imageData);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      // Calcular desviación estándar de tiempos
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      
      // La desviación estándar debe ser razonable (menos del 50% del promedio)
      expect(stdDev).toBeLessThan(avgTime * 0.5);
    });
  });
});