
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.1;
  private P: number = 1;
  private X: number = 0;
  private K: number = 0;

  filter(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  
  // Configuración mejorada para detección de dedos
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    // Más permisivo para detección inicial de dedo
    MIN_RED_THRESHOLD: 30,       // Reducido para más fácil detección
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,         
    MIN_STABILITY_COUNT: 4,     
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 2,  // Más rápido para detectar
    
    // Parámetros anti-falsos positivos reforzados
    FINGER_REMOVAL_THRESHOLD: 20,  // Umbral más bajo para considerar que ya no hay dedo
    MIN_RED_COVERAGE: 0.3,         // Mínimo 30% del ROI debe ser rojo (dedo real)
    MIN_FINGER_CONTRAST: 15,       // Contraste mínimo para un dedo real
    MAX_TEXTURE_VARIANCE: 400,     // Objetos con texturas no son dedos
    MAX_EDGE_RATIO: 0.2,           // Objetos con bordes definidos no son dedos
    MIN_RED_DOMINANCE: 1.4,        // Relación R:G y R:B mínima para dedo real
    
    // Temporizadores para estados transitorios
    MAX_EMPTY_FRAME_TIME: 120,     // ms para considerar falso positivo
    MIN_TIME_BEFORE_REDETECTION: 300  // ms antes de permitir nueva detección
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private lastEmptyFrameTime: number = 0;
  private emptyFrameCount: number = 0;
  private lastRedValueWhenDetected: number = 0;
  private falsePositiveCount: number = 0;
  private lastMeasuredTextureVariance: number = 0;
  private lastEdgeRatio: number = 0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.lastEmptyFrameTime = 0;
      this.emptyFrameCount = 0;
      this.lastRedValueWhenDetected = 0;
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.consecutiveDetections = 0;
    this.isCurrentlyDetected = false;
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      console.log("PPGSignalProcessor: Calibración completada");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extracción mejorada para mejor discriminación de dedos vs falsos positivos
      const { 
        redValue, 
        emptyROI, 
        hasStrongTextureOrEdge, 
        textureVariance,
        edgeRatio,
        redGreenRatio,
        redBlueRatio,
        coverage
      } = this.extractRedChannel(imageData);
      
      // Almacenar métricas para depuración y análisis
      this.lastMeasuredTextureVariance = textureVariance;
      this.lastEdgeRatio = edgeRatio;
      
      const now = Date.now();
      
      // Verificar si la textura y relación de borde es típica de un dedo
      const isFingerTexture = textureVariance < this.currentConfig.MAX_TEXTURE_VARIANCE;
      const isFingerEdge = edgeRatio < this.currentConfig.MAX_EDGE_RATIO;
      
      // Verificar si la dominancia del rojo es suficiente (característica clave de un dedo)
      const hasRedDominance = 
          redGreenRatio > this.currentConfig.MIN_RED_DOMINANCE && 
          redBlueRatio > this.currentConfig.MIN_RED_DOMINANCE;
      
      // Verificar cobertura suficiente (dedo real cubre buena parte del ROI)
      const hasSufficientCoverage = coverage >= this.currentConfig.MIN_RED_COVERAGE;
      
      // Lógica específica para manejar frames vacíos (sin dedo)
      if (emptyROI || redValue <= 0) {
        this.emptyFrameCount++;
        this.lastEmptyFrameTime = now;
        
        // Más rápido en descartar la detección después de frames vacíos
        if (this.emptyFrameCount >= 2) {
          if (this.isCurrentlyDetected) {
            this.isCurrentlyDetected = false;
            this.consecutiveDetections = 0;
            this.stableFrameCount = 0;
          }
          
          // Reportar explícitamente como no detectado
          if (this.onSignalReady) {
            this.onSignalReady({
              timestamp: now,
              rawValue: 0,
              filteredValue: 0,
              quality: 0, 
              fingerDetected: false,
              roi: this.detectROI(0),
              perfusionIndex: 0
            });
          }
          return;
        }
      } else {
        // Reset contador de frames vacíos cuando encontramos señal
        this.emptyFrameCount = 0;
      }
      
      // CRITERIO MEJORADO: Evaluar si es un falso positivo basado en múltiples criterios
      const isFalsePositive = 
        hasStrongTextureOrEdge || 
        !isFingerTexture || 
        !isFingerEdge || 
        !hasRedDominance || 
        !hasSufficientCoverage;
      
      if (isFalsePositive) {
        this.falsePositiveCount++;
        
        // Descartar la detección rápidamente si vemos signos de falso positivo
        if (this.isCurrentlyDetected) {
          this.isCurrentlyDetected = false;
          this.consecutiveDetections = 0;
          this.stableFrameCount = 0;
        }
        
        // Enviar estado claro de no detección
        if (this.onSignalReady) {
          this.onSignalReady({
            timestamp: now,
            rawValue: 0,  // Enviamos 0 explícitamente para indicar no detección
            filteredValue: 0,
            quality: 0,
            fingerDetected: false,
            roi: this.detectROI(redValue),
            perfusionIndex: 0
          });
        }
        return;
      }
      
      // Si llegamos aquí, tenemos una señal potencialmente válida
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis mejorado de la señal para determinación precisa del dedo
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      // Si estamos detectando un dedo, recordar el valor para comparación
      if (isFingerDetected) {
        this.lastRedValueWhenDetected = redValue;
      }
      
      // Coordenadas del ROI
      const roi = this.detectROI(redValue);
      
      // Métricas adicionales para debuging y análisis
      const perfusionIndex = redValue > 0 ? 
        Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      // Crear objeto de señal procesada con todos los datos relevantes
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
      };
      
      // Log detallado para depuración
      if (isFingerDetected !== this.isCurrentlyDetected) {
        console.log(`Cambio en detección: ${isFingerDetected ? 'DETECTADO' : 'NO DETECTADO'} - Valor: ${redValue.toFixed(1)}, Calidad: ${quality}, Textura: ${textureVariance.toFixed(1)}, Bordes: ${edgeRatio.toFixed(2)}, Dominancia R/G: ${redGreenRatio.toFixed(1)}, Cobertura: ${(coverage*100).toFixed(1)}%`);
      }
      
      // Enviar feedback sobre el uso de la linterna cuando es necesario
      if (isFingerDetected && quality < 40 && redValue < 120 && this.onError) {
        this.onError({
          code: "LOW_LIGHT",
          message: "Señal débil. Por favor asegúrese de que la linterna esté encendida y el dedo cubra completamente la cámara.",
          timestamp: now
        });
      }
      
      // Advertir si hay sobreexposición (saturación) que afecta la calidad
      if (isFingerDetected && redValue > 240 && this.onError) {
        this.onError({
          code: "OVEREXPOSED",
          message: "La imagen está sobreexpuesta. Intente ajustar la posición del dedo para reducir el brillo.",
          timestamp: now
        });
      }
      
      // Enviar la señal procesada al callback
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Almacenar el último valor procesado para cálculos futuros
      this.lastStableValue = isFingerDetected ? filtered : this.lastStableValue;

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): {
    redValue: number;
    emptyROI: boolean;
    hasStrongTextureOrEdge: boolean;
    textureVariance: number;
    edgeRatio: number;
    redGreenRatio: number;
    redBlueRatio: number;
    coverage: number;
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let maxRed = 0;
    let minRed = 255;
    let edgeCount = 0;
    let textureVarianceSum = 0;
    
    // Usar una ROI más grande centrada para mejor captura del dedo completo
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.5; // ROI muy grande para captura fácil
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Matrices temporales para análisis de textura
    const redMatrix: number[][] = [];
    for (let y = startY; y < endY; y++) {
      redMatrix[y] = [];
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        if (i >= 0 && i < data.length - 3) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          // Criterio más permisivo para la dominancia del rojo inicial
          if (r > g * 1.1 && r > b * 1.1) {
            redSum += r;
            greenSum += g;
            blueSum += b;
            pixelCount++;
            
            redMatrix[y][x] = r;
            
            // Registrar valores máximos y mínimos para calcular contraste
            maxRed = Math.max(maxRed, r);
            minRed = Math.min(minRed, r);
          }
        }
      }
    }
    
    // Análisis de textura y bordes (para descartar objetos que no son dedos)
    for (let y = startY + 1; y < endY - 1; y++) {
      for (let x = startX + 1; x < endX - 1; x++) {
        if (!redMatrix[y] || !redMatrix[y][x]) continue;
        
        const current = redMatrix[y][x];
        const neighbors = [
          redMatrix[y-1]?.[x] || 0,
          redMatrix[y+1]?.[x] || 0,
          redMatrix[y]?.[x-1] || 0,
          redMatrix[y]?.[x+1] || 0
        ].filter(Boolean);
        
        if (neighbors.length > 0) {
          // Calcular varianza local (textura)
          const localVariance = neighbors.reduce((sum, val) => {
            return sum + Math.pow(val - current, 2);
          }, 0) / neighbors.length;
          
          textureVarianceSum += localVariance;
          
          // Detectar bordes fuertes
          const maxDiff = Math.max(...neighbors.map(n => Math.abs(n - current)));
          if (maxDiff > 40) {
            edgeCount++;
          }
        }
      }
    }
    
    // Evaluar criterios
    const roiArea = (endX - startX) * (endY - startY);
    const averageTexture = pixelCount > 0 ? textureVarianceSum / pixelCount : 0;
    const edgeRatio = pixelCount > 0 ? edgeCount / pixelCount : 0;
    const redCoverage = pixelCount / roiArea;
    
    // Detectar si está vacío
    const emptyROI = pixelCount < 50 || redCoverage < this.currentConfig.MIN_RED_COVERAGE;
    
    // Detectar si tiene texturas o bordes fuertes (no característicos de dedos)
    const hasStrongTextureOrEdge = 
      averageTexture > this.currentConfig.MAX_TEXTURE_VARIANCE || 
      edgeRatio > this.currentConfig.MAX_EDGE_RATIO;
    
    // Si el ROI está vacío, retornar 0
    if (emptyROI) {
      return { 
        redValue: 0, 
        emptyROI: true,
        hasStrongTextureOrEdge: false,
        textureVariance: averageTexture,
        edgeRatio: edgeRatio,
        redGreenRatio: 0,
        redBlueRatio: 0,
        coverage: redCoverage
      };
    }
    
    // Asegurar que hay suficiente contraste (un dedo real tiene buen contraste)
    if ((maxRed - minRed) < this.currentConfig.MIN_FINGER_CONTRAST) {
      return { 
        redValue: 0, 
        emptyROI: false,
        hasStrongTextureOrEdge: true,
        textureVariance: averageTexture,
        edgeRatio: edgeRatio,
        redGreenRatio: 0,
        redBlueRatio: 0,
        coverage: redCoverage
      };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calcular ratios de dominancia de rojo
    const redGreenRatio = avgRed / (avgGreen || 1);
    const redBlueRatio = avgRed / (avgBlue || 1);
    
    // Criterios más permisivos para la detección inicial
    const isRedDominant = 
      redGreenRatio > this.currentConfig.MIN_RED_DOMINANCE * 0.8 && 
      redBlueRatio > this.currentConfig.MIN_RED_DOMINANCE * 0.8;
      
    const hasGoodContrast = (maxRed - minRed) > this.currentConfig.MIN_FINGER_CONTRAST * 0.8;
    
    const isInRange = 
      avgRed > this.currentConfig.MIN_RED_THRESHOLD && 
      avgRed < this.currentConfig.MAX_RED_THRESHOLD;
    
    // Return el valor procesado o 0 si no se detecta un dedo
    return {
      redValue: (isRedDominant && hasGoodContrast && isInRange) ? avgRed : 0,
      emptyROI: false,
      hasStrongTextureOrEdge: hasStrongTextureOrEdge,
      textureVariance: averageTexture,
      edgeRatio: edgeRatio,
      redGreenRatio: redGreenRatio,
      redBlueRatio: redBlueRatio,
      coverage: redCoverage
    };
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastDetectionTime;
    
    // Si el input es 0 (no hay dominancia de rojo), definitivamente no hay dedo
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Verificar cambios bruscos de intensidad (podría indicar que se quitó el dedo)
    if (this.isCurrentlyDetected && this.lastRedValueWhenDetected > 0) {
      const intensityChange = Math.abs(rawValue - this.lastRedValueWhenDetected) / this.lastRedValueWhenDetected;
      if (intensityChange > 0.5) { // Cambio de más del 50% indica que se quitó el dedo
        this.consecutiveDetections = 0;
        this.stableFrameCount = 0;
        this.isCurrentlyDetected = false;
        return { isFingerDetected: false, quality: 0 };
      }
    }
    
    // Verificar si el valor está dentro del rango válido con histéresis
    const inRange = this.isCurrentlyDetected
      ? rawValue >= (this.currentConfig.MIN_RED_THRESHOLD - this.currentConfig.HYSTERESIS) &&
        rawValue <= (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.HYSTERESIS)
      : rawValue >= this.currentConfig.MIN_RED_THRESHOLD &&
        rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!inRange) {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
      
      // Timeout de detección más corto para respuesta rápida
      if (timeSinceLastDetection > 200) { // Más rápido para perder detección
        this.isCurrentlyDetected = false;
      }
      
      const quality = this.isCurrentlyDetected ? Math.max(5, this.calculateStability() * 40) : 0;
      return { isFingerDetected: this.isCurrentlyDetected, quality };
    }

    // Calcular estabilidad temporal de la señal
    const stability = this.calculateStability();
    
    // Añadir el valor a nuestro historial para análisis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Actualizar contadores de estabilidad según la calidad de la señal
    // Haciendo más fácil incrementar la estabilidad para dedos reales
    if (stability > 0.6) { // Reducido de 0.7 a 0.6
      // Señal muy estable, incrementamos rápidamente
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 2,  // Incremento más rápido
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.4) { // Reducido de 0.5 a 0.4
      // Señal moderadamente estable
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1.5,  // Incremento más rápido
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.2) { // Reducido de 0.3 a 0.2
      // Señal con estabilidad media, incremento moderado
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.8,  // Incremento más rápido
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Señal inestable
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Actualizar estado de detección con condiciones más permisivas para dedos reales
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow) {
      this.consecutiveDetections += 1.5; // Incremento más rápido
      
      // Detección más rápida para reducir la espera del usuario
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }

    // Calcular calidad de la señal 
    const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
    
    // Puntuación de intensidad - evaluar si está en un rango óptimo
    const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
    const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
    const intensityScore = Math.max(0, 1 - distanceFromOptimal);
    
    // Puntuación por variabilidad - una buena señal PPG debe tener cierta variabilidad periódica
    let variabilityScore = 0;
    if (this.lastValues.length >= 4) { // Reducido para evaluación más rápida
      const variations = [];
      for (let i = 1; i < this.lastValues.length; i++) {
        variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
      }
      
      const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
      variabilityScore = avgVariation > 0.3 && avgVariation < 8 ? 1 : 
                         avgVariation < 0.1 ? 0 : 
                         avgVariation > 15 ? 0 : 
                         0.5;
    }
    
    // Combine scores con pesos ajustados para maximizar calidad de dedos reales
    const qualityRaw = stabilityScore * 0.6 + intensityScore * 0.3 + (this.lastValues.length >= 4 ? variabilityScore * 0.1 : 0);
    
    // Escalar a 0-100 y redondear
    const quality = Math.round(qualityRaw * 100);
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: this.isCurrentlyDetected ? quality : 0
    };
  }

  private calculateStability(): number {
    if (this.lastValues.length < 2) return 0;
    
    const variations = this.lastValues.slice(1).map((val, i) => 
      Math.abs(val - this.lastValues[i])
    );
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    return Math.max(0, Math.min(1, 1 - (avgVariation / 50)));
  }

  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }

  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    this.onError?.(error);
  }
}
