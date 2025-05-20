
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
    MIN_RED_THRESHOLD: 40,
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 4,
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 2, // Reducido de 3 a 2 para detección más rápida
    MAX_CONSECUTIVE_NO_DETECTIONS: 3 // Nuevo: para desactivar más rápidamente cuando se retira el dedo
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private consecutiveNoDetections: number = 0; // Contador para seguimiento cuando no hay detección
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 300; // Reducido de 500ms a 300ms para respuesta más rápida

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
      this.consecutiveNoDetections = 0; // Resetear contador de no detecciones
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
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
    this.consecutiveNoDetections = 0; // Resetear contador de no detecciones
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
      const redValue = this.extractRedChannel(imageData);
      
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis avanzado de la señal para determinar la presencia del dedo y calidad
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      // Calcular coordenadas del ROI (región de interés)
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
      
      // Logs adicionales para debugging de detección de dedo
      if (this.isCurrentlyDetected !== isFingerDetected) {
        console.log(`Estado de detección cambiado: ${this.isCurrentlyDetected} -> ${isFingerDetected}`, {
          rawValue,
          consecutiveDetections: this.consecutiveDetections,
          consecutiveNoDetections: this.consecutiveNoDetections,
          timestamp: new Date().toISOString()
        });
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

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let maxRed = 0;
    let minRed = 255;
    
    // ROI (Region of Interest) central
    // Usar un área más pequeña y centrada para mejor precisión
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.3; // 30% del tamaño más pequeño
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Matriz para acumular valores por regiones y detectar la mejor área
    const regionSize = 10; // Dividir el ROI en regiones de 10x10 píxeles
    const regions = [];
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Canal rojo
        const g = data[i+1];   // Canal verde
        const b = data[i+2];   // Canal azul
        
        // Solo incluir píxeles que tengan una predominancia clara del rojo
        // Reducimos el umbral de 1.1 a 1.05 para ser un poco más sensibles
        if (r > g * 1.05 && r > b * 1.05) {
          redSum += r;
          greenSum += g;
          blueSum += b;
          pixelCount++;
          
          // Registrar valores máximos y mínimos para calcular contraste
          maxRed = Math.max(maxRed, r);
          minRed = Math.min(minRed, r);
          
          // Registrar región para análisis avanzado
          const regionX = Math.floor((x - startX) / regionSize);
          const regionY = Math.floor((y - startY) / regionSize);
          const regionKey = `${regionX},${regionY}`;
          
          if (!regions[regionKey]) {
            regions[regionKey] = {
              redSum: 0,
              count: 0,
              x: regionX,
              y: regionY
            };
          }
          
          regions[regionKey].redSum += r;
          regions[regionKey].count++;
        }
      }
    }
    
    // Reducir el umbral mínimo de píxeles de 50 a 30 para mayor sensibilidad
    if (pixelCount < 30) {
      return 0;
    }
    
    // Encontrar la región con la mayor intensidad de rojo
    let bestRegion = null;
    let bestAvgRed = 0;
    
    for (const key in regions) {
      const region = regions[key];
      // Reducir el umbral de 10 a 5 píxeles para regiones pequeñas pero válidas
      if (region.count > 5) {
        const avgRed = region.redSum / region.count;
        if (avgRed > bestAvgRed) {
          bestAvgRed = avgRed;
          bestRegion = region;
        }
      }
    }
    
    // Reducir el umbral de 100 a 80 para ser más sensible a detecciones iniciales
    if (bestRegion && bestAvgRed > 80) {
      return bestAvgRed;
    }
    
    // Cálculo estándar si no podemos encontrar una región óptima
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Métricas mejoradas de detección del dedo - reducimos umbrales para mayor sensibilidad
    const isRedDominant = avgRed > (avgGreen * 1.15) && avgRed > (avgBlue * 1.15);
    const hasGoodContrast = pixelCount > 80 && (maxRed - minRed) > 10;
    const isInRange = avgRed > 40 && avgRed < 250; // Reducir umbral inferior a 40
    
    // Devolver el valor procesado o 0 si no se detecta un dedo
    return (isRedDominant && hasGoodContrast && isInRange) ? avgRed : 0;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastDetectionTime;
    
    // Si el valor de entrada es 0 (no se detectó dominancia de rojo), definitivamente no hay dedo
    if (rawValue <= 0) {
      this.consecutiveNoDetections++;
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      
      // Si tenemos suficientes frames consecutivos sin detección, actualizamos el estado
      if (this.consecutiveNoDetections >= this.currentConfig.MAX_CONSECUTIVE_NO_DETECTIONS) {
        this.isCurrentlyDetected = false;
      }
      
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Verificar si el valor está dentro del rango válido con histéresis para evitar oscilaciones
    // La histéresis permite mantener la detección incluso con pequeñas fluctuaciones
    const inRange = this.isCurrentlyDetected
      ? rawValue >= (this.currentConfig.MIN_RED_THRESHOLD - this.currentConfig.HYSTERESIS) &&
        rawValue <= (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.HYSTERESIS)
      : rawValue >= this.currentConfig.MIN_RED_THRESHOLD &&
        rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!inRange) {
      this.consecutiveDetections = 0;
      this.consecutiveNoDetections++;
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
      
      // Cancelamos la detección más rápidamente cuando no hay señal adecuada
      if (this.consecutiveNoDetections >= this.currentConfig.MAX_CONSECUTIVE_NO_DETECTIONS) {
        this.isCurrentlyDetected = false;
      }
      
      // Si aún tenemos detección pero la calidad es baja, reportamos calidad reducida
      const quality = this.isCurrentlyDetected ? Math.max(10, this.calculateStability() * 50) : 0;
      return { isFingerDetected: this.isCurrentlyDetected, quality };
    }

    // Reseteamos el contador de no detecciones cuando hay señal válida
    this.consecutiveNoDetections = 0;
    
    // Calcular estabilidad temporal de la señal
    const stability = this.calculateStability();
    
    // Añadir el valor a nuestro historial para análisis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Actualizar contadores de estabilidad según la calidad de la señal
    if (stability > 0.8) {
      // Señal muy estable, incrementamos rápidamente
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 2, // Incremento más rápido
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.6) {
      // Señal moderadamente estable
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1.5, // Incremento más rápido
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.4) {
      // Señal con estabilidad media
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1, // Incremento normal
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Señal inestable
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Actualizar estado de detección
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered; // Guardar el último valor estable
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }

    // Calcular calidad de la señal considerando varios factores
    const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
    
    // Puntaje por intensidad - evaluar si está en un rango óptimo (ni muy bajo ni saturado)
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
      // La variación óptima para PPG está entre 0.5 y 4 unidades
      variabilityScore = avgVariation > 0.5 && avgVariation < 4 ? 1 : 
                         avgVariation < 0.2 ? 0 : 
                         avgVariation > 10 ? 0 : 
                         0.5;
    }
    
    // Combinar los puntajes con diferentes pesos
    const qualityRaw = stabilityScore * 0.5 + intensityScore * 0.3 + variabilityScore * 0.2;
    
    // Escalar a 0-100 y redondear
    const quality = Math.round(qualityRaw * 100);
    
    // Aplicar umbral final - solo reportamos calidad si hay detección confirmada
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
