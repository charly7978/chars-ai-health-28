/**
 * Pruebas unitarias para RealTimeImageProcessor
 * Verifica el funcionamiento correcto de todos los algoritmos ópticos avanzados
 */

import { RealTimeImageProcessor } from '../RealTimeImageProcessor';
import { ColorChannels, OpticalDensity, ProcessedFrame } from '../../../types/image-processing';

// Helper para crear ImageData de prueba
const createTestImageData = (width: number, height: number, pattern: 'solid' | 'gradient' | 'noise' = 'solid'): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const pixelIndex = i * 4;
    
    switch (pattern) {
      case 'gradient':
        const x = i % width;
        const y = Math.floor(i / width);
        const gradientValue = Math.floor((x + y) / (width + height) * 255);
        data[pixelIndex] = gradientValue;     // R
        data[pixelIndex + 1] = gradientValue; // G
        data[pixelIndex + 2] = gradientValue; // B
        data[pixelIndex + 3] = 255;           // A
        break;
        
      case 'noise':
        // Usar función determinística para ruido reproducible
        const seed = i * 9301 + 49297;
        const noise = (seed % 233280) / 233280;
        const noiseValue = Math.floor(noise * 255);
        data[pixelIndex] = noiseValue;
        data[pixelIndex + 1] = noiseValue;
        data[pixelIndex + 2] = noiseValue;
        data[pixelIndex + 3] = 255;
        break;
        
      default: // solid
        data[pixelIndex] = 128;     // R
        data[pixelIndex + 1] = 96;  // G
        data[pixelIndex + 2] = 64;  // B
        data[pixelIndex + 3] = 255; // A
    }
  }
  
  return new ImageData(data, width, height);
};

// Helper para crear canales de color de prueba
const createTestColorChannels = (size: number): ColorChannels => {
  const red = Array(size).fill(0).map((_, i) => 0.5 + 0.3 * Math.sin(i * 0.1));
  const green = Array(size).fill(0).map((_, i) => 0.4 + 0.2 * Math.cos(i * 0.1));
  const blue = Array(size).fill(0).map((_, i) => 0.3 + 0.1 * Math.sin(i * 0.05));
  const luminance = red.map((r, i) => 0.299 * r + 0.587 * green[i] + 0.114 * blue[i]);
  const chrominanceU = red.map((r, i) => r - luminance[i]);
  const chrominanceV = blue.map((b, i) => b - luminance[i]);
  
  return {
    red,
    green,
    blue,
    luminance,
    chrominanceU,
    chrominanceV
  };
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
      expect(defaultProcessor).toBeDefined();
    });
    
    it('debe aceptar configuración personalizada', () => {
      const customConfig = {
        roiSize: { width: 150, height: 150 },
        qualityThreshold: 80,
        colorSpaceConversion: 'XYZ' as const
      };
      
      const customProcessor = new RealTimeImageProcessor(customConfig);
      expect(customProcessor).toBeDefined();
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
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.frameId).toContain('frame_');
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
      const imageData = createTestImageData(10, 10, 'solid');
      const channels = processor.extractColorChannels(imageData);
      
      expect(channels.red).toHaveLength(100);
      expect(channels.green).toHaveLength(100);
      expect(channels.blue).toHaveLength(100);
      expect(channels.luminance).toHaveLength(100);
      expect(channels.chrominanceU).toHaveLength(100);
      expect(channels.chrominanceV).toHaveLength(100);
    });
    
    it('debe normalizar valores RGB correctamente', () => {
      const imageData = createTestImageData(5, 5, 'solid');
      const channels = processor.extractColorChannels(imageData);
      
      // Verificar que los valores están normalizados (0-1)
      channels.red.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
      
      channels.green.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
      
      channels.blue.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
    
    it('debe calcular luminancia correctamente', () => {
      const imageData = createTestImageData(5, 5, 'solid');
      const channels = processor.extractColorChannels(imageData);
      
      // Verificar fórmula de luminancia: 0.299*R + 0.587*G + 0.114*B
      for (let i = 0; i < channels.red.length; i++) {
        const expectedLuminance = 0.299 * channels.red[i] + 0.587 * channels.green[i] + 0.114 * channels.blue[i];
        expect(channels.luminance[i]).toBeCloseTo(expectedLuminance, 5);
      }
    });
  });
  
  describe('Transformaciones de Espacio de Color', () => {
    it('debe realizar transformación RGB → XYZ correctamente', () => {
      // Crear processor con transformación XYZ\n      const xyzProcessor = new RealTimeImageProcessor({\n        colorSpaceConversion: 'XYZ'\n      });\n      \n      const imageData = createTestImageData(5, 5, 'solid');\n      const channels = xyzProcessor.extractColorChannels(imageData);\n      \n      // Verificar que los valores XYZ están en rango esperado\n      channels.luminance.forEach(y => {\n        expect(y).toBeGreaterThanOrEqual(0);\n        expect(y).toBeLessThanOrEqual(1);\n      });\n    });\n    \n    it('debe realizar transformación RGB → Lab correctamente', () => {\n      const labProcessor = new RealTimeImageProcessor({\n        colorSpaceConversion: 'Lab'\n      });\n      \n      const imageData = createTestImageData(5, 5, 'solid');\n      const channels = labProcessor.extractColorChannels(imageData);\n      \n      // Verificar que L* está en rango 0-100 (normalizado a 0-1)\n      channels.luminance.forEach(l => {\n        expect(l).toBeGreaterThanOrEqual(0);\n        expect(l).toBeLessThanOrEqual(1);\n      });\n    });\n    \n    it('debe realizar transformación RGB → YUV correctamente', () => {\n      const yuvProcessor = new RealTimeImageProcessor({\n        colorSpaceConversion: 'YUV'\n      });\n      \n      const imageData = createTestImageData(5, 5, 'solid');\n      const channels = yuvProcessor.extractColorChannels(imageData);\n      \n      // Verificar que Y está en rango 0-1\n      channels.luminance.forEach(y => {\n        expect(y).toBeGreaterThanOrEqual(0);\n        expect(y).toBeLessThanOrEqual(1);\n      });\n    });\n  });\n  \n  describe('calculateOpticalDensity', () => {\n    it('debe calcular densidad óptica usando ley de Beer-Lambert', () => {\n      const channels = createTestColorChannels(100);\n      const opticalDensity = processor.calculateOpticalDensity(channels);\n      \n      expect(opticalDensity.redOD).toHaveLength(100);\n      expect(opticalDensity.greenOD).toHaveLength(100);\n      expect(opticalDensity.blueOD).toHaveLength(100);\n      expect(opticalDensity.averageOD).toBeGreaterThan(0);\n      expect(opticalDensity.odRatio).toBeGreaterThan(0);\n    });\n    \n    it('debe aplicar fórmula OD = -log10(I/I₀) correctamente', () => {\n      const channels: ColorChannels = {\n        red: [0.5, 0.8, 0.2],\n        green: [0.4, 0.7, 0.3],\n        blue: [0.3, 0.6, 0.4],\n        luminance: [0.4, 0.7, 0.3],\n        chrominanceU: [0.1, 0.1, -0.1],\n        chrominanceV: [0.2, -0.1, 0.1]\n      };\n      \n      const opticalDensity = processor.calculateOpticalDensity(channels);\n      \n      // Verificar que OD = -log10(I/I₀) donde I₀ = 1 (normalizado)\n      for (let i = 0; i < channels.red.length; i++) {\n        const expectedRedOD = -Math.log10(Math.max(channels.red[i], 0.001));\n        expect(opticalDensity.redOD[i]).toBeCloseTo(expectedRedOD, 5);\n      }\n    });\n    \n    it('debe manejar valores muy pequeños sin error', () => {\n      const channels: ColorChannels = {\n        red: [0.001, 0.0001, 0],\n        green: [0.001, 0.0001, 0],\n        blue: [0.001, 0.0001, 0],\n        luminance: [0.001, 0.0001, 0],\n        chrominanceU: [0, 0, 0],\n        chrominanceV: [0, 0, 0]\n      };\n      \n      expect(() => {\n        const opticalDensity = processor.calculateOpticalDensity(channels);\n        expect(opticalDensity.redOD).toHaveLength(3);\n        expect(opticalDensity.averageOD).toBeGreaterThan(0);\n      }).not.toThrow();\n    });\n  });\n  \n  describe('detectFingerPresence', () => {\n    it('debe detectar presencia de dedo con alta confianza para imagen típica de piel', () => {\n      // Crear imagen que simula piel\n      const skinImageData = createTestImageData(50, 50, 'solid');\n      const channels = processor.extractColorChannels(skinImageData);\n      \n      const detection = processor.detectFingerPresence(skinImageData, channels);\n      \n      expect(detection.confidence).toBeGreaterThanOrEqual(0);\n      expect(detection.confidence).toBeLessThanOrEqual(1);\n      expect(detection.coverage).toBeGreaterThanOrEqual(0);\n      expect(detection.coverage).toBeLessThanOrEqual(1);\n      expect(detection.textureScore).toBeGreaterThanOrEqual(0);\n      expect(detection.textureScore).toBeLessThanOrEqual(1);\n      expect(detection.position).toBeDefined();\n    });\n    \n    it('debe calcular métricas de textura correctamente', () => {\n      const imageData = createTestImageData(30, 30, 'noise');\n      const channels = processor.extractColorChannels(imageData);\n      \n      const detection = processor.detectFingerPresence(imageData, channels);\n      \n      // Imagen con ruido debe tener score de textura diferente a imagen sólida\n      expect(detection.textureScore).toBeGreaterThanOrEqual(0);\n      expect(detection.edgeScore).toBeGreaterThanOrEqual(0);\n    });\n    \n    it('debe estimar posición del dedo correctamente', () => {\n      const imageData = createTestImageData(40, 40, 'gradient');\n      const channels = processor.extractColorChannels(imageData);\n      \n      const detection = processor.detectFingerPresence(imageData, channels);\n      \n      expect(detection.position.x).toBeGreaterThanOrEqual(0);\n      expect(detection.position.y).toBeGreaterThanOrEqual(0);\n      expect(detection.position.width).toBeGreaterThanOrEqual(0);\n      expect(detection.position.height).toBeGreaterThanOrEqual(0);\n    });\n  });\n  \n  describe('stabilizeImage', () => {\n    it('debe estabilizar imagen correctamente', () => {\n      const imageData1 = createTestImageData(50, 50, 'gradient');\n      const imageData2 = createTestImageData(50, 50, 'gradient');\n      \n      // Primera imagen (referencia)\n      const result1 = processor.stabilizeImage(imageData1);\n      expect(result1.offset).toEqual({ x: 0, y: 0 });\n      \n      // Segunda imagen (debe calcular offset)\n      const result2 = processor.stabilizeImage(imageData2);\n      expect(result2.imageData).toBeDefined();\n      expect(result2.offset).toBeDefined();\n    });\n    \n    it('debe mantener dimensiones de imagen después de estabilización', () => {\n      const originalImageData = createTestImageData(60, 60, 'solid');\n      const result = processor.stabilizeImage(originalImageData);\n      \n      expect(result.imageData.width).toBe(originalImageData.width);\n      expect(result.imageData.height).toBe(originalImageData.height);\n      expect(result.imageData.data.length).toBe(originalImageData.data.length);\n    });\n  });\n  \n  describe('Análisis de Calidad', () => {\n    it('debe calcular métricas de calidad correctamente', () => {\n      const imageData = createTestImageData(40, 40, 'gradient');\n      const result = processor.processFrame(imageData);\n      \n      const { qualityMetrics } = result;\n      \n      expect(qualityMetrics.snr).toBeGreaterThanOrEqual(0);\n      expect(qualityMetrics.contrast).toBeGreaterThanOrEqual(0);\n      expect(qualityMetrics.sharpness).toBeGreaterThanOrEqual(0);\n      expect(qualityMetrics.illumination).toBeGreaterThanOrEqual(0);\n      expect(qualityMetrics.illumination).toBeLessThanOrEqual(100);\n      expect(qualityMetrics.stability).toBeGreaterThanOrEqual(0);\n      expect(qualityMetrics.stability).toBeLessThanOrEqual(100);\n      expect(qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);\n      expect(qualityMetrics.overallQuality).toBeLessThanOrEqual(100);\n    });\n    \n    it('debe calcular SNR correctamente', () => {\n      const highContrastImage = createTestImageData(30, 30, 'gradient');\n      const lowContrastImage = createTestImageData(30, 30, 'solid');\n      \n      const highContrastResult = processor.processFrame(highContrastImage);\n      const lowContrastResult = processor.processFrame(lowContrastImage);\n      \n      // Imagen con gradiente debe tener SNR diferente a imagen sólida\n      expect(highContrastResult.qualityMetrics.snr).not.toBe(lowContrastResult.qualityMetrics.snr);\n    });\n    \n    it('debe evaluar iluminación correctamente', () => {\n      const imageData = createTestImageData(20, 20, 'solid');\n      const result = processor.processFrame(imageData);\n      \n      // Iluminación debe estar en rango 0-100\n      expect(result.qualityMetrics.illumination).toBeGreaterThanOrEqual(0);\n      expect(result.qualityMetrics.illumination).toBeLessThanOrEqual(100);\n    });\n  });\n  \n  describe('Análisis GLCM (Gray-Level Co-occurrence Matrix)', () => {\n    it('debe calcular características de textura GLCM', () => {\n      const texturedImage = createTestImageData(32, 32, 'noise');\n      const channels = processor.extractColorChannels(texturedImage);\n      \n      const detection = processor.detectFingerPresence(texturedImage, channels);\n      \n      // Imagen con ruido debe tener características de textura detectables\n      expect(detection.textureScore).toBeGreaterThan(0);\n    });\n    \n    it('debe diferenciar entre texturas diferentes', () => {\n      const smoothImage = createTestImageData(32, 32, 'solid');\n      const texturedImage = createTestImageData(32, 32, 'noise');\n      \n      const smoothChannels = processor.extractColorChannels(smoothImage);\n      const texturedChannels = processor.extractColorChannels(texturedImage);\n      \n      const smoothDetection = processor.detectFingerPresence(smoothImage, smoothChannels);\n      const texturedDetection = processor.detectFingerPresence(texturedImage, texturedChannels);\n      \n      // Las texturas diferentes deben producir scores diferentes\n      expect(smoothDetection.textureScore).not.toBe(texturedDetection.textureScore);\n    });\n  });\n  \n  describe('Detección de Bordes Sobel', () => {\n    it('debe detectar bordes correctamente', () => {\n      const gradientImage = createTestImageData(30, 30, 'gradient');\n      const channels = processor.extractColorChannels(gradientImage);\n      \n      const detection = processor.detectFingerPresence(gradientImage, channels);\n      \n      // Imagen con gradiente debe tener bordes detectables\n      expect(detection.edgeScore).toBeGreaterThan(0);\n    });\n    \n    it('debe diferenciar entre imágenes con y sin bordes', () => {\n      const solidImage = createTestImageData(30, 30, 'solid');\n      const gradientImage = createTestImageData(30, 30, 'gradient');\n      \n      const solidChannels = processor.extractColorChannels(solidImage);\n      const gradientChannels = processor.extractColorChannels(gradientImage);\n      \n      const solidDetection = processor.detectFingerPresence(solidImage, solidChannels);\n      const gradientDetection = processor.detectFingerPresence(gradientImage, gradientChannels);\n      \n      // Imagen con gradiente debe tener mayor score de bordes\n      expect(gradientDetection.edgeScore).toBeGreaterThan(solidDetection.edgeScore);\n    });\n  });\n  \n  describe('Gestión de Configuración', () => {\n    it('debe actualizar configuración dinámicamente', () => {\n      const newConfig = {\n        qualityThreshold: 90,\n        textureAnalysisDepth: 5,\n        colorSpaceConversion: 'XYZ' as const\n      };\n      \n      processor.updateConfig(newConfig);\n      const config = processor.getConfig();\n      \n      expect(config.qualityThreshold).toBe(90);\n      expect(config.textureAnalysisDepth).toBe(5);\n      expect(config.colorSpaceConversion).toBe('XYZ');\n    });\n    \n    it('debe mantener configuración no especificada', () => {\n      const originalConfig = processor.getConfig();\n      const partialUpdate = { qualityThreshold: 85 };\n      \n      processor.updateConfig(partialUpdate);\n      const updatedConfig = processor.getConfig();\n      \n      expect(updatedConfig.qualityThreshold).toBe(85);\n      expect(updatedConfig.roiSize).toEqual(originalConfig.roiSize);\n      expect(updatedConfig.enableStabilization).toBe(originalConfig.enableStabilization);\n    });\n  });\n  \n  describe('Manejo de Errores', () => {\n    it('debe manejar ImageData inválido graciosamente', () => {\n      // Crear ImageData con datos corruptos\n      const corruptData = new Uint8ClampedArray(10); // Muy pequeño\n      const corruptImageData = new ImageData(corruptData, 1, 1);\n      \n      expect(() => {\n        const result = processor.processFrame(corruptImageData);\n        expect(result).toBeDefined();\n      }).not.toThrow();\n    });\n    \n    it('debe crear frame de error cuando el procesamiento falla', () => {\n      // Simular error creando ImageData inválido\n      const invalidImageData = new ImageData(new Uint8ClampedArray(0), 0, 0);\n      \n      const result = processor.processFrame(invalidImageData);\n      \n      expect(result).toBeDefined();\n      expect(result.frameId).toContain('error');\n    });\n  });\n  \n  describe('Rendimiento y Optimización', () => {\n    it('debe procesar frames en tiempo razonable', () => {\n      const imageData = createTestImageData(100, 100, 'gradient');\n      \n      const startTime = performance.now();\n      const result = processor.processFrame(imageData);\n      const endTime = performance.now();\n      \n      const processingTime = endTime - startTime;\n      \n      expect(result).toBeDefined();\n      expect(processingTime).toBeLessThan(100); // Menos de 100ms\n    });\n    \n    it('debe mantener rendimiento consistente con múltiples frames', () => {\n      const processingTimes: number[] = [];\n      \n      for (let i = 0; i < 5; i++) {\n        const imageData = createTestImageData(80, 80, 'noise');\n        \n        const startTime = performance.now();\n        processor.processFrame(imageData);\n        const endTime = performance.now();\n        \n        processingTimes.push(endTime - startTime);\n      }\n      \n      // Verificar que los tiempos no varían excesivamente\n      const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;\n      const maxDeviation = Math.max(...processingTimes.map(time => Math.abs(time - avgTime)));\n      \n      expect(maxDeviation).toBeLessThan(avgTime * 2); // Desviación menor al 200%\n    });\n  });\n  \n  describe('Integración de Algoritmos', () => {\n    it('debe integrar todos los algoritmos en pipeline completo', () => {\n      const imageData = createTestImageData(60, 60, 'gradient');\n      const result = processor.processFrame(imageData);\n      \n      // Verificar que todos los componentes están presentes\n      expect(result.colorChannels).toBeDefined();\n      expect(result.opticalDensity).toBeDefined();\n      expect(result.fingerDetection).toBeDefined();\n      expect(result.qualityMetrics).toBeDefined();\n      expect(result.stabilizationOffset).toBeDefined();\n      \n      // Verificar coherencia entre componentes\n      expect(result.colorChannels.red.length).toBeGreaterThan(0);\n      expect(result.opticalDensity.redOD.length).toBe(result.colorChannels.red.length);\n    });\n    \n    it('debe mantener coherencia temporal entre frames', () => {\n      const imageData1 = createTestImageData(50, 50, 'solid');\n      const imageData2 = createTestImageData(50, 50, 'solid');\n      \n      const result1 = processor.processFrame(imageData1);\n      const result2 = processor.processFrame(imageData2);\n      \n      // Los frames similares deben producir resultados similares\n      expect(Math.abs(result1.qualityMetrics.overallQuality - result2.qualityMetrics.overallQuality)).toBeLessThan(20);\n      expect(result1.fingerDetection.isPresent).toBe(result2.fingerDetection.isPresent);\n    });\n  });\n  \n  describe('Reset y Limpieza', () => {\n    it('debe resetear correctamente', () => {\n      // Procesar algunos frames primero\n      const imageData = createTestImageData(40, 40, 'solid');\n      processor.processFrame(imageData);\n      processor.processFrame(imageData);\n      \n      // Resetear\n      processor.reset();\n      \n      // Verificar que el estado se ha limpiado\n      const stats = processor.getStatistics();\n      expect(stats.frameHistorySize).toBe(0);\n    });\n    \n    it('debe funcionar correctamente después del reset', () => {\n      const imageData = createTestImageData(30, 30, 'gradient');\n      \n      // Procesar, resetear, y procesar de nuevo\n      processor.processFrame(imageData);\n      processor.reset();\n      const result = processor.processFrame(imageData);\n      \n      expect(result).toBeDefined();\n      expect(result.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);\n    });\n  });\n});"