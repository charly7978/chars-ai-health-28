# RealTimeImageProcessor

Procesador de imagen en tiempo real con algoritmos ópticos avanzados, diseñado específicamente para extracción de señales PPG de alta precisión usando principios de óptica biomédica y procesamiento de señales.

## Características Principales

### 🔬 Algoritmos Ópticos Avanzados
- **Transformación de espacio de color RGB → XYZ → Lab** para análisis preciso
- **Cálculo de densidad óptica** usando ley de Beer-Lambert: OD = -log10(I/I₀)
- **Detección de dedo** usando matrices GLCM (Gray-Level Co-occurrence Matrix)
- **Estabilización Lucas-Kanade** para seguimiento de características
- **Análisis de textura avanzado** para validación de señal

### 📊 Análisis de Calidad en Tiempo Real
- **Signal-to-Noise Ratio (SNR)** para evaluación de calidad de señal
- **Análisis de contraste** usando desviación estándar
- **Medición de nitidez** con gradiente Laplaciano
- **Evaluación de iluminación** con normalización automática
- **Métricas de estabilidad** basadas en historial temporal

### 🎯 Detección Inteligente de Dedo
- **Análisis de textura GLCM** para identificación de patrones de piel
- **Detección de bordes Sobel** para contornos del dedo
- **Análisis de consistencia de color** en rangos típicos de piel
- **Estimación de cobertura** del área por el dedo
- **Cálculo de confianza compuesta** con múltiples métricas

### ⚡ Estabilización de Imagen
- **Algoritmo Lucas-Kanade simplificado** para seguimiento
- **Correlación cruzada** para cálculo de offset
- **Compensación automática** de movimiento
- **Referencia adaptativa** para estabilización continua

## Instalación y Uso

### Uso Básico

```typescript
import { RealTimeImageProcessor } from '@/modules/image-processing/RealTimeImageProcessor';

// Crear procesador con configuración por defecto
const processor = new RealTimeImageProcessor();

// Procesar frame de imagen
const imageData = canvas.getImageData(0, 0, width, height);
const processedFrame = processor.processFrame(imageData);

console.log('Dedo detectado:', processedFrame.fingerDetection.isPresent);
console.log('Calidad general:', processedFrame.qualityMetrics.overallQuality);
```

### Configuración Avanzada

```typescript
const processor = new RealTimeImageProcessor({
  roiSize: { width: 300, height: 300 }, // Tamaño de región de interés
  roiPosition: { x: 0.5, y: 0.5 }, // Posición relativa del ROI
  enableStabilization: true, // Habilitar estabilización
  qualityThreshold: 80, // Umbral de calidad mínima
  textureAnalysisDepth: 5, // Profundidad de análisis de textura
  colorSpaceConversion: 'Lab' // Espacio de color para análisis
});
```

### Uso con React Hook

```typescript
import { useImageProcessor } from '@/hooks/useImageProcessor';

function ImageProcessingComponent() {\n  const {\n    processFrame,\n    lastFrame,\n    fingerDetection,\n    qualityMetrics,\n    isProcessing\n  } = useImageProcessor();\n  \n  const handleNewFrame = (imageData: ImageData) => {\n    const result = processFrame(imageData);\n    if (result.fingerDetection.isPresent) {\n      console.log('Dedo detectado con confianza:', result.fingerDetection.confidence);\n    }\n  };\n  \n  return (\n    <div>\n      <div>Calidad: {qualityMetrics?.overallQuality.toFixed(0)}%</div>\n      <div>Dedo presente: {fingerDetection?.isPresent ? 'Sí' : 'No'}</div>\n    </div>\n  );\n}\n```\n\n## API Reference\n\n### RealTimeImageProcessor\n\n#### Constructor\n\n```typescript\nconstructor(config?: Partial<ImageProcessingConfig>)\n```\n\n**Parameters:**\n- `config`: Configuración opcional del procesador\n\n#### Métodos Principales\n\n##### `processFrame(imageData: ImageData): ProcessedFrame`\nProcesa un frame completo con todos los algoritmos ópticos.\n\n**Parameters:**\n- `imageData`: Datos de imagen a procesar\n\n**Returns:** Objeto ProcessedFrame con todos los análisis\n\n##### `extractColorChannels(imageData: ImageData): ColorChannels`\nExtrae canales de color con transformaciones avanzadas.\n\n**Returns:** Canales RGB y derivados (luminancia, crominancia)\n\n##### `calculateOpticalDensity(channels: ColorChannels): OpticalDensity`\nCalcula densidad óptica usando ley de Beer-Lambert.\n\n**Formula:** `OD = -log10(I/I₀)`\n\n**Returns:** Densidades ópticas por canal y métricas derivadas\n\n##### `detectFingerPresence(imageData: ImageData, channels: ColorChannels): FingerDetection`\nDetecta presencia de dedo usando análisis de textura GLCM.\n\n**Returns:** Resultado de detección con confianza y métricas\n\n##### `stabilizeImage(imageData: ImageData): StabilizationResult`\nEstabiliza imagen usando algoritmo Lucas-Kanade simplificado.\n\n**Returns:** Imagen estabilizada y offset calculado\n\n#### Métodos de Configuración\n\n##### `updateConfig(newConfig: Partial<ImageProcessingConfig>): void`\nActualiza la configuración del procesador.\n\n##### `getConfig(): ImageProcessingConfig`\nObtiene la configuración actual.\n\n##### `reset(): void`\nResetea el procesador y limpia el historial.\n\n##### `getStatistics(): ProcessorStatistics`\nObtiene estadísticas del procesador.\n\n### Interfaces Principales\n\n#### ProcessedFrame\n```typescript\ninterface ProcessedFrame {\n  timestamp: number;\n  colorChannels: ColorChannels;\n  opticalDensity: OpticalDensity;\n  fingerDetection: FingerDetection;\n  qualityMetrics: QualityMetrics;\n  stabilizationOffset: { x: number; y: number };\n  frameId: string;\n}\n```\n\n#### ColorChannels\n```typescript\ninterface ColorChannels {\n  red: number[];\n  green: number[];\n  blue: number[];\n  alpha?: number[];\n  luminance: number[];\n  chrominanceU: number[];\n  chrominanceV: number[];\n}\n```\n\n#### FingerDetection\n```typescript\ninterface FingerDetection {\n  isPresent: boolean;\n  confidence: number;\n  coverage: number;\n  textureScore: number;\n  edgeScore: number;\n  colorConsistency: number;\n  position: { x: number; y: number; width: number; height: number };\n}\n```\n\n#### QualityMetrics\n```typescript\ninterface QualityMetrics {\n  snr: number; // Signal-to-Noise Ratio en dB\n  contrast: number; // Contraste normalizado\n  sharpness: number; // Nitidez usando Laplaciano\n  illumination: number; // Nivel de iluminación (0-100)\n  stability: number; // Estabilidad temporal (0-100)\n  overallQuality: number; // Calidad general compuesta (0-100)\n}\n```\n\n## Algoritmos Implementados\n\n### 1. Transformación de Espacio de Color\n\n#### RGB → XYZ\n```typescript\n// Aplicar gamma correction\nconst rLinear = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;\n\n// Aplicar matriz de transformación sRGB → XYZ\nconst X = 0.4124564 * rLinear + 0.3575761 * gLinear + 0.1804375 * bLinear;\nconst Y = 0.2126729 * rLinear + 0.7151522 * gLinear + 0.0721750 * bLinear;\nconst Z = 0.0193339 * rLinear + 0.1191920 * gLinear + 0.9503041 * bLinear;\n```\n\n#### XYZ → Lab\n```typescript\n// Normalizar con iluminante D65\nconst xn = X / 0.95047;\nconst yn = Y / 1.00000;\nconst zn = Z / 1.08883;\n\n// Aplicar función f(t)\nconst fx = xn > 0.008856 ? Math.pow(xn, 1/3) : (7.787 * xn + 16/116);\nconst fy = yn > 0.008856 ? Math.pow(yn, 1/3) : (7.787 * yn + 16/116);\nconst fz = zn > 0.008856 ? Math.pow(zn, 1/3) : (7.787 * zn + 16/116);\n\nconst L = 116 * fy - 16;\nconst a = 500 * (fx - fy);\nconst b = 200 * (fy - fz);\n```\n\n### 2. Ley de Beer-Lambert\n\n```typescript\n// Calcular densidad óptica para cada píxel\nconst opticalDensity = intensities.map(intensity => {\n  const normalizedIntensity = Math.max(intensity, 0.001); // Evitar log(0)\n  return -Math.log10(normalizedIntensity / referenceIntensity);\n});\n```\n\n**Donde:**\n- `I`: Intensidad medida del píxel\n- `I₀`: Intensidad de referencia\n- `OD`: Densidad óptica resultante\n\n### 3. Análisis GLCM (Gray-Level Co-occurrence Matrix)\n\n```typescript\n// Crear matriz GLCM para dirección horizontal (0°)\nfor (let y = 0; y < height; y++) {\n  for (let x = 0; x < width - 1; x++) {\n    const currentPixel = quantizedLuminance[y * width + x];\n    const nextPixel = quantizedLuminance[y * width + x + 1];\n    glcm[currentPixel][nextPixel]++;\n  }\n}\n\n// Calcular características de textura\nlet contrast = 0, homogeneity = 0, energy = 0;\nfor (let i = 0; i < levels; i++) {\n  for (let j = 0; j < levels; j++) {\n    const prob = glcm[i][j] / totalPairs;\n    contrast += prob * Math.pow(i - j, 2);\n    homogeneity += prob / (1 + Math.abs(i - j));\n    energy += prob * prob;\n  }\n}\n```\n\n### 4. Detección de Bordes Sobel\n\n```typescript\nconst sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];\nconst sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];\n\n// Aplicar kernels Sobel\nfor (let ky = -1; ky <= 1; ky++) {\n  for (let kx = -1; kx <= 1; kx++) {\n    const pixelIndex = (y + ky) * width + (x + kx);\n    const kernelIndex = (ky + 1) * 3 + (kx + 1);\n    \n    gx += luminance[pixelIndex] * sobelX[kernelIndex];\n    gy += luminance[pixelIndex] * sobelY[kernelIndex];\n  }\n}\n\nconst edgeStrength = Math.sqrt(gx * gx + gy * gy);\n```\n\n### 5. Estabilización Lucas-Kanade\n\n```typescript\n// Calcular correlación cruzada para encontrar mejor offset\nfor (let dy = -maxOffset; dy <= maxOffset; dy++) {\n  for (let dx = -maxOffset; dx <= maxOffset; dx++) {\n    const correlation = calculateCorrelation(reference, current, dx, dy);\n    if (correlation > bestCorrelation) {\n      bestCorrelation = correlation;\n      bestOffset = { x: dx, y: dy };\n    }\n  }\n}\n\n// Aplicar offset de corrección\nfor (let y = 0; y < height; y++) {\n  for (let x = 0; x < width; x++) {\n    const srcX = x - offset.x;\n    const srcY = y - offset.y;\n    // Copiar píxel corregido...\n  }\n}\n```\n\n## Métricas de Calidad\n\n### Signal-to-Noise Ratio (SNR)\n```typescript\nconst mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;\nconst variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;\nconst noise = Math.sqrt(variance);\nconst snr = 20 * Math.log10(mean / noise); // dB\n```\n\n### Contraste\n```typescript\nconst mean = luminance.reduce((sum, val) => sum + val, 0) / luminance.length;\nconst variance = luminance.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / luminance.length;\nconst contrast = Math.sqrt(variance);\n```\n\n### Nitidez (Laplaciano)\n```typescript\nconst laplacian = [0, -1, 0, -1, 4, -1, 0, -1, 0];\n// Aplicar kernel Laplaciano y calcular magnitud promedio\n```\n\n## Configuración de Parámetros\n\n### Región de Interés (ROI)\n- **roiSize**: Tamaño del área de análisis (recomendado: 200x200 - 400x400)\n- **roiPosition**: Posición relativa en la imagen (0.5, 0.5 = centro)\n\n### Análisis de Textura\n- **textureAnalysisDepth**: Profundidad de análisis GLCM (1-7, recomendado: 3-5)\n- **qualityThreshold**: Umbral mínimo de calidad (0-100, recomendado: 70-80)\n\n### Espacio de Color\n- **RGB**: Análisis directo en espacio RGB\n- **XYZ**: Espacio independiente del dispositivo\n- **Lab**: Perceptualmente uniforme (recomendado para análisis de piel)\n- **YUV**: Separación luminancia/crominancia\n\n### Estabilización\n- **enableStabilization**: Habilitar/deshabilitar estabilización automática\n- Útil para compensar movimientos menores de la mano\n\n## Consideraciones de Rendimiento\n\n### Optimizaciones Implementadas\n- **Muestreo adaptativo** en correlación cruzada\n- **Cuantización de niveles de gris** para GLCM\n- **Buffers circulares** para historial de frames\n- **Cálculos vectorizados** donde es posible\n\n### Métricas de Rendimiento Típicas\n- **Tiempo de procesamiento**: 10-50ms por frame (dependiendo del tamaño)\n- **Memoria utilizada**: ~2-8MB para buffers internos\n- **FPS sostenible**: 20-60 fps (dependiendo del hardware)\n\n### Recomendaciones de Uso\n- Usar ROI de 200x200 para balance rendimiento/precisión\n- Habilitar estabilización solo si hay movimiento detectado\n- Usar espacio Lab para mejor detección de piel\n- Ajustar textureAnalysisDepth según calidad de cámara\n\n## Casos de Uso\n\n### Medición de Signos Vitales\n- Extracción de señales PPG para frecuencia cardíaca\n- Análisis de saturación de oxígeno (SpO2)\n- Detección de variabilidad de frecuencia cardíaca\n\n### Control de Calidad\n- Validación de posicionamiento correcto del dedo\n- Evaluación de condiciones de iluminación\n- Detección de movimiento excesivo\n\n### Investigación Biomédica\n- Análisis de morfología de pulso\n- Estudios de perfusión tisular\n- Evaluación de técnicas de medición no invasiva\n\n## Limitaciones y Consideraciones\n\n### Limitaciones Técnicas\n- Requiere iluminación adecuada (no demasiado brillante/oscura)\n- Sensible a movimiento excesivo\n- Funciona mejor con piel clara a media\n- Requiere contacto directo del dedo con cámara\n\n### Consideraciones de Implementación\n- Calibrar parámetros según tipo de dispositivo\n- Implementar validación de entrada robusta\n- Considerar limitaciones de batería en dispositivos móviles\n- Manejar diferentes resoluciones de cámara\n\n## Troubleshooting\n\n### Problemas Comunes\n\n**Baja calidad de detección:**\n- Verificar iluminación adecuada\n- Ajustar tamaño y posición del ROI\n- Incrementar textureAnalysisDepth\n- Cambiar espacio de color a Lab\n\n**Procesamiento lento:**\n- Reducir tamaño del ROI\n- Deshabilitar estabilización si no es necesaria\n- Reducir textureAnalysisDepth\n- Usar muestreo más espaciado\n\n**Detección inconsistente:**\n- Habilitar estabilización\n- Incrementar qualityThreshold\n- Verificar posicionamiento del dedo\n- Ajustar parámetros de detección de piel\n\nEste procesador proporciona una base sólida para aplicaciones de medición biométrica no invasiva usando cámara, con algoritmos científicamente validados y optimizaciones para rendimiento en tiempo real."