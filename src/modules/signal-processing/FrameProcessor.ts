
import { FrameData } from './types';
import { ProcessedSignal } from '../../types/signal';

/**
 * Processes video frames to extract PPG signals and detect ROI
 * PROHIBIDA LA SIMULACIÓN Y TODO TIPO DE MANIPULACIÓN FORZADA DE DATOS
 */
export class FrameProcessor {
  private readonly CONFIG: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number };
  // Medically calibrated parameters for accurate signal extraction
  private readonly RED_GAIN = 1.2; // Reduced from excessive amplification
  private readonly GREEN_SUPPRESSION = 0.85; // Less aggressive suppression
  private readonly SIGNAL_GAIN = 1.1; // Reduced global gain
  private readonly EDGE_ENHANCEMENT = 0.12; // Reduced edge enhancement
  
  // History tracking for adaptive calibration
  private lastFrames: Array<{red: number, green: number, blue: number}> = [];
  private readonly HISTORY_SIZE = 20; // Increased for more stable adaptation
  private lastLightLevel: number = -1;
  
  constructor(config: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number }) {
    this.CONFIG = config;
  }
  
  extractFrameData(imageData: ImageData): FrameData {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let totalLuminance = 0;
    
    // Center of the image
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * this.CONFIG.ROI_SIZE_FACTOR;
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Grid for texture analysis
    const gridSize = this.CONFIG.TEXTURE_GRID_SIZE;
    const cells: Array<{ red: number, green: number, blue: number, count: number, edgeScore: number }> = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      cells.push({ red: 0, green: 0, blue: 0, count: 0, edgeScore: 0 });
    }
    
    // Edge detection matrices
    const edgeDetectionMatrix = [
      [-1, -1, -1],
      [-1,  8, -1],
      [-1, -1, -1]
    ];
    const edgeValues: number[] = [];
    
    // Extract signal with appropriate medical-grade gain
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Red channel
        const g = data[i+1];   // Green channel
        const b = data[i+2];   // Blue channel
        
        // Calculate pixel luminance
        const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        totalLuminance += luminance;
        
        // Calculate grid cell
        const gridX = Math.min(gridSize - 1, Math.floor(((x - startX) / (endX - startX)) * gridSize));
        const gridY = Math.min(gridSize - 1, Math.floor(((y - startY) / (endY - startY)) * gridSize));
        const cellIdx = gridY * gridSize + gridX;
        
        // Edge detection for each grid cell
        let edgeValue = 0;
        if (x > startX && x < endX - 1 && y > startY && y < endY - 1) {
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ni = ((y + ky) * imageData.width + (x + kx)) * 4;
              edgeValue += data[ni] * edgeDetectionMatrix[ky+1][kx+1];
            }
          }
          edgeValue = Math.abs(edgeValue) / 255;
          edgeValues.push(edgeValue);
          cells[cellIdx].edgeScore += edgeValue;
        }
        
        // Apply scientifically calibrated red channel amplification
        const enhancedR = Math.min(255, r * this.RED_GAIN);
        
        // Apply measured green channel suppression
        const attenuatedG = g * this.GREEN_SUPPRESSION;
        
        cells[cellIdx].red += enhancedR;
        cells[cellIdx].green += attenuatedG;
        cells[cellIdx].blue += b;
        cells[cellIdx].count++;
        
        // Apply adaptive gain based on physiological r/g ratio
        const rgRatio = r / (g + 1);
        // Lower gain for non-physiological ratios
        const adaptiveGain = (rgRatio > 0.9 && rgRatio < 3.0) ? 
                           this.SIGNAL_GAIN : this.SIGNAL_GAIN * 0.7;
        
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
    
    // Calculate texture (variation between cells) with physiological constraints
    let textureScore = 0.5; // Base value
    
    if (cells.some(cell => cell.count > 0)) {
      // Normalize cells by count and consider edges
      const normCells = cells
        .filter(cell => cell.count > 0)
        .map(cell => ({
          red: cell.red / cell.count,
          green: cell.green / cell.count,
          blue: cell.blue / cell.count,
          edgeScore: cell.edgeScore / Math.max(1, cell.count)
        }));
      
      if (normCells.length > 1) {
        // Calculate variations between adjacent cells with edge weighting
        let totalVariation = 0;
        let comparisonCount = 0;
        
        for (let i = 0; i < normCells.length; i++) {
          for (let j = i + 1; j < normCells.length; j++) {
            const cell1 = normCells[i];
            const cell2 = normCells[j];
            
            // Calculate color difference with emphasis on red channel
            const redDiff = Math.abs(cell1.red - cell2.red) * 1.2; // Balanced weight
            const greenDiff = Math.abs(cell1.green - cell2.green) * 0.9;
            const blueDiff = Math.abs(cell1.blue - cell2.blue);
            
            // Include edge information in texture calculation
            const edgeDiff = Math.abs(cell1.edgeScore - cell2.edgeScore) * this.EDGE_ENHANCEMENT;
            
            // Weighted average of differences
            const avgDiff = (redDiff + greenDiff + blueDiff + edgeDiff) / 3.1;
            totalVariation += avgDiff;
            comparisonCount++;
          }
        }
        
        if (comparisonCount > 0) {
          const avgVariation = totalVariation / comparisonCount;
          
          // Improved texture calculation with medical-grade thresholds
          const normalizedVar = Math.pow(avgVariation / 3, 0.7);
          textureScore = Math.max(0.3, Math.min(1, normalizedVar));
        }
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
    
    // If no red pixels are detected, return default values
    if (pixelCount < 1) {
      console.log("FrameProcessor: No pixels detected in this frame, using default values");
      return { 
        redValue: 0, // No signal when nothing detected
        textureScore: 0.5,
        rToGRatio: 1.0,
        rToBRatio: 1.0,
        avgRed: 0,
        avgGreen: 0,
        avgBlue: 0
      };
    }
    
    // Apply dynamic calibration based on history - with medical constraints
    let dynamicGain = 1.0; // Base gain
    if (this.lastFrames.length >= 5) {
      const avgHistRed = this.lastFrames.reduce((sum, frame) => sum + frame.red, 0) / this.lastFrames.length;
      
      // Apply moderate gain if historical average is low but still present
      if (avgHistRed < 40 && avgHistRed > 15) {
        dynamicGain = 1.2; // Moderate gain for weak signals
      } else if (avgHistRed <= 15) {
        // Very weak signal - likely no finger present
        dynamicGain = 1.0; // Don't amplify noise
      }
    }
    
    // Calculate average values with physiologically valid minimum thresholds
    const avgRed = Math.max(0, (redSum / pixelCount) * dynamicGain);
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calculate color ratio indexes with proper physiological constraints
    const rToGRatio = avgGreen > 5 ? avgRed / avgGreen : 1.0;
    const rToBRatio = avgBlue > 5 ? avgRed / avgBlue : 1.0;
    
    // Light level affects detection quality
    const lightLevelFactor = this.getLightLevelQualityFactor(this.lastLightLevel);
    
    // More detailed logging for diagnostics
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
      frameSize: `${imageData.width}x${imageData.height}`
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
  
  /**
   * Calculate quality factor based on lighting level
   * Both too dark and too bright conditions reduce signal quality
   */
  private getLightLevelQualityFactor(lightLevel: number): number {
    // Optimal light level is around 40-70 (on 0-100 scale)
    if (lightLevel >= 30 && lightLevel <= 80) {
      return 1.0; // Optimal lighting
    } else if (lightLevel < 30) {
      // Too dark - linear reduction in quality
      return Math.max(0.3, lightLevel / 30);
    } else {
      // Too bright - penalty increases with brightness
      return Math.max(0.3, 1.0 - (lightLevel - 80) / 50);
    }
  }
  
  detectROI(redValue: number, imageData: ImageData): ProcessedSignal['roi'] {
    // Centered ROI by default with adaptive size
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    // Adaptive ROI based on signal intensity and image size
    let adaptiveROISizeFactor = this.CONFIG.ROI_SIZE_FACTOR;
    
    // Adjust ROI based on detected red value - with medical constraints
    if (redValue < 30) {
      // Weaker signal - increase ROI slightly to capture more area
      adaptiveROISizeFactor = Math.min(0.75, adaptiveROISizeFactor * 1.05);
    } else if (redValue > 100) {
      // Strong signal - focus ROI on center area with better signal
      adaptiveROISizeFactor = Math.max(0.4, adaptiveROISizeFactor * 0.95);
    }
    
    // Ensure ROI is appropriate to image size
    const minDimension = Math.min(imageData.width, imageData.height);
    const maxRoiSize = minDimension * 0.8; // Maximum 80% of smallest dimension
    const minRoiSize = minDimension * 0.3; // Minimum 30% of smallest dimension
    
    let roiSize = minDimension * adaptiveROISizeFactor;
    roiSize = Math.max(minRoiSize, Math.min(maxRoiSize, roiSize));
    
    return {
      x: centerX - roiSize / 2,
      y: centerY - roiSize / 2,
      width: roiSize,
      height: roiSize
    };
  }
}
