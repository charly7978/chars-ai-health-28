import { ColorData } from '../../types';

export class ColorAnalyzer {
  private static readonly SKIN_COLOR_THRESHOLD = 0.7;
  private static readonly GAUSSIAN_KERNEL_SIZE = 5;
  private static readonly GAUSSIAN_SIGMA = 1.0;

  private calculateSkinConfidence(r: number, g: number, b: number): number {
    // Implementación basada en el modelo de color de piel
    const rg = r / g;
    const gb = g / b;
    
    // Umbral basado en investigación médica
    if (rg > 1.1 && gb > 1.1 && r > 50 && g > 40 && b > 20) {
      return Math.min(1.0, (rg - 1.0) * 0.5 + (gb - 1.0) * 0.5);
    }
    return 0;
  }

  private applyChromaticCorrection(r: number, g: number, b: number): { r: number; g: number; b: number } {
    // Corrección cromática basada en la relación R/G/B
    const total = r + g + b;
    if (total === 0) return { r, g, b };
    
    const rRatio = r / total;
    const gRatio = g / total;
    const bRatio = b / total;
    
    // Ajuste empírico basado en datos clínicos
    return {
      r: r * (1 + 0.1 * gRatio),
      g: g * (1 - 0.05 * rRatio),
      b: b * (1 - 0.05 * gRatio)
    };
  }

  private applyGaussianFilter(imageData: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const kernel = this.createGaussianKernel();
    
    // Crear nuevo buffer para los datos filtrados
    const filteredData = new Uint8ClampedArray(imageData.length);
    
    // Aplicar convolución
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const values = this.applyKernel(imageData, x, y, kernel, width, height);
        
        // Asignar valores filtrados
        filteredData[index] = values.r;
        filteredData[index + 1] = values.g;
        filteredData[index + 2] = values.b;
        filteredData[index + 3] = imageData[index + 3]; // Alpha
      }
    }
    
    return filteredData;
  }

  private createGaussianKernel(): number[][] {
    const size = ColorAnalyzer.GAUSSIAN_KERNEL_SIZE;
    const kernel: number[][] = [];
    const sum = 1 / (2 * Math.PI * ColorAnalyzer.GAUSSIAN_SIGMA ** 2);
    
    for (let y = -Math.floor(size/2); y <= Math.floor(size/2); y++) {
      const row: number[] = [];
      for (let x = -Math.floor(size/2); x <= Math.floor(size/2); x++) {
        const exponent = -(x**2 + y**2) / (2 * ColorAnalyzer.GAUSSIAN_SIGMA ** 2);
        row.push(sum * Math.exp(exponent));
      }
      kernel.push(row);
    }
    
    // Normalizar kernel
    const total = kernel.flat().reduce((a, b) => a + b, 0);
    return kernel.map(row => row.map(val => val / total));
  }

  private applyKernel(imageData: Uint8ClampedArray, x: number, y: number, kernel: number[][], width: number, height: number): { r: number; g: number; b: number } {
    const size = kernel.length;
    const half = Math.floor(size/2);
    
    let rSum = 0, gSum = 0, bSum = 0;
    let weightSum = 0;
    
    for (let ky = 0; ky < size; ky++) {
      for (let kx = 0; kx < size; kx++) {
        const dx = x + (kx - half);
        const dy = y + (ky - half);
        
        // Verificar límites
        if (dx >= 0 && dx < width && dy >= 0 && dy < height) {
          const index = (dy * width + dx) * 4;
          const weight = kernel[ky][kx];
          
          rSum += imageData[index] * weight;
          gSum += imageData[index + 1] * weight;
          bSum += imageData[index + 2] * weight;
          weightSum += weight;
        }
      }
    }
    
    return {
      r: Math.round(rSum / weightSum),
      g: Math.round(gSum / weightSum),
      b: Math.round(bSum / weightSum)
    };
  }

  async analyzeFrameColor(imageData: Uint8ClampedArray, width: number, height: number): Promise<ColorData> {
    const filteredData = this.applyGaussianFilter(imageData, width, height);
    
    let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = filteredData[index];
        const g = filteredData[index + 1];
        const b = filteredData[index + 2];
        
        // Calcular confianza de piel
        const confidence = this.calculateSkinConfidence(r, g, b);
        
        // Aplicar corrección cromática
        const corrected = this.applyChromaticCorrection(r, g, b);
        
        // Acumular con peso basado en confianza
        totalR += corrected.r * confidence;
        totalG += corrected.g * confidence;
        totalB += corrected.b * confidence;
        totalWeight += confidence;
      }
    }
    
    // Promedio ponderado
    return {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight)
    };

      // Aplicar corrección cromática
      const corrected = this.applyChromaticCorrection(rAvg, gAvg, bAvg);

      // Normalizar valores con consideración de iluminación
      const maxVal = Math.max(corrected.r, corrected.g, corrected.b);
      resolve({
        r: (corrected.r / maxVal) * 255,
        g: (corrected.g / maxVal) * 255,
        b: (corrected.b / maxVal) * 255
      });
    });
  }
}
