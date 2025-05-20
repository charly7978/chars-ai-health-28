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
    MIN_RED_THRESHOLD: 45, // Aumentado de 40 a 45 para exigir más señal
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 8,  // Aumentado de 6 a 8 para exigir más estabilidad
    MIN_STABILITY_COUNT: 5, // Aumentado de 4 a 5 para mayor confiabilidad
    HYSTERESIS: 4, // Reducido de 5 a 4 para ser menos permisivo
    MIN_CONSECUTIVE_DETECTIONS: 3, // Aumentado de 2 a 3 para exigir más consistencia
    MAX_CONSECUTIVE_NO_DETECTIONS: 2 // Reducido de 3 a 2 para desactivar más rápido
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private consecutiveNoDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 250; // Reducido de 300ms a 250ms para respuesta más rápida
  private signalHistory: number[] = []; // Nuevo: historial de señales para análisis de tendencia

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada con configuración", this.currentConfig);
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.signalHistory = []; // Limpiar el historial de señales
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.consecutiveNoDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado con nuevos parámetros");
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
      console.log("PPGSignalProcessor: Iniciando calibración avanzada");
      await this.initialize();
      
      // Realizar ajustes específicos para la calibración
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        // Ajustamos temporalmente algunos parámetros para calibración inicial
        MIN_STABILITY_COUNT: 4, // Más flexible durante calibración
        MIN_CONSECUTIVE_DETECTIONS: 2 // Más sensible durante calibración
      };
      
      console.log("PPGSignalProcessor: Calibración completada con parámetros:", this.currentConfig);
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
      
      // Guardar en historial para análisis de tendencias
      this.signalHistory.push(redValue);
      if (this.signalHistory.length > 30) { // 1 segundo a 30fps
        this.signalHistory.shift();
      }
      
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis avanzado de la señal con verificación de tendencias
      const { isFingerDetected, quality } = this.analyzeSignalAdvanced(filtered, redValue);
      
      // Calcular coordenadas del ROI (región de interés) con mayor precisión
      const roi = this.detectROI(redValue);
      
      // Métricas adicionales para evaluación de calidad
      const perfusionIndex = redValue > 0 ? 
        Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      const signalTrend = this.analyzeSignalTrend();
      
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
          rawValue: redValue,
          consecutiveDetections: this.consecutiveDetections,
          consecutiveNoDetections: this.consecutiveNoDetections,
          signalTrend: signalTrend,
          timestamp: new Date().toISOString()
        });
      }
      
      // Enviar feedback sobre el uso de la linterna cuando es necesario
      if (isFingerDetected && quality < 45 && redValue < 120 && this.onError) {
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
    let pixelCount = 0;
    let maxRed = 0;
    let minRed = 255;
    
    // ROI más centrada para mejor precisión
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.25; // Reducido a 25% para mayor precisión
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Matriz para detectar la mejor área
    const regionSize = 10;
    const regions: Record<string, {redSum: number, count: number, x: number, y: number}> = {};
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Canal rojo
        const g = data[i+1];   // Canal verde
        const b = data[i+2];   // Canal azul
        
        // Criterio más estricto para dominancia de rojo
        if (r > g * 1.10 && r > b * 1.10) { // Aumentado de 1.05 a 1.10
          redSum += r;
          pixelCount++;
          
          // Registrar valores para calcular contraste
          maxRed = Math.max(maxRed, r);
          minRed = Math.min(minRed, r);
          
          // Registrar región para análisis
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
    
    // Exigimos más píxeles para considerar una señal válida
    if (pixelCount < 40) { // Aumentado de 30 a 40
      return 0;
    }
    
    // Encontrar la región con la mayor intensidad de rojo
    let bestRegion = null;
    let bestAvgRed = 0;
    
    for (const key in regions) {
      const region = regions[key];
      // Requerimos más píxeles por región
      if (region.count > 8) { // Aumentado de 5 a 8
        const avgRed = region.redSum / region.count;
        if (avgRed > bestAvgRed) {
          bestAvgRed = avgRed;
          bestRegion = region;
        }
      }
    }
    
    // Umbral más estricto para la detección regional
    if (bestRegion && bestAvgRed > 90) { // Aumentado de 80 a 90
      return bestAvgRed;
    }
    
    // Cálculo con verificación de contraste y rango
    const avgRed = redSum / pixelCount;
    
    // Umbral de contraste más exigente para evitar falsos positivos
    const contrast = maxRed - minRed;
    const hasGoodContrast = contrast > 15; // Aumentado de 10 a 15
    
    // Rango de valores más restrictivo
    const isInRange = avgRed > 45 && avgRed < 250; // Umbral inferior aumentado de 40 a 45
    
    return (hasGoodContrast && isInRange) ? avgRed : 0;
  }

  private analyzeSignalAdvanced(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    
    // Si el valor de entrada es 0, definitivamente no hay dedo
    if (rawValue <= 0) {
      this.consecutiveNoDetections++;
      this.consecutiveDetections = 0;
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 2); // Decremento más agresivo
      
      // Requerimos menos frames sin detección para cancelar
      if (this.consecutiveNoDetections >= this.currentConfig.MAX_CONSECUTIVE_NO_DETECTIONS) {
        this.isCurrentlyDetected = false;
      }
      
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Verificar si el valor está dentro del rango válido con histéresis
    const inRange = this.isCurrentlyDetected
      ? rawValue >= (this.currentConfig.MIN_RED_THRESHOLD - this.currentConfig.HYSTERESIS) &&
        rawValue <= (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.HYSTERESIS)
      : rawValue >= this.currentConfig.MIN_RED_THRESHOLD &&
        rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    // Analizar tendencia para mayor robustez
    const trendAnalysis = this.analyzeSignalTrend();
    
    // Fix the type comparison by changing strict equality to includes check
    if (!inRange || trendAnalysis === 'highly_unstable') {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.consecutiveNoDetections++;
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
      
      // Cancelamos la detección más rápidamente cuando hay inestabilidad
      if (this.consecutiveNoDetections >= this.currentConfig.MAX_CONSECUTIVE_NO_DETECTIONS) {
        this.isCurrentlyDetected = false;
      }
      
      // Reportamos calidad reducida si aún hay detección
      const quality = this.isCurrentlyDetected ? Math.max(10, this.calculateStability() * 40) : 0;
      return { isFingerDetected: this.isCurrentlyDetected, quality };
    }

    // Reseteamos el contador de no detecciones cuando hay señal válida
    this.consecutiveNoDetections = Math.max(0, this.consecutiveNoDetections - 1);
    
    // Calcular estabilidad temporal de la señal con más precisión
    const stability = this.calculateStability();
    
    // Añadir el valor a nuestro historial para análisis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Actualizar contadores de estabilidad según la calidad
    if (stability > 0.85) {
      // Señal muy estable
      this.stableFrameCount += 2;
    } else if (stability > 0.65) {
      // Señal moderadamente estable
      this.stableFrameCount += 1.5;
    } else if (stability > 0.45) {
      // Señal con estabilidad media
      this.stableFrameCount += 1;
    } else {
      // Señal inestable
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }
    
    // Limitamos el máximo valor de estabilidad
    this.stableFrameCount = Math.min(
      this.stableFrameCount, 
      this.currentConfig.MIN_STABILITY_COUNT * 2
    );

    // Actualizar estado de detección
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow && trendAnalysis !== 'highly_unstable') {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }

    // Calcular calidad de la señal con criterios más estrictos
    const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
    
    // Puntaje por intensidad óptima
    const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
    const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
    const intensityScore = Math.max(0, 1 - distanceFromOptimal * 1.5); // Más penalización por desviarse
    
    // Puntaje por variabilidad periódica (esencial para PPG)
    let variabilityScore = 0;
    if (this.lastValues.length >= 6) { // Aumentado de 5 a 6
      const variations = [];
      for (let i = 1; i < this.lastValues.length; i++) {
        variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
      }
      
      const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
      
      // Rango óptimo más estrecho
      variabilityScore = avgVariation > 0.6 && avgVariation < 3.5 ? 1 : 
                         avgVariation < 0.3 ? 0 : 
                         avgVariation > 8 ? 0 : 
                         0.5;
    }
    
    // Análisis de tendencia influye en la calidad
    const trendScore = trendAnalysis === 'stable' ? 1 :
                      trendAnalysis === 'moderately_stable' ? 0.8 :
                      trendAnalysis === 'unstable' ? 0.5 :
                      0.2;
    
    // Combinar los puntajes con pesos ajustados
    const qualityRaw = stabilityScore * 0.4 + intensityScore * 0.25 + variabilityScore * 0.2 + trendScore * 0.15;
    
    // Escalar a 0-100 y redondear
    const quality = Math.round(qualityRaw * 100);
    
    // Solo reportamos calidad si hay detección confirmada
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: this.isCurrentlyDetected ? quality : 0
    };
  }

  private calculateStability(): number {
    if (this.lastValues.length < 3) return 0; // Requerimos más valores para evaluar estabilidad
    
    // Calculamos variaciones entre frames consecutivos
    const variations = this.lastValues.slice(1).map((val, i) => 
      Math.abs(val - this.lastValues[i])
    );
    
    // Verificamos si hay outliers extremos que afecten la estabilidad
    const maxVariation = Math.max(...variations);
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    
    // Penalizar más las variaciones extremas
    const hasOutliers = maxVariation > avgVariation * 5;
    
    // Normalizar con escala más sensible
    return Math.max(0, Math.min(1, 1 - (avgVariation / 40))) * (hasOutliers ? 0.7 : 1);
  }

  // Nuevo método para analizar tendencias en la señal
  private analyzeSignalTrend(): 'stable' | 'moderately_stable' | 'unstable' | 'highly_unstable' {
    if (this.signalHistory.length < 10) return 'moderately_stable';
    
    // Obtener los últimos valores para análisis de tendencia
    const recentValues = this.signalHistory.slice(-10);
    
    // Calcular las diferencias entre valores consecutivos
    const differences = [];
    for (let i = 1; i < recentValues.length; i++) {
      differences.push(recentValues[i] - recentValues[i-1]);
    }
    
    // Calcular el cambio de dirección (signo) entre diferencias consecutivas
    let directionChanges = 0;
    for (let i = 1; i < differences.length; i++) {
      if (Math.sign(differences[i]) !== Math.sign(differences[i-1])) {
        directionChanges++;
      }
    }
    
    // Calcular la variación total (desviación estándar)
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Evaluar estabilidad basada en múltiples factores
    if (stdDev > 50) return 'highly_unstable';
    if (directionChanges > 6) return 'unstable';
    if (stdDev > 25 || directionChanges > 4) return 'moderately_stable';
    return 'stable';
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
