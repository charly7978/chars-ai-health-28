import { FrameData } from './types';
import { ProcessedSignal } from '../../types/signal';

// Constants for signal processing
const DEFAULT_RED_VALUE = 5;
const DEFAULT_GREEN_VALUE = 4;
const DEFAULT_BLUE_VALUE = 4;
const DEFAULT_RATIO = 1.2;
const MIN_PIXEL_VALUE = 0;
const MAX_PIXEL_VALUE = 255;
const MIN_VALID_PIXELS = 100;

/**
 * Processes video frames to extract PPG signals and detect ROI
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
 */
export class FrameProcessor {
  private readonly CONFIG: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number };
  // Parámetros ajustados para mejor extracción de señal
  private readonly RED_GAIN = 1.4; // Aumentado para mejor amplificación de señal roja (antes 1.2)
  private readonly GREEN_SUPPRESSION = 0.8; // Menos supresión para mantener información (antes 0.85)
  private readonly SIGNAL_GAIN = 1.3; // Aumentado para mejor detección (antes 1.1)
  private readonly EDGE_ENHANCEMENT = 0.18;  // Ajustado para mejor detección de bordes (antes 0.12)
  private readonly MIN_RED_THRESHOLD = 0.28;  // Ligero aumento adicional
  private readonly RG_RATIO_RANGE = [1.0, 3.0];  // Rango más estrecho
  private readonly EDGE_CONTRAST_THRESHOLD = 0.12;  // Nuevo filtro por contraste
  
  // Historia para calibración adaptativa
  private lastFrames: Array<{red: number, green: number, blue: number}> = [];
  private readonly HISTORY_SIZE = 15; // Reducido para adaptación más rápida (antes 20)
  private lastLightLevel: number = -1;
  
  // Nuevo: historial de ROIs para estabilidad
  private roiHistory: Array<{x: number, y: number, width: number, height: number}> = [];
  private readonly ROI_HISTORY_SIZE = 5;
  
  constructor(config: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number }) {
    // Aumentar tamaño de ROI para capturar más área
    this.CONFIG = {
      ...config,
      ROI_SIZE_FACTOR: Math.min(0.8, config.ROI_SIZE_FACTOR * 1.15) // Aumentar tamaño ROI sin exceder 0.8
    };
  }
  
  /**
   * Returns default frame data with safe fallback values
   */
  private getDefaultFrameData(): FrameData {
    return {
      redValue: DEFAULT_RED_VALUE,
      textureScore: 0.6,
      rToGRatio: DEFAULT_RATIO,
      rToBRatio: DEFAULT_RATIO,
      avgRed: DEFAULT_RED_VALUE,
      avgGreen: DEFAULT_GREEN_VALUE,
      avgBlue: DEFAULT_BLUE_VALUE
    };
  }
  
  /**
   * Validates if a pixel is within physiological ranges
   */
  /**
   * Validates if a pixel is within physiological ranges
   */
  private isValidPixel(r: number, g: number, b: number): boolean {
    // Check for valid RGB range
    if (r < MIN_PIXEL_VALUE || r > MAX_PIXEL_VALUE ||
        g < MIN_PIXEL_VALUE || g > MAX_PIXEL_VALUE ||
        b < MIN_PIXEL_VALUE || b > MAX_PIXEL_VALUE) {
      return false;
    }
    
    // Check for saturated or too dark pixels
    const isSaturated = r > 250 && g > 250 && b > 250;
    const isTooDark = r < 5 && g < 5 && b < 5;
    
    if (isSaturated || isTooDark) {
      return false;
    }
    
    // Basic physiological validation
    const rgRatio = r / Math.max(1, g);
    const rbRatio = r / Math.max(1, b);
    const minRG = this.RG_RATIO_RANGE[0];
    const maxRG = this.RG_RATIO_RANGE[1];
    
    return rgRatio >= minRG && rgRatio <= maxRG &&
           rbRatio >= 1.0 && r > g && r > b;
  }

  extractFrameData(imageData: ImageData): FrameData {
    // Input validation
    if (!imageData?.data || imageData.width <= 0 || imageData.height <= 0) {
      console.error("FrameProcessor: Invalid image data");
      return this.getDefaultFrameData();
    }
    
    const startTime = performance.now();
    const frameSize = imageData.width * imageData.height;
    
    if (imageData.data.length < frameSize * 4) {
      console.error("FrameProcessor: Incomplete image data");
      return this.getDefaultFrameData();
    }
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let pixelCount = 0, totalLuminance = 0;
    let minRed = 255, maxRed = 0;
    let validPixels = 0, invalidPixels = 0;
    
    // Calculate adaptive ROI
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    // Adaptive ROI size based on image dimensions
    const roiSize = Math.max(
      32, // Minimum size
      Math.min(
        Math.min(imageData.width, imageData.height) * this.CONFIG.ROI_SIZE_FACTOR,
        320 // Maximum size to avoid processing too many pixels
      )
    );
    
    // Calculate ROI bounds with boundary checks
    const halfRoi = Math.floor(roiSize / 2);
    const startX = Math.max(0, centerX - halfRoi);
    const endX = Math.min(imageData.width, centerX + halfRoi);
    const startY = Math.max(0, centerY - halfRoi);
    const endY = Math.min(imageData.height, centerY + halfRoi);
    
    // Validate ROI dimensions
    const roiWidth = endX - startX;
    const roiHeight = endY - startY;
    if (roiWidth <= 0 || roiHeight <= 0) {
      console.error("Invalid ROI dimensions", { roiWidth, roiHeight });
      return this.getDefaultFrameData();
    }
    
    // ROI bounds are already calculated above, removing duplicate declarations
    
    // Initialize texture analysis grid
    const gridSize = Math.min(this.CONFIG.TEXTURE_GRID_SIZE, 8);
    const cells = Array(gridSize * gridSize).fill(0).map(() => ({
      red: 0, green: 0, blue: 0, count: 0, edgeScore: 0
    }));
    
    // Edge detection kernel
    const edgeKernel = [
      [-1, -2, -1],
      [-2, 12, -2],
      [-1, -2, -1]
    ];
    const edgeValues: number[] = [];
    let saturatedPixels = 0, darkPixels = 0;
    
    // Process ROI pixels with enhanced validation
    const pixelData = new Uint8ClampedArray(roiWidth * roiHeight * 4);
    
    // First pass: copy ROI data and calculate basic statistics
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const srcIdx = (y * imageData.width + x) * 4;
        const dstIdx = ((y - startY) * roiWidth + (x - startX)) * 4;
        
        // Copy pixel data
        pixelData[dstIdx] = data[srcIdx];     // R
        pixelData[dstIdx + 1] = data[srcIdx + 1]; // G
        pixelData[dstIdx + 2] = data[srcIdx + 2]; // B
        pixelData[dstIdx + 3] = data[srcIdx + 3]; // A
        
        // Extract and validate pixel values
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        
        // Count saturated/dark pixels for diagnostics
        if (r > 250 && g > 250 && b > 250) {
          saturatedPixels++;
        } else if (r < 5 && g < 5 && b < 5) {
          darkPixels++;
        } else {
          // Only consider non-saturated, non-dark pixels as valid
          validPixels++;
          
          // Update min/max for dynamic range analysis
          if (r < minRed) minRed = r;
          if (r > maxRed) maxRed = r;
          
          // Calculate luminance for lighting analysis
          const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          totalLuminance += luminance;
        }
      }
    }
    
    // Validate we have enough valid pixels
    if (validPixels < MIN_VALID_PIXELS) {
      console.error("FrameProcessor: Not enough valid pixels", { 
        validPixels, 
        required: MIN_VALID_PIXELS 
      });
      return this.getDefaultFrameData();
    }
    
    // Second pass: texture and edge analysis
    for (let y = 1; y < roiHeight - 1; y++) {
      for (let x = 1; x < roiWidth - 1; x++) {
        const idx = (y * roiWidth + x) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];
        
        // Skip processing for invalid pixels
        if (!this.isValidPixel(r, g, b)) {
          invalidPixels++;
          continue;
        }
        
        // Calculate grid cell for texture analysis
        const gridX = Math.min(gridSize - 1, Math.floor((x / roiWidth) * gridSize));
        const gridY = Math.min(gridSize - 1, Math.floor((y / roiHeight) * gridSize));
        const cellIdx = gridY * gridSize + gridX;
        
        // Edge detection using kernel
        let edgeValue = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ni = ((y + ky) * roiWidth + (x + kx)) * 4;
            edgeValue += pixelData[ni] * edgeKernel[ky+1][kx+1];
          }
        }
        
        edgeValue = Math.abs(edgeValue) / 255;
        edgeValues.push(edgeValue);
        
        // Enhanced red channel amplification
        const enhancedR = Math.min(255, r * this.RED_GAIN);
        
        // Apply suppression to green channel
        const attenuatedG = g * this.GREEN_SUPPRESSION;
        
        // Update cell statistics
        if (cellIdx >= 0 && cellIdx < cells.length) {
          cells[cellIdx].red += enhancedR;
          cells[cellIdx].green += attenuatedG;
          cells[cellIdx].blue += b;
          cells[cellIdx].count++;
          cells[cellIdx].edgeScore += edgeValue;
        }
        
        // Calculate color ratios for physiological validation
        const rgRatio = r / Math.max(1, g);
        const rbRatio = r / Math.max(1, b);
        
        // Validate physiological color ratios
        const validColorRatios = (
          rgRatio >= this.RG_RATIO_RANGE[0] && 
          rgRatio <= this.RG_RATIO_RANGE[1] &&
          rbRatio >= 1.0 &&
          r > g && r > b
        );
        
        // Apply adaptive gain based on validation
        const adaptiveGain = validColorRatios ? this.SIGNAL_GAIN : this.SIGNAL_GAIN * 0.7;
        
        // Accumulate color values
        redSum += enhancedR * adaptiveGain;
        greenSum += attenuatedG;
        blueSum += b;
        pixelCount++;
      }
    }
    
    // Calculate average lighting level (0-100)
    const avgLuminance = (pixelCount > 0) ? (totalLuminance / pixelCount) * 100 : 0;
    
    // Update lighting level with smoothing
    if (this.lastLightLevel < 0) {
      this.lastLightLevel = avgLuminance;
    } else {
      this.lastLightLevel = this.lastLightLevel * 0.7 + avgLuminance * 0.3;
    }
    
    // Calculate texture score based on cell variations and edges
    let textureScore = 0.5; // Default neutral value
    
    const validCells = cells.filter(cell => cell.count > 0);
    
    if (validCells.length > 1) {
      // Normalize cell values
      const normCells = validCells.map(cell => ({
        red: cell.red / Math.max(1, cell.count),
        green: cell.green / Math.max(1, cell.count),
        blue: cell.blue / Math.max(1, cell.count),
        edgeScore: cell.edgeScore / Math.max(1, cell.count)
      }));
      
      // Calculate pairwise variations between cells
      const variations: number[] = [];
      const redWeight = 1.3;   // Higher weight for red channel
      const greenWeight = 0.8;
      const blueWeight = 0.6;
      const weightSum = redWeight + greenWeight + blueWeight + this.EDGE_ENHANCEMENT;
      
      for (let i = 0; i < normCells.length; i++) {
        for (let j = i + 1; j < normCells.length; j++) {
          const cell1 = normCells[i];
          const cell2 = normCells[j];
          
          // Calculate color differences with channel weights
          const redDiff = Math.abs(cell1.red - cell2.red) * redWeight;
          const greenDiff = Math.abs(cell1.green - cell2.green) * greenWeight;
          const blueDiff = Math.abs(cell1.blue - cell2.blue) * blueWeight;
          
          // Include edge information
          const edgeDiff = Math.abs(cell1.edgeScore - cell2.edgeScore) * this.EDGE_ENHANCEMENT;
          
          // Weighted average of differences
          const avgDiff = (redDiff + greenDiff + blueDiff + edgeDiff) / weightSum;
          variations.push(avgDiff);
        }
      }
      
      // Calculate final texture score with bounds checking
      if (variations.length > 0) {
        const sumVariation = variations.reduce((sum, val) => sum + val, 0);
        const avgVariation = sumVariation / variations.length;
        const normalizedVar = Math.pow(avgVariation / 3, 0.65);
        textureScore = Math.max(0.35, Math.min(1, normalizedVar));
      }
    }
    
    // Update history for adaptive calibration
    if (pixelCount > 0) {
      this.lastFrames.push({
        red: redSum / pixelCount,
        green: greenSum / pixelCount,
        blue: blueSum / pixelCount
      });
      
      if (this.lastFrames.length > this.HISTORY_SIZE) {
        this.lastFrames.shift();
      }
    }
    
    // No pixels detected - return enhanced default values
    if (pixelCount < 1 || validPixels < 100) {
      console.warn("FrameProcessor: Insufficient valid pixels, using default values", {
        pixelCount,
        validPixels,
        invalidPixels,
        saturatedPixels,
        darkPixels
      });
      return this.getDefaultFrameData();
    }
    
    // Apply dynamic calibration based on history - with medical constraints
    const WEAK_SIGNAL_THRESHOLD = 40;
    const MIN_GAIN = 1.0;
    const WEAK_GAIN = 1.1;
    const MODERATE_GAIN = 1.25;
    
    let dynamicGain = MIN_GAIN; // Base gain
    
    if (this.lastFrames.length >= 3) { // Reduced from 5 for faster adaptation
      const frameCount = this.lastFrames.length;
      const avgHistRed = this.lastFrames.reduce((sum, frame) => sum + frame.red, 0) / frameCount;
      const edgeContrast = this.calculateEdgeContrast();
      
      // Apply gain based on signal strength and edge contrast
      if (avgHistRed < WEAK_SIGNAL_THRESHOLD && 
          avgHistRed > this.MIN_RED_THRESHOLD && 
          edgeContrast > this.EDGE_CONTRAST_THRESHOLD) {
        dynamicGain = MODERATE_GAIN; // Moderate gain for weak but valid signals
      } else if (avgHistRed <= this.MIN_RED_THRESHOLD) {
        dynamicGain = WEAK_GAIN; // Minimal gain for very weak signals
      }
    }
    
    // Calculate final color values with validation
    const avgRed = Math.max(0, (redSum / pixelCount) * dynamicGain);
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calculate color ratios with physiological constraints
    const rToGRatio = Math.max(0.1, Math.min(10, avgGreen > 3 ? avgRed / avgGreen : 1.2));
    const rToBRatio = Math.max(0.1, Math.min(10, avgBlue > 3 ? avgRed / avgBlue : 1.2));
    
    // Calculate light level quality factor
    const lightLevelFactor = this.getLightLevelQualityFactor(this.lastLightLevel);
    
    // Detailed logging for diagnostics
    console.log("FrameProcessor: Extracted data:", {
      avgRed: avgRed.toFixed(1),
      avgGreen: avgGreen.toFixed(1),
      avgBlue: avgBlue.toFixed(1),
      textureScore: textureScore.toFixed(2),
      rToGRatio: rToGRatio.toFixed(2),
      rToBRatio: rToBRatio.toFixed(2),
      lightLevel: this.lastLightLevel.toFixed(1),
      lightQuality: lightLevelFactor.toFixed(2),
      dynamicGain: dynamicGain.toFixed(2),
      pixelCount,
      validPixels,
      invalidPixels,
      saturatedPixels,
      darkPixels,
      frameSize: `${imageData.width}x${imageData.height}`,
      roiSize: `${roiWidth}x${roiHeight}`,
      processingTime: `${(performance.now() - startTime).toFixed(2)}ms`
    });
    
    return {
      redValue: avgRed,
      avgRed,
      avgGreen,
      avgBlue,
      textureScore,
      rToGRatio,
      rToBRatio
    };
  }
  
  private calculateEdgeContrast(): number {
    if (this.lastFrames.length < 2) return 0;
    
    const lastFrame = this.lastFrames[this.lastFrames.length - 1];
    const prevFrame = this.lastFrames[this.lastFrames.length - 2];
    
    // Cálculo de diferencia entre frames consecutivos
    const diff = Math.abs(lastFrame.red - prevFrame.red) + 
                 Math.abs(lastFrame.green - prevFrame.green) + 
                 Math.abs(lastFrame.blue - prevFrame.blue);
    
    // Normalizar a rango 0-1
    return Math.min(1, diff / 255); 
  }
  
  /**
   * Calculate quality factor based on lighting level
   * Both too dark and too bright conditions reduce signal quality
   */
  private getLightLevelQualityFactor(lightLevel: number): number {
    // Rango óptimo ampliado - más permisivo
    if (lightLevel >= 25 && lightLevel <= 85) { // Antes 30-80
      return 1.0; // Optimal lighting
    } else if (lightLevel < 25) {
      // Too dark - reducción lineal en calidad pero más permisiva
      return Math.max(0.4, lightLevel / 25); // Mínimo aumentado (antes 0.3)
    } else {
      // Too bright - penalización reducida
      return Math.max(0.4, 1.0 - (lightLevel - 85) / 60); // Límites más permisivos
    }
  }
  
  detectROI(redValue: number, imageData: ImageData): ProcessedSignal['roi'] {
    // Centered ROI by default with adaptive size
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    // Factor ROI adaptativo mejorado
    let adaptiveROISizeFactor = this.CONFIG.ROI_SIZE_FACTOR;
    
    // Ajustar ROI basado en valor rojo detectado - más permisivo
    if (redValue < 25) { // Umbral reducido (antes 30)
      // Señal débil - aumentar ROI para capturar más área
      adaptiveROISizeFactor = Math.min(0.8, adaptiveROISizeFactor * 1.1); // Mayor aumento
    } else if (redValue > 120) { // Umbral aumentado (antes 100)
      // Señal fuerte - enfocar ROI en área central
      adaptiveROISizeFactor = Math.max(0.35, adaptiveROISizeFactor * 0.97); // Menos reducción
    }
    
    // Ensure ROI is appropriate to image size
    const minDimension = Math.min(imageData.width, imageData.height);
    const maxRoiSize = minDimension * 0.85; // Máximo aumentado (antes 0.8)
    const minRoiSize = minDimension * 0.25; // Mínimo reducido (antes 0.3)
    
    let roiSize = minDimension * adaptiveROISizeFactor;
    roiSize = Math.max(minRoiSize, Math.min(maxRoiSize, roiSize));
    
    // Nuevo ROI calculado
    const newROI = {
      x: centerX - roiSize / 2,
      y: centerY - roiSize / 2,
      width: roiSize,
      height: roiSize
    };
    
    // Guardar historia de ROIs para estabilidad
    this.roiHistory.push(newROI);
    if (this.roiHistory.length > this.ROI_HISTORY_SIZE) {
      this.roiHistory.shift();
    }
    
    // Si tenemos suficiente historia, promediar para estabilidad
    if (this.roiHistory.length >= 3) {
      const avgX = this.roiHistory.reduce((sum, roi) => sum + roi.x, 0) / this.roiHistory.length;
      const avgY = this.roiHistory.reduce((sum, roi) => sum + roi.y, 0) / this.roiHistory.length;
      const avgWidth = this.roiHistory.reduce((sum, roi) => sum + roi.width, 0) / this.roiHistory.length;
      const avgHeight = this.roiHistory.reduce((sum, roi) => sum + roi.height, 0) / this.roiHistory.length;
      
      return {
        x: avgX,
        y: avgY,
        width: avgWidth,
        height: avgHeight
      };
    }
    
    // Si no hay suficiente historia, usar el nuevo ROI directamente
    return newROI;
  }
}
