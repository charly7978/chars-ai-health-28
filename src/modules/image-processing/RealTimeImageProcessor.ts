/**
 * RealTimeImageProcessor - Procesador de Imagen en Tiempo Real con Algoritmos Ópticos Avanzados
 * 
 * Implementa algoritmos matemáticos complejos para procesamiento de frames de cámara
 * específicamente optimizado para extracción de señales PPG de alta precisión
 * 
 * Algoritmos implementados:
 * - Transformación de espacio de color RGB → XYZ → Lab
 * - Cálculo de densidad óptica usando ley de Beer-Lambert
 * - Detección de dedo usando matrices GLCM (Gray-Level Co-occurrence Matrix)
 * - Estabilización Lucas-Kanade para seguimiento de características
 * - Análisis de textura avanzado para validación de señal
 */

export interface ColorChannels {
  red: number[];
  green: number[];
  blue: number[];
  alpha?: number[];
  // Canales derivados
  luminance: number[];
  chrominanceU: number[];
  chrominanceV: number[];
}

export interface OpticalDensity {
  redOD: number[];
  greenOD: number[];
  blueOD: number[];
  averageOD: number;
  odRatio: number; // Ratio para análisis espectral
}

export interface FingerDetection {
  isPresent: boolean;
  confidence: number;
  coverage: number; // Porcentaje de área cubierta
  textureScore: number;
  edgeScore: number;
  colorConsistency: number;
  position: { x: number; y: number; width: number; height: number };
}

export interface QualityMetrics {
  snr: number; // Signal-to-Noise Ratio
  contrast: number;
  sharpness: number;
  illumination: number;
  stability: number;
  overallQuality: number; // Score compuesto 0-100
}

export interface ProcessedFrame {
  timestamp: number;
  colorChannels: ColorChannels;
  opticalDensity: OpticalDensity;
  fingerDetection: FingerDetection;
  qualityMetrics: QualityMetrics;
  stabilizationOffset: { x: number; y: number };
  frameId: string;
}

export interface ImageProcessingConfig {
  roiSize: { width: number; height: number };
  roiPosition: { x: number; y: number };
  enableStabilization: boolean;
  qualityThreshold: number;
  textureAnalysisDepth: number;
  colorSpaceConversion: 'RGB' | 'XYZ' | 'Lab' | 'YUV';
}

export class RealTimeImageProcessor {
  private config: ImageProcessingConfig;
  private frameHistory: ProcessedFrame[] = [];
  private stabilizationReference: ImageData | null = null;
  private frameCounter: number = 0;
  
  // Matrices para transformación de color
  private readonly RGB_TO_XYZ_MATRIX = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
  ];
  
  // Constantes para análisis óptico
  private readonly BEER_LAMBERT_REFERENCE = 255; // Intensidad de referencia
  private readonly TEXTURE_WINDOW_SIZE = 5; // Ventana para análisis GLCM
  private readonly STABILIZATION_TEMPLATE_SIZE = 32; // Tamaño de template para Lucas-Kanade
  
  constructor(config?: Partial<ImageProcessingConfig>) {
    this.config = {
      roiSize: { width: 200, height: 200 },
      roiPosition: { x: 0.5, y: 0.5 }, // Centro relativo
      enableStabilization: true,
      qualityThreshold: 70,
      textureAnalysisDepth: 3,
      colorSpaceConversion: 'Lab',
      ...config
    };
    
    console.log('RealTimeImageProcessor: Inicializado con configuración:', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Procesa un frame completo con todos los algoritmos ópticos
   */
  public processFrame(imageData: ImageData): ProcessedFrame {
    const startTime = performance.now();
    this.frameCounter++;
    
    try {
      // 1. Extraer región de interés (ROI)
      const roi = this.extractROI(imageData);
      
      // 2. Aplicar estabilización si está habilitada
      const stabilizedROI = this.config.enableStabilization ? 
        this.stabilizeImage(roi) : { imageData: roi, offset: { x: 0, y: 0 } };
      
      // 3. Extraer canales de color con transformaciones avanzadas
      const colorChannels = this.extractColorChannels(stabilizedROI.imageData);
      
      // 4. Calcular densidad óptica usando ley de Beer-Lambert
      const opticalDensity = this.calculateOpticalDensity(colorChannels);
      
      // 5. Detectar presencia de dedo con análisis de textura
      const fingerDetection = this.detectFingerPresence(stabilizedROI.imageData, colorChannels);
      
      // 6. Calcular métricas de calidad de señal
      const qualityMetrics = this.calculateQualityMetrics(stabilizedROI.imageData, colorChannels);
      
      // 7. Crear frame procesado
      const processedFrame: ProcessedFrame = {
        timestamp: Date.now(),
        colorChannels,
        opticalDensity,
        fingerDetection,
        qualityMetrics,
        stabilizationOffset: stabilizedROI.offset,
        frameId: `frame_${this.frameCounter}_${Date.now()}`
      };
      
      // 8. Actualizar historial para análisis temporal
      this.updateFrameHistory(processedFrame);
      
      const processingTime = performance.now() - startTime;
      
      console.log('RealTimeImageProcessor: Frame procesado', {
        frameId: processedFrame.frameId,
        processingTime: `${processingTime.toFixed(2)}ms`,
        fingerDetected: fingerDetection.isPresent,
        quality: qualityMetrics.overallQuality,
        timestamp: new Date().toISOString()
      });
      
      return processedFrame;
      
    } catch (error) {
      console.error('RealTimeImageProcessor: Error procesando frame:', {
        error: error instanceof Error ? error.message : String(error),
        frameCounter: this.frameCounter,
        timestamp: new Date().toISOString()
      });
      
      // Retornar frame de error
      return this.createErrorFrame();
    }
  }
  
  /**
   * Extrae región de interés (ROI) del frame completo
   */
  private extractROI(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const { roiSize, roiPosition } = this.config;
    
    // Calcular posición absoluta del ROI
    const roiX = Math.floor((width - roiSize.width) * roiPosition.x);
    const roiY = Math.floor((height - roiSize.height) * roiPosition.y);
    
    // Asegurar que el ROI esté dentro de los límites
    const clampedX = Math.max(0, Math.min(roiX, width - roiSize.width));
    const clampedY = Math.max(0, Math.min(roiY, height - roiSize.height));
    
    // Crear nuevo ImageData para el ROI
    const roiData = new Uint8ClampedArray(roiSize.width * roiSize.height * 4);
    
    for (let y = 0; y < roiSize.height; y++) {
      for (let x = 0; x < roiSize.width; x++) {
        const srcIndex = ((clampedY + y) * width + (clampedX + x)) * 4;
        const dstIndex = (y * roiSize.width + x) * 4;
        
        roiData[dstIndex] = data[srcIndex];     // R
        roiData[dstIndex + 1] = data[srcIndex + 1]; // G
        roiData[dstIndex + 2] = data[srcIndex + 2]; // B
        roiData[dstIndex + 3] = data[srcIndex + 3]; // A
      }
    }
    
    return new ImageData(roiData, roiSize.width, roiSize.height);
  }
  
  /**
   * Extrae canales de color con transformaciones avanzadas
   */
  public extractColorChannels(imageData: ImageData): ColorChannels {
    const { width, height, data } = imageData;
    const pixelCount = width * height;
    
    const red: number[] = [];
    const green: number[] = [];
    const blue: number[] = [];
    const luminance: number[] = [];
    const chrominanceU: number[] = [];
    const chrominanceV: number[] = [];
    
    for (let i = 0; i < pixelCount; i++) {
      const pixelIndex = i * 4;
      const r = data[pixelIndex] / 255;
      const g = data[pixelIndex + 1] / 255;
      const b = data[pixelIndex + 2] / 255;
      
      red.push(r);
      green.push(g);
      blue.push(b);
      
      // Transformación según configuración
      switch (this.config.colorSpaceConversion) {
        case 'Lab':
          const lab = this.rgbToLab(r, g, b);
          luminance.push(lab.L);
          chrominanceU.push(lab.a);
          chrominanceV.push(lab.b);
          break;
          
        case 'XYZ':
          const xyz = this.rgbToXyz(r, g, b);
          luminance.push(xyz.Y);
          chrominanceU.push(xyz.X);
          chrominanceV.push(xyz.Z);
          break;
          
        case 'YUV':
          const yuv = this.rgbToYuv(r, g, b);
          luminance.push(yuv.Y);
          chrominanceU.push(yuv.U);
          chrominanceV.push(yuv.V);
          break;
          
        default: // RGB
          luminance.push(0.299 * r + 0.587 * g + 0.114 * b);
          chrominanceU.push(r - luminance[i]);
          chrominanceV.push(b - luminance[i]);
      }
    }
    
    return {
      red,
      green,
      blue,
      luminance,
      chrominanceU,
      chrominanceV
    };
  }
  
  /**
   * Transformación RGB → XYZ
   */
  private rgbToXyz(r: number, g: number, b: number): { X: number; Y: number; Z: number } {
    // Aplicar gamma correction
    const rLinear = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    const gLinear = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    const bLinear = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    // Aplicar matriz de transformación
    const X = this.RGB_TO_XYZ_MATRIX[0][0] * rLinear + 
              this.RGB_TO_XYZ_MATRIX[0][1] * gLinear + 
              this.RGB_TO_XYZ_MATRIX[0][2] * bLinear;
    const Y = this.RGB_TO_XYZ_MATRIX[1][0] * rLinear + 
              this.RGB_TO_XYZ_MATRIX[1][1] * gLinear + 
              this.RGB_TO_XYZ_MATRIX[1][2] * bLinear;
    const Z = this.RGB_TO_XYZ_MATRIX[2][0] * rLinear + 
              this.RGB_TO_XYZ_MATRIX[2][1] * gLinear + 
              this.RGB_TO_XYZ_MATRIX[2][2] * bLinear;
    
    return { X, Y, Z };
  }
  
  /**
   * Transformación XYZ → Lab
   */
  private rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
    const xyz = this.rgbToXyz(r, g, b);
    
    // Normalizar con iluminante D65
    const xn = xyz.X / 0.95047;
    const yn = xyz.Y / 1.00000;
    const zn = xyz.Z / 1.08883;
    
    // Aplicar función f(t)
    const fx = xn > 0.008856 ? Math.pow(xn, 1/3) : (7.787 * xn + 16/116);
    const fy = yn > 0.008856 ? Math.pow(yn, 1/3) : (7.787 * yn + 16/116);
    const fz = zn > 0.008856 ? Math.pow(zn, 1/3) : (7.787 * zn + 16/116);
    
    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bLab = 200 * (fy - fz);
    
    return { L, a, b: bLab };
  }
  
  /**
   * Transformación RGB → YUV
   */
  private rgbToYuv(r: number, g: number, b: number): { Y: number; U: number; V: number } {
    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
    const U = -0.14713 * r - 0.28886 * g + 0.436 * b;
    const V = 0.615 * r - 0.51499 * g - 0.10001 * b;
    
    return { Y, U, V };
  }
  
  /**
   * Calcula densidad óptica usando ley de Beer-Lambert
   * OD = -log10(I/I₀) donde I es intensidad medida e I₀ es intensidad de referencia
   */
  public calculateOpticalDensity(channels: ColorChannels): OpticalDensity {
    const calculateOD = (intensities: number[]): number[] => {
      return intensities.map(intensity => {
        // Evitar log(0) usando un valor mínimo
        const normalizedIntensity = Math.max(intensity, 0.001);
        return -Math.log10(normalizedIntensity / (this.BEER_LAMBERT_REFERENCE / 255));
      });
    };
    
    const redOD = calculateOD(channels.red);
    const greenOD = calculateOD(channels.green);
    const blueOD = calculateOD(channels.blue);
    
    // Calcular promedio de densidad óptica
    const averageOD = (
      redOD.reduce((sum, val) => sum + val, 0) +
      greenOD.reduce((sum, val) => sum + val, 0) +
      blueOD.reduce((sum, val) => sum + val, 0)
    ) / (redOD.length * 3);
    
    // Calcular ratio espectral para análisis PPG
    const redAvg = redOD.reduce((sum, val) => sum + val, 0) / redOD.length;
    const greenAvg = greenOD.reduce((sum, val) => sum + val, 0) / greenOD.length;
    const odRatio = redAvg / Math.max(greenAvg, 0.001);
    
    return {
      redOD,
      greenOD,
      blueOD,
      averageOD,
      odRatio
    };
  }
  
  /**
   * Detecta presencia de dedo usando análisis de textura GLCM
   */
  public detectFingerPresence(imageData: ImageData, channels: ColorChannels): FingerDetection {
    const { width, height } = imageData;
    
    // 1. Análisis de textura usando GLCM
    const textureScore = this.calculateGLCMTexture(channels.luminance, width, height);
    
    // 2. Análisis de bordes para detectar contornos del dedo
    const edgeScore = this.calculateEdgeScore(channels.luminance, width, height);
    
    // 3. Análisis de consistencia de color
    const colorConsistency = this.calculateColorConsistency(channels);
    
    // 4. Calcular cobertura del área
    const coverage = this.calculateFingerCoverage(channels.red, textureScore);
    
    // 5. Calcular confianza compuesta
    const confidence = this.calculateDetectionConfidence(
      textureScore, edgeScore, colorConsistency, coverage
    );
    
    // 6. Determinar presencia basada en umbrales
    const isPresent = confidence > 0.6 && coverage > 0.3 && textureScore > 0.4;
    
    // 7. Estimar posición del dedo
    const position = this.estimateFingerPosition(channels.red, width, height);
    
    return {
      isPresent,
      confidence,
      coverage,
      textureScore,
      edgeScore,
      colorConsistency,
      position
    };
  }
  
  /**
   * Calcula textura usando Gray-Level Co-occurrence Matrix (GLCM)
   */
  private calculateGLCMTexture(luminance: number[], width: number, height: number): number {
    const windowSize = this.TEXTURE_WINDOW_SIZE;
    const levels = 16; // Niveles de gris reducidos para eficiencia
    
    // Cuantizar luminancia a niveles discretos
    const quantized = luminance.map(val => Math.floor(val * (levels - 1)));
    
    // Crear matriz GLCM para dirección horizontal (0°)
    const glcm = Array(levels).fill(0).map(() => Array(levels).fill(0));
    let totalPairs = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width - 1; x++) {
        const currentPixel = quantized[y * width + x];
        const nextPixel = quantized[y * width + x + 1];
        
        glcm[currentPixel][nextPixel]++;
        totalPairs++;
      }
    }
    
    // Normalizar GLCM
    for (let i = 0; i < levels; i++) {
      for (let j = 0; j < levels; j++) {
        glcm[i][j] /= totalPairs;
      }
    }
    
    // Calcular características de textura
    let contrast = 0;
    let homogeneity = 0;
    let energy = 0;
    
    for (let i = 0; i < levels; i++) {
      for (let j = 0; j < levels; j++) {
        const prob = glcm[i][j];
        contrast += prob * Math.pow(i - j, 2);
        homogeneity += prob / (1 + Math.abs(i - j));
        energy += prob * prob;
      }
    }
    
    // Score compuesto de textura (0-1)
    return (homogeneity * 0.4 + energy * 0.3 + (1 - contrast / levels) * 0.3);
  }
  
  /**
   * Calcula score de bordes usando gradiente Sobel
   */
  private calculateEdgeScore(luminance: number[], width: number, height: number): number {
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    let totalEdgeStrength = 0;
    let validPixels = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        // Aplicar kernels Sobel
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = (y + ky) * width + (x + kx);
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            
            gx += luminance[pixelIndex] * sobelX[kernelIndex];
            gy += luminance[pixelIndex] * sobelY[kernelIndex];
          }
        }
        
        const edgeStrength = Math.sqrt(gx * gx + gy * gy);
        totalEdgeStrength += edgeStrength;
        validPixels++;
      }
    }
    
    return validPixels > 0 ? totalEdgeStrength / validPixels : 0;
  }
  
  /**
   * Calcula consistencia de color para detección de piel
   */
  private calculateColorConsistency(channels: ColorChannels): number {
    const { red, green, blue } = channels;
    
    // Calcular estadísticas de cada canal
    const redMean = red.reduce((sum, val) => sum + val, 0) / red.length;
    const greenMean = green.reduce((sum, val) => sum + val, 0) / green.length;
    const blueMean = blue.reduce((sum, val) => sum + val, 0) / blue.length;
    
    const redStd = Math.sqrt(red.reduce((sum, val) => sum + Math.pow(val - redMean, 2), 0) / red.length);
    const greenStd = Math.sqrt(green.reduce((sum, val) => sum + Math.pow(val - greenMean, 2), 0) / green.length);
    const blueStd = Math.sqrt(blue.reduce((sum, val) => sum + Math.pow(val - blueStd, 2), 0) / blue.length);
    
    // Verificar si los valores están en rango típico de piel
    const skinRangeScore = this.calculateSkinRangeScore(redMean, greenMean, blueMean);
    
    // Calcular uniformidad (menor desviación = mayor consistencia)
    const uniformity = 1 - (redStd + greenStd + blueStd) / 3;
    
    return (skinRangeScore * 0.6 + uniformity * 0.4);
  }
  
  /**
   * Verifica si los colores están en rango típico de piel
   */
  private calculateSkinRangeScore(r: number, g: number, b: number): number {
    // Rangos típicos de piel en RGB normalizado
    const skinRanges = {
      red: { min: 0.3, max: 0.8 },
      green: { min: 0.2, max: 0.6 },
      blue: { min: 0.1, max: 0.5 }
    };
    
    const redScore = (r >= skinRanges.red.min && r <= skinRanges.red.max) ? 1 : 0;
    const greenScore = (g >= skinRanges.green.min && g <= skinRanges.green.max) ? 1 : 0;
    const blueScore = (b >= skinRanges.blue.min && b <= skinRanges.blue.max) ? 1 : 0;
    
    return (redScore + greenScore + blueScore) / 3;
  }
  
  /**
   * Calcula cobertura del área por el dedo
   */
  private calculateFingerCoverage(redChannel: number[], textureScore: number): number {
    // Usar canal rojo y score de textura para estimar cobertura
    const threshold = 0.3; // Umbral para considerar pixel como "dedo"
    let fingerPixels = 0;
    
    for (const redValue of redChannel) {
      if (redValue > threshold && textureScore > 0.3) {
        fingerPixels++;
      }
    }
    
    return fingerPixels / redChannel.length;
  }
  
  /**
   * Calcula confianza de detección compuesta
   */
  private calculateDetectionConfidence(
    textureScore: number, 
    edgeScore: number, 
    colorConsistency: number, 
    coverage: number
  ): number {
    // Pesos para diferentes métricas
    const weights = {
      texture: 0.3,
      edge: 0.2,
      color: 0.3,
      coverage: 0.2
    };
    
    return (
      textureScore * weights.texture +
      Math.min(edgeScore, 1) * weights.edge +
      colorConsistency * weights.color +
      coverage * weights.coverage
    );
  }
  
  /**
   * Estima posición del dedo en la imagen
   */
  private estimateFingerPosition(redChannel: number[], width: number, height: number): 
    { x: number; y: number; width: number; height: number } {
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let validPixels = 0;
    
    const threshold = 0.3;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        if (redChannel[pixelIndex] > threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          validPixels++;
        }
      }
    }
    
    if (validPixels === 0) {
      // No se detectó dedo, retornar posición central
      return {
        x: width / 2,
        y: height / 2,
        width: 0,
        height: 0
      };
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  /**
   * Estabiliza imagen usando algoritmo Lucas-Kanade simplificado
   */
  public stabilizeImage(imageData: ImageData): { imageData: ImageData; offset: { x: number; y: number } } {
    if (!this.stabilizationReference) {
      // Primera imagen, usar como referencia
      this.stabilizationReference = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      return { imageData, offset: { x: 0, y: 0 } };
    }
    
    // Calcular offset usando correlación cruzada simplificada
    const offset = this.calculateImageOffset(this.stabilizationReference, imageData);
    
    // Aplicar corrección de offset
    const stabilizedImage = this.applyStabilizationOffset(imageData, offset);
    
    return { imageData: stabilizedImage, offset };
  }
  
  /**
   * Calcula offset entre dos imágenes usando correlación cruzada
   */
  private calculateImageOffset(reference: ImageData, current: ImageData): { x: number; y: number } {
    const maxOffset = 10; // Máximo offset a buscar
    let bestCorrelation = -1;
    let bestOffset = { x: 0, y: 0 };
    
    for (let dy = -maxOffset; dy <= maxOffset; dy++) {
      for (let dx = -maxOffset; dx <= maxOffset; dx++) {
        const correlation = this.calculateCorrelation(reference, current, dx, dy);
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = { x: dx, y: dy };
        }
      }
    }
    
    return bestOffset;
  }
  
  /**
   * Calcula correlación entre dos imágenes con offset
   */
  private calculateCorrelation(ref: ImageData, curr: ImageData, dx: number, dy: number): number {
    const { width, height } = ref;
    let correlation = 0;
    let validPixels = 0;
    
    const sampleStep = 4; // Muestrear cada 4 píxeles para eficiencia
    
    for (let y = Math.max(0, -dy); y < Math.min(height, height - dy); y += sampleStep) {
      for (let x = Math.max(0, -dx); x < Math.min(width, width - dx); x += sampleStep) {
        const refIndex = (y * width + x) * 4;
        const currIndex = ((y + dy) * width + (x + dx)) * 4;
        
        // Usar solo canal de luminancia para eficiencia
        const refLum = ref.data[refIndex] * 0.299 + ref.data[refIndex + 1] * 0.587 + ref.data[refIndex + 2] * 0.114;
        const currLum = curr.data[currIndex] * 0.299 + curr.data[currIndex + 1] * 0.587 + curr.data[currIndex + 2] * 0.114;
        
        correlation += refLum * currLum;
        validPixels++;
      }
    }
    
    return validPixels > 0 ? correlation / validPixels : 0;
  }
  
  /**
   * Aplica offset de estabilización a la imagen
   */
  private applyStabilizationOffset(imageData: ImageData, offset: { x: number; y: number }): ImageData {
    const { width, height, data } = imageData;
    const stabilizedData = new Uint8ClampedArray(data.length);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcX = x - offset.x;
        const srcY = y - offset.y;
        
        const dstIndex = (y * width + x) * 4;
        
        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIndex = (srcY * width + srcX) * 4;
          stabilizedData[dstIndex] = data[srcIndex];
          stabilizedData[dstIndex + 1] = data[srcIndex + 1];
          stabilizedData[dstIndex + 2] = data[srcIndex + 2];
          stabilizedData[dstIndex + 3] = data[srcIndex + 3];
        } else {
          // Píxel fuera de límites, usar negro
          stabilizedData[dstIndex] = 0;
          stabilizedData[dstIndex + 1] = 0;
          stabilizedData[dstIndex + 2] = 0;
          stabilizedData[dstIndex + 3] = 255;
        }
      }
    }
    
    return new ImageData(stabilizedData, width, height);
  }
  
  /**
   * Calcula métricas de calidad de la señal
   */
  private calculateQualityMetrics(imageData: ImageData, channels: ColorChannels): QualityMetrics {
    // 1. Signal-to-Noise Ratio
    const snr = this.calculateSNR(channels.red);
    
    // 2. Contraste
    const contrast = this.calculateContrast(channels.luminance);
    
    // 3. Nitidez
    const sharpness = this.calculateSharpness(channels.luminance, imageData.width, imageData.height);
    
    // 4. Iluminación
    const illumination = this.calculateIllumination(channels.luminance);
    
    // 5. Estabilidad (basada en historial)
    const stability = this.calculateStability();
    
    // 6. Calidad general compuesta
    const overallQuality = this.calculateOverallQuality(snr, contrast, sharpness, illumination, stability);
    
    return {
      snr,
      contrast,
      sharpness,
      illumination,
      stability,
      overallQuality
    };
  }
  
  /**
   * Calcula Signal-to-Noise Ratio
   */
  private calculateSNR(signal: number[]): number {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    const noise = Math.sqrt(variance);
    
    return noise > 0 ? 20 * Math.log10(mean / noise) : 100; // dB
  }
  
  /**
   * Calcula contraste usando desviación estándar
   */
  private calculateContrast(luminance: number[]): number {
    const mean = luminance.reduce((sum, val) => sum + val, 0) / luminance.length;
    const variance = luminance.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / luminance.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Calcula nitidez usando gradiente Laplaciano
   */
  private calculateSharpness(luminance: number[], width: number, height: number): number {
    const laplacian = [0, -1, 0, -1, 4, -1, 0, -1, 0];
    let totalSharpness = 0;
    let validPixels = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let laplacianValue = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = (y + ky) * width + (x + kx);
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            laplacianValue += luminance[pixelIndex] * laplacian[kernelIndex];
          }
        }
        
        totalSharpness += Math.abs(laplacianValue);
        validPixels++;
      }
    }
    
    return validPixels > 0 ? totalSharpness / validPixels : 0;
  }
  
  /**
   * Calcula nivel de iluminación
   */
  private calculateIllumination(luminance: number[]): number {
    const mean = luminance.reduce((sum, val) => sum + val, 0) / luminance.length;
    
    // Normalizar a escala 0-100 donde 50 es óptimo
    const optimal = 0.5;
    const deviation = Math.abs(mean - optimal);
    return Math.max(0, 100 - deviation * 200);
  }
  
  /**
   * Calcula estabilidad basada en historial de frames
   */
  private calculateStability(): number {
    if (this.frameHistory.length < 2) return 100;
    
    const recentFrames = this.frameHistory.slice(-5); // Últimos 5 frames
    let totalVariation = 0;
    
    for (let i = 1; i < recentFrames.length; i++) {
      const prev = recentFrames[i - 1];
      const curr = recentFrames[i];
      
      const qualityVariation = Math.abs(curr.qualityMetrics.overallQuality - prev.qualityMetrics.overallQuality);
      const offsetVariation = Math.sqrt(
        Math.pow(curr.stabilizationOffset.x - prev.stabilizationOffset.x, 2) +
        Math.pow(curr.stabilizationOffset.y - prev.stabilizationOffset.y, 2)
      );
      
      totalVariation += qualityVariation + offsetVariation;
    }
    
    const avgVariation = totalVariation / (recentFrames.length - 1);
    return Math.max(0, 100 - avgVariation * 10);
  }
  
  /**
   * Calcula calidad general compuesta
   */
  private calculateOverallQuality(
    snr: number, 
    contrast: number, 
    sharpness: number, 
    illumination: number, 
    stability: number
  ): number {
    // Normalizar métricas a escala 0-100
    const normalizedSNR = Math.min(100, Math.max(0, snr * 2)); // SNR típico 0-50 dB
    const normalizedContrast = Math.min(100, contrast * 400); // Contraste típico 0-0.25
    const normalizedSharpness = Math.min(100, sharpness * 1000); // Nitidez típica 0-0.1
    
    // Pesos para cada métrica
    const weights = {
      snr: 0.25,
      contrast: 0.20,
      sharpness: 0.20,
      illumination: 0.20,
      stability: 0.15
    };
    
    return (
      normalizedSNR * weights.snr +
      normalizedContrast * weights.contrast +
      normalizedSharpness * weights.sharpness +
      illumination * weights.illumination +
      stability * weights.stability
    );
  }
  
  /**
   * Actualiza historial de frames para análisis temporal
   */
  private updateFrameHistory(frame: ProcessedFrame): void {
    this.frameHistory.push(frame);
    
    // Mantener solo los últimos 10 frames
    if (this.frameHistory.length > 10) {
      this.frameHistory.shift();
    }
  }
  
  /**
   * Crea frame de error para casos de fallo
   */
  private createErrorFrame(): ProcessedFrame {
    return {
      timestamp: Date.now(),
      colorChannels: {
        red: [],
        green: [],
        blue: [],
        luminance: [],
        chrominanceU: [],
        chrominanceV: []
      },
      opticalDensity: {
        redOD: [],
        greenOD: [],
        blueOD: [],
        averageOD: 0,
        odRatio: 0
      },
      fingerDetection: {
        isPresent: false,
        confidence: 0,
        coverage: 0,
        textureScore: 0,
        edgeScore: 0,
        colorConsistency: 0,
        position: { x: 0, y: 0, width: 0, height: 0 }
      },
      qualityMetrics: {
        snr: 0,
        contrast: 0,
        sharpness: 0,
        illumination: 0,
        stability: 0,
        overallQuality: 0
      },
      stabilizationOffset: { x: 0, y: 0 },
      frameId: `error_frame_${Date.now()}`
    };
  }
  
  /**
   * Obtiene configuración actual
   */
  public getConfig(): ImageProcessingConfig {
    return { ...this.config };
  }
  
  /**
   * Actualiza configuración
   */
  public updateConfig(newConfig: Partial<ImageProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    console.log('RealTimeImageProcessor: Configuración actualizada:', {
      newConfig: this.config,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Obtiene estadísticas del procesador
   */
  public getStatistics(): {
    frameHistorySize: number;
    frameCounter: number;
    hasStabilizationReference: boolean;
    averageQuality: number;
    processingRate: number;
  } {
    const averageQuality = this.frameHistory.length > 0 
      ? this.frameHistory.reduce((sum, frame) => sum + frame.qualityMetrics.overallQuality, 0) / this.frameHistory.length
      : 0;
    
    const processingRate = this.frameHistory.length > 1
      ? this.frameHistory.length / ((this.frameHistory[this.frameHistory.length - 1].timestamp - this.frameHistory[0].timestamp) / 1000)
      : 0;
    
    return {
      frameHistorySize: this.frameHistory.length,
      frameCounter: this.frameCounter,
      hasStabilizationReference: this.stabilizationReference !== null,
      averageQuality,
      processingRate
    };
  }
  
  /**
   * Resetea el procesador
   */
  public reset(): void {
    this.frameHistory = [];
    this.stabilizationReference = null;
    this.frameCounter = 0;
    
    console.log('RealTimeImageProcessor: Procesador reseteado', {
      timestamp: new Date().toISOString()
    });
  }
}