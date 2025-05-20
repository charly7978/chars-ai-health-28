
import { FrameData } from './types';
import { ProcessedSignal } from '../../types/signal';

export class FrameProcessor {
  private readonly CONFIG: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number };
  // Optimized parameters for accurate detection (not excessive sensitivity)
  private readonly RED_GAIN = 1.8; // Reasonable red channel amplification
  private readonly GREEN_SUPPRESSION = 0.7; // Moderate green channel suppression
  private readonly SIGNAL_GAIN = 1.5; // Reasonable global gain
  private readonly EDGE_ENHANCEMENT = 0.2; // Edge enhancement factor
  
  // History tracking for dynamic calibration
  private lastFrames: Array<{red: number, green: number, blue: number}> = [];
  private readonly HISTORY_SIZE = 15; // More history for stable adaptation
  
  constructor(config: { TEXTURE_GRID_SIZE: number, ROI_SIZE_FACTOR: number }) {
    this.CONFIG = config;
  }
  
  extractFrameData(imageData: ImageData): FrameData {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
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
    
    // Extract signal with appropriate gain
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Red channel
        const g = data[i+1];   // Green channel
        const b = data[i+2];   // Blue channel
        
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
        
        // Apply proper red channel amplification
        const enhancedR = Math.min(255, r * this.RED_GAIN);
        
        // Apply green channel suppression
        const attenuatedG = g * this.GREEN_SUPPRESSION;
        
        cells[cellIdx].red += enhancedR;
        cells[cellIdx].green += attenuatedG;
        cells[cellIdx].blue += b;
        cells[cellIdx].count++;
        
        // Apply adaptive gain based on r/g ratio
        const rgRatio = r / (g + 1);
        const adaptiveGain = rgRatio > 1.0 ? this.SIGNAL_GAIN * 1.2 : this.SIGNAL_GAIN;
        
        redSum += enhancedR * adaptiveGain;
        greenSum += attenuatedG;
        blueSum += b;
        pixelCount++;
      }
    }
    
    // Calculate texture (variation between cells)
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
            const redDiff = Math.abs(cell1.red - cell2.red) * 1.4; // More weight to red
            const greenDiff = Math.abs(cell1.green - cell2.green) * 0.8; // Less weight to green
            const blueDiff = Math.abs(cell1.blue - cell2.blue);
            
            // Include edge information in texture calculation
            const edgeDiff = Math.abs(cell1.edgeScore - cell2.edgeScore) * this.EDGE_ENHANCEMENT;
            
            // Weighted average of differences
            const avgDiff = (redDiff + greenDiff + blueDiff + edgeDiff) / 3.2;
            totalVariation += avgDiff;
            comparisonCount++;
          }
        }
        
        if (comparisonCount > 0) {
          const avgVariation = totalVariation / comparisonCount;
          
          // Improved texture calculation with emphasis on significant variations
          const normalizedVar = Math.pow(avgVariation / 3, 0.8); // Root to enhance small variations
          textureScore = Math.max(0.5, Math.min(1, normalizedVar));
        }
      }
    }
    
    // Update history for dynamic calibration
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
    
    // Apply dynamic calibration based on history
    let dynamicGain = 1.0; // Base gain
    if (this.lastFrames.length >= 5) {
      const avgHistRed = this.lastFrames.reduce((sum, frame) => sum + frame.red, 0) / this.lastFrames.length;
      
      // Apply more gain if historical average is low
      if (avgHistRed < 30) {
        dynamicGain = 1.5; // Reasonable gain for weak signals
      } else if (avgHistRed < 50) {
        dynamicGain = 1.2; // Slight gain for moderate signals
      }
    }
    
    // Calculate average values with reasonable minimum values
    const avgRed = Math.max(0, (redSum / pixelCount) * dynamicGain);
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calculate color ratio indexes with proper contrast
    const rToGRatio = avgRed / Math.max(1, avgGreen);
    const rToBRatio = avgRed / Math.max(1, avgBlue);
    
    // More detailed logging for diagnostics
    console.log("FrameProcessor: Extracted data:", {
      avgRed, 
      avgGreen, 
      avgBlue,
      textureScore,
      rToGRatio, 
      rToBRatio,
      edgeAvg: edgeValues.length > 0 ? edgeValues.reduce((a,b) => a + b, 0) / edgeValues.length : 0,
      dynamicGain,
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
  
  detectROI(redValue: number, imageData: ImageData): ProcessedSignal['roi'] {
    // Centered ROI by default with adaptive size
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    // Adaptive ROI based on signal intensity
    let adaptiveROISizeFactor = this.CONFIG.ROI_SIZE_FACTOR;
    
    // If signal is weak, increase ROI size to capture more area
    if (redValue < 40) {
      adaptiveROISizeFactor *= 1.1;
    } else if (redValue > 100) {
      // If signal is strong, we can reduce the ROI to focus on optimal zone
      adaptiveROISizeFactor *= 0.9;
    }
    
    const roiSize = Math.min(imageData.width, imageData.height) * adaptiveROISizeFactor;
    
    return {
      x: centerX - roiSize / 2,
      y: centerY - roiSize / 2,
      width: roiSize,
      height: roiSize
    };
  }
}
