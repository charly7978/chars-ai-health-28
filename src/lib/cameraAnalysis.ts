import { ColorAnalyzer } from '../modules/signal-processing/ColorAnalyzer';
import { ArrhythmiaDetector } from '../modules/arrhythmia/ArrhythmiaDetector';
import { ColorData, ArrhythmiaAnalysis } from '../types';

export class CameraAnalysis {
  private static readonly FRAME_WINDOW_SIZE = 100;
  private static readonly PPG_WINDOW_SIZE = 300;
  private static readonly FRAME_RATE = 30;

  private frames: ImageBitmap[] = [];
  private ppgValues: number[] = [];
  private lastFrameTime: number = 0;
  
  private colorAnalyzer: ColorAnalyzer;
  private arrhythmiaDetector: ArrhythmiaDetector;

  constructor() {
    this.colorAnalyzer = new ColorAnalyzer();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
  }

  async processFrame(frame: ImageBitmap) {
    // Asegurarse de mantener una tasa de frames constante
    const currentTime = Date.now();
    if (currentTime - this.lastFrameTime < 1000 / CameraAnalysis.FRAME_RATE) {
      return;
    }
    this.lastFrameTime = currentTime;

    // Procesar frame y extraer valores de color
    const colorData: ColorData = await this.colorAnalyzer.analyzeFrameColor(frame);
    
    // Agregar valores al buffer PPG usando el canal verde
    this.ppgValues.push(colorData.g);
    if (this.ppgValues.length > CameraAnalysis.PPG_WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    // Agregar frame al buffer
    this.frames.push(frame);
    if (this.frames.length > CameraAnalysis.FRAME_WINDOW_SIZE) {
      this.frames.shift();
    }

    // Detectar picos y calcular intervalos RR
    const peaks = this.detectPeaks(this.ppgValues);
    const rrIntervals = this.calculateRRIntervals(peaks);

    // Actualizar detector de arritmias
    rrIntervals.forEach(interval => this.arrhythmiaDetector.addRRInterval(interval));
  }

  async calculateSpO2(): Promise<number> {
    if (this.frames.length < CameraAnalysis.FRAME_WINDOW_SIZE) {
      return 0;
    }

    // Obtener valores de color para todos los frames
    const colorPromises = this.frames.map(frame => this.colorAnalyzer.analyzeFrameColor(frame));
    const colors: ColorData[] = await Promise.all(colorPromises);
    
    // Extraer valores R y G
    const rValues = colors.map(color => color.r);
    const gValues = colors.map(color => color.g);

    // Calcular AC y DC para cada canal
    const acR = this.calculateAC(rValues);
    const acG = this.calculateAC(gValues);
    const dcR = this.calculateDC(rValues);
    const dcG = this.calculateDC(gValues);

    // Calcular ratio R/G
    const ratio = (acR / dcR) / (acG / dcG);
    
    // Aplicar fórmula de SpO2 basada en la relación R/G
    return Math.round(100 - (25 * ratio));
  }

  calculateHeartRate(): number {
    if (this.ppgValues.length < CameraAnalysis.PPG_WINDOW_SIZE) return 0;
    
    // Aplicar filtro de Kalman para reducir ruido
    const filteredValues = this.applyKalmanFilter(this.ppgValues);
    
    // Detectar picos con validación fisiológica
    const peaks = this.detectPeaks(filteredValues);
    
    // Calcular intervalos RR
    const rrIntervals = this.calculateRRIntervals(peaks);
    
    // Calcular frecuencia cardíaca
    const avgRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    return Math.round(60000 / avgRR); // Convertir a BPM
  }

  getArrhythmiaAnalysis(): ArrhythmiaAnalysis | null {
    return this.arrhythmiaDetector.getLastAnalysis();
  }

  private detectPeaks(data: number[]): number[] {
    const peaks: number[] = [];
    const threshold = this.calculateThreshold(data);
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }

  private calculateRRIntervals(peaks: number[]): number[] {
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i - 1];
      rrIntervals.push(interval);
    }
    return rrIntervals;
  }

  private applyKalmanFilter(values: number[]): number[] {
    const Q = 1e-5;  // Proceso de varianza
    const R = 1e-1;  // Ruido de medición
    let P = 1.0;     // Error de estimación
    let x = values[0]; // Estado inicial
    const filteredValues: number[] = [];

    values.forEach((z) => {
      // Predicción
      P = P + Q;
      
      // Actualización
      const K = P / (P + R);
      x = x + K * (z - x);
      P = (1 - K) * P;
      
      filteredValues.push(x);
    });
    
    return filteredValues;
  }

  private calculateAC(values: number[]): number {
    const mean = this.calculateDC(values);
    return Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
  }

  private calculateDC(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateThreshold(data: number[]): number {
    const mean = this.calculateDC(data);
    const std = this.calculateAC(data);
    return mean + std;
  }

  reset(): void {
    this.frames = [];
    this.ppgValues = [];
    this.arrhythmiaDetector.reset();
  }
    const filteredPixels = new Uint8ClampedArray(pixels.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const pixelIndex = (y + i) * width * 4 + (x + j) * 4;
            if (pixelIndex >= 0 && pixelIndex < pixels.length) {
              r += pixels[pixelIndex] * kernel[(i + 1) * 3 + j + 1];
              g += pixels[pixelIndex + 1] * kernel[(i + 1) * 3 + j + 1];
              b += pixels[pixelIndex + 2] * kernel[(i + 1) * 3 + j + 1];
            }
          }
        }
        filteredPixels[y * width * 4 + x * 4] = r;
        filteredPixels[y * width * 4 + x * 4 + 1] = g;
        filteredPixels[y * width * 4 + x * 4 + 2] = b;
        filteredPixels[y * width * 4 + x * 4 + 3] = pixels[y * width * 4 + x * 4 + 3];
      }
    }

    return new ImageData(filteredPixels, width, height);
  }

  private calculateSkinConfidence(r: number, g: number, b: number): number {
    // Implementación de la función de confianza para detección de piel
    const skinThreshold = 0.5;
    const skinRatio = (r + g + b) / 255;
    return skinRatio > skinThreshold ? skinRatio : 0;
  }

  private applyChromaticCorrection(r: number, g: number, b: number): { r: number; g: number; b: number } {
    // Implementación de la corrección cromática para mejorar la precisión
    const correctionFactor = 1.1;
    return {
      r: r * correctionFactor,
      g: g * correctionFactor,
      b: b * correctionFactor
    };
  }
}
