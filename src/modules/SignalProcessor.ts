
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
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 50,     // Reducido de 60 a 50 para más fácil detección
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,       // Reducido de 8 a 6 para facilitar la detección
    MIN_STABILITY_COUNT: 4,    // Reducido de 6 a 4 para facilitar la detección
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 3,  // Reducido de 5 a 3 para detección más rápida
    // Parámetros específicos para descartar falsos positivos cuando no hay dedo
    FINGER_REMOVAL_THRESHOLD: 40,  // Umbral fuerte para considerar que no hay dedo
    MIN_RED_COVERAGE: 0.25,     // Al menos 25% del ROI debe ser rojo
    MIN_FINGER_CONTRAST: 12,    // Contraste mínimo para un dedo real
    MAX_EMPTY_FRAME_TIME: 150  // Tiempo máximo en ms para considerar falso positivo
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private lastEmptyFrameTime: number = 0;
  private readonly DETECTION_TIMEOUT = 250; // ms para resetear detección
  private emptyFrameCount: number = 0;
  private lastRedValueWhenDetected: number = 0;

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
      // Extraer y procesar el canal rojo (el más importante para PPG)
      const { redValue, emptyROI, hasStrongTextureOrEdge } = this.extractRedChannel(imageData);
      
      // Lógica específica para manejar frames vacíos (sin dedo)
      if (emptyROI || redValue <= 0) {
        const now = Date.now();
        this.emptyFrameCount++;
        this.lastEmptyFrameTime = now;
        
        // Si tenemos múltiples frames vacíos consecutivos, reseteamos la detección
        if (this.emptyFrameCount >= 3) {
          if (this.isCurrentlyDetected) {
            // Resetear estado de detección después de frames vacíos consistentes
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
      
      // Si detectamos bordes fuertes o texturas que no son un dedo, rechazar
      if (hasStrongTextureOrEdge && redValue < 100) {
        if (this.isCurrentlyDetected) {
          // Mantener brevemente la detección para evitar parpadeos
          const timeSinceLastDetection = Date.now() - this.lastDetectionTime;
          if (timeSinceLastDetection > 300) {
            this.isCurrentlyDetected = false;
            this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 2);
          }
        }
        
        // Enviar estado de no detección
        if (this.onSignalReady) {
          this.onSignalReady({
            timestamp: Date.now(),
            rawValue: redValue,
            filteredValue: 0,
            quality: 0,
            fingerDetected: false,
            roi: this.detectROI(redValue),
            perfusionIndex: 0
          });
        }
        return;
      }
      
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis avanzado de la señal para determinar la presencia del dedo y calidad
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      // Si estamos detectando un dedo, recordar el valor para comparación
      if (isFingerDetected) {
        this.lastRedValueWhenDetected = redValue;
      }
      
      // Coordenadas del ROI (región de interés)
      const roi = this.detectROI(redValue);
      
      // Métricas adicionales para debugging y análisis
      const perfusionIndex = redValue > 0 ? 
        Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      // Crear objeto de señal procesada con todos los datos relevantes
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
      };
      
      // Log detallado para depuración
      if (isFingerDetected !== this.isCurrentlyDetected) {
        console.log(`Cambio en detección: ${isFingerDetected ? 'DETECTADO' : 'NO DETECTADO'} - Valor: ${redValue.toFixed(1)}, Calidad: ${quality}`);
      }
      
      // Enviar feedback sobre el uso de la linterna cuando es necesario
      if (isFingerDetected && quality < 40 && redValue < 120 && this.onError) {
        // Señal detectada pero débil - podría indicar poca iluminación
        this.onError({
          code: "LOW_LIGHT",
          message: "Señal débil. Por favor asegúrese de que la linterna esté encendida y el dedo cubra completamente la cámara.",
          timestamp: Date.now()
        });
      }
      
      // Advertir si hay sobreexposición (saturación) que afecta la calidad
      if (isFingerDetected && redValue > 240 && this.onError) {
        this.onError({
          code: "OVEREXPOSED",
          message: "La imagen está sobreexpuesta. Intente ajustar la posición del dedo para reducir el brillo.",
          timestamp: Date.now()
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
    
    // ROI más grande y centrada para mejor detección de dedo
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.35; // Incrementado de 0.25 a 0.35
    
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
          
          // Criterio más permisivo para la dominancia del rojo
          // Más fácil de detectar dedos reales
          if (r > g * 1.2 && r > b * 1.2) {
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
          if (maxDiff > 50) {
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
    const hasStrongTextureOrEdge = averageTexture > 400 || edgeRatio > 0.25;
    
    // Si el ROI está vacío, retornar 0
    if (emptyROI) {
      return { 
        redValue: 0, 
        emptyROI: true,
        hasStrongTextureOrEdge: false 
      };
    }
    
    // Asegurar que hay suficiente contraste (un dedo real tiene buen contraste)
    if ((maxRed - minRed) < this.currentConfig.MIN_FINGER_CONTRAST) {
      return { 
        redValue: 0, 
        emptyROI: false,
        hasStrongTextureOrEdge: true 
      };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Criterios más permisivos para la detección de dedos
    const isRedDominant = avgRed > (avgGreen * 1.2) && avgRed > (avgBlue * 1.2);
    const hasGoodContrast = (maxRed - minRed) > this.currentConfig.MIN_FINGER_CONTRAST;
    const isInRange = avgRed > this.currentConfig.MIN_RED_THRESHOLD && avgRed < this.currentConfig.MAX_RED_THRESHOLD;
    
    // Return el valor procesado o 0 si no se detecta un dedo
    return {
      redValue: (isRedDominant && hasGoodContrast && isInRange) ? avgRed : 0,
      emptyROI: false,
      hasStrongTextureOrEdge: hasStrongTextureOrEdge
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
      if (intensityChange > 0.6) { // Cambio de más del 60% indica que se quitó el dedo
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
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT) {
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
    if (stability > 0.7) { // Reducido de 0.8 a 0.7
      // Señal muy estable, incrementamos rápidamente
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.5) { // Reducido de 0.6 a 0.5
      // Señal moderadamente estable
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.3) { // Reducido de 0.4 a 0.3
      // Señal con estabilidad media, incremento lento
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Señal inestable
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Actualizar estado de detección con condiciones más permisivas
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5); // Reducido para ser más permisivo
    }

    // Calcular calidad de la señal con pesos ajustados
    const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
    
    // Intensity score - evaluate if it's in an optimal range (not too low or saturated)
    const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
    const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
    const intensityScore = Math.max(0, 1 - distanceFromOptimal);
    
    // Puntaje por variabilidad - una buena señal PPG debe tener cierta variabilidad periódica
    let variabilityScore = 0;
    if (this.lastValues.length >= 5) {
      const variations = [];
      for (let i = 1; i < this.lastValues.length; i++) {
        variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
      }
      
      const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
      // La variación óptima para PPG está entre 0.5 y 5 unidades - más permisivo
      variabilityScore = avgVariation > 0.3 && avgVariation < 5 ? 1 : 
                         avgVariation < 0.1 ? 0 : 
                         avgVariation > 12 ? 0 : 
                         0.5;
    }
    
    // Combine scores con pesos ajustados
    const qualityRaw = stabilityScore * 0.6 + intensityScore * 0.3 + (this.lastValues.length >= 5 ? variabilityScore * 0.1 : 0);
    
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
