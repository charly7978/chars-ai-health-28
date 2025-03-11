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
    MIN_RED_THRESHOLD: 60,     // Increased from 40 to 60 for more strict detection
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 8,       // Increased from 6 to 8 for better stability
    MIN_STABILITY_COUNT: 6,    // Increased from 4 to 6 for more strict stability detection
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 5  // Increased from 3 to 5 for more strict detection sequence
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 300; // Reduced from 500ms to 300ms for quicker timeout

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
    const roiSize = Math.min(imageData.width, imageData.height) * 0.25; // Reduced from 0.3 to 0.25 - stricter center focus
    
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
        
        // Stricter red dominance check - more precise for actual fingers
        // Requiring much stronger red dominance (1.5 instead of 1.1)
        if (r > g * 1.5 && r > b * 1.5) {
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
    
    // Increased threshold for minimum number of red-dominant pixels
    // This helps avoid false positives from small red objects
    if (pixelCount < 100) { // Increased from 50 to 100
      return 0;
    }
    
    // Also require that red pixels represent a significant portion of the ROI
    const roiArea = (endX - startX) * (endY - startY);
    const redCoverage = pixelCount / roiArea;
    if (redCoverage < 0.3) { // At least 30% of ROI should be red-dominant
      return 0;
    }
    
    // Ensure there's enough contrast/texture in the image
    // Low contrast might indicate it's not actually a finger
    if ((maxRed - minRed) < 20) { // Require good variation in red values
      return 0; 
    }
    
    // Find the best region as before
    let bestRegion = null;
    let bestAvgRed = 0;
    
    for (const key in regions) {
      const region = regions[key];
      if (region.count > 15) {  // Increased from 10 to 15 - ensure robust regions
        const avgRed = region.redSum / region.count;
        if (avgRed > bestAvgRed) {
          bestAvgRed = avgRed;
          bestRegion = region;
        }
      }
    }
    
    // If we find a good region, use that value but with stricter threshold
    if (bestRegion && bestAvgRed > 120) { // Increased from 100 to 120
      return bestAvgRed;
    }
    
    // Standard calculation with enhanced criteria
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // More strict metrics for finger detection
    const isRedDominant = avgRed > (avgGreen * 1.5) && avgRed > (avgBlue * 1.5); // Increased from 1.2 to 1.5
    const hasGoodContrast = pixelCount > 150 && (maxRed - minRed) > 20; // Increased contrast requirements
    const isInRange = avgRed > 60 && avgRed < 250; // Narrowed acceptable range
    
    // Return the processed value or 0 if no finger is detected
    return (isRedDominant && hasGoodContrast && isInRange) ? avgRed : 0;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastDetectionTime;
    
    // If the input value is 0 (no red dominance detected), definitely no finger
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Check if the value is within valid range with hysteresis to prevent oscillation
    const inRange = this.isCurrentlyDetected
      ? rawValue >= (this.currentConfig.MIN_RED_THRESHOLD - this.currentConfig.HYSTERESIS) &&
        rawValue <= (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.HYSTERESIS)
      : rawValue >= this.currentConfig.MIN_RED_THRESHOLD &&
        rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!inRange) {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 2); // Faster decrease - from 1 to 2
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 2); // Faster stability loss
      
      // Quicker timeout for detection loss
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT && this.consecutiveDetections < 2) { // Added threshold check
        this.isCurrentlyDetected = false;
      }
      
      // If we still have detection but quality is low, report reduced quality
      const quality = this.isCurrentlyDetected ? Math.max(5, this.calculateStability() * 40) : 0; // Reduced from 50 to 40
      return { isFingerDetected: this.isCurrentlyDetected, quality };
    }

    // Calculate stability temporal de la señal
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
        this.stableFrameCount + 1.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.6) {
      // Señal moderadamente estable
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.4) {
      // Señal con estabilidad media, incremento lento
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Señal inestable
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Update detection state with stricter conditions
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
    }

    // Calculate signal quality with adjusted weights
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
      // La variación óptima para PPG está entre 0.5 y 4 unidades
      variabilityScore = avgVariation > 0.5 && avgVariation < 4 ? 1 : 
                         avgVariation < 0.2 ? 0 : 
                         avgVariation > 10 ? 0 : 
                         0.5;
    }
    
    // Combine scores with adjusted weights - emphasize stability more
    const qualityRaw = stabilityScore * 0.6 + intensityScore * 0.3 + (this.lastValues.length >= 5 ? 0.1 : 0);
    
    // Scale to 0-100 and round
    const quality = Math.round(qualityRaw * 100);
    
    // Apply threshold - only report quality if finger detection is confirmed
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
