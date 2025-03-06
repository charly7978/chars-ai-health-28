import { useRef, useCallback, useState } from 'react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';

interface UseSignalProcessingProps {
  bufferSize: number;
  peakDetectionWindow: number;
  peakThreshold: number;
  minPeakDistanceMs: number;
  smoothingFactor: number;
  maxPeaksToDisplay: number;
  verticalScale: number;
}

export const useSignalProcessing = ({
  bufferSize,
  peakDetectionWindow,
  peakThreshold,
  minPeakDistanceMs,
  smoothingFactor,
  maxPeaksToDisplay,
  verticalScale
}: UseSignalProcessingProps) => {
  const dataBufferRef = useRef<CircularBuffer | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const [peaks, setPeaks] = useState<{time: number, value: number, isArrhythmia: boolean}[]>([]);

  // Initialize buffer if needed
  const initBuffer = useCallback(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(bufferSize);
    }
  }, [bufferSize]);

  // Smooth the signal value
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + smoothingFactor * (currentValue - previousValue);
  }, [smoothingFactor]);

  // Process a new value and detect peaks
  const processValue = useCallback((value: number, arrhythmiaStatus?: string, arrhythmiaData?: any) => {
    const now = Date.now();
    
    // Initialize buffer if needed
    if (!dataBufferRef.current) {
      initBuffer();
    }
    
    // Update baseline
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }

    // Smooth value
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;

    // Calculate normalized value
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale;
    
    // Check if this is an arrhythmia point
    let isArrhythmia = false;
    if (arrhythmiaData && 
        arrhythmiaStatus?.includes("ARRITMIA") && 
        now - arrhythmiaData.timestamp < 1000) {
      isArrhythmia = true;
    }

    // Create data point and add to buffer
    const dataPoint: PPGDataPoint = {
      time: now,
      value: scaledValue,
      isArrhythmia
    };
    
    if (dataBufferRef.current) {
      dataBufferRef.current.push(dataPoint);
      const points = dataBufferRef.current.getPoints();
      
      // Detect peaks
      detectPeaks(points, now);
    }
    
    return {
      points: dataBufferRef.current?.getPoints() || [],
      peaks
    };
  }, [initBuffer, smoothValue, verticalScale]);

  // Detect peaks in the signal
  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < peakDetectionWindow) return;
    
    const newPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = peakDetectionWindow; i < points.length - peakDetectionWindow; i++) {
      const currentPoint = points[i];
      
      const recentlyProcessed = peaks.some(
        peak => Math.abs(peak.time - currentPoint.time) < minPeakDistanceMs
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      // Check if it's higher than previous points
      for (let j = i - peakDetectionWindow; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      // Check if it's higher than following points
      if (isPeak) {
        for (let j = i + 1; j <= i + peakDetectionWindow; j++) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      // Add peak if it passes threshold
      if (isPeak && Math.abs(currentPoint.value) > peakThreshold) {
        newPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia
        });
      }
    }
    
    // Filter out peaks that are too close to existing ones
    const filteredNewPeaks = newPeaks.filter(newPeak => 
      !peaks.some(existingPeak => 
        Math.abs(existingPeak.time - newPeak.time) < minPeakDistanceMs
      )
    );
    
    // Update peaks state
    if (filteredNewPeaks.length > 0) {
      setPeaks(prevPeaks => {
        const updatedPeaks = [...prevPeaks, ...filteredNewPeaks]
          .sort((a, b) => a.time - b.time)
          // Keep only recent peaks
          .filter(peak => now - peak.time < 3000)
          // Limit number of peaks displayed
          .slice(-maxPeaksToDisplay);
        
        return updatedPeaks;
      });
    } else {
      // Still filter old peaks even if no new ones
      setPeaks(prevPeaks => 
        prevPeaks
          .filter(peak => now - peak.time < 3000)
          .slice(-maxPeaksToDisplay)
      );
    }
  }, [maxPeaksToDisplay, minPeakDistanceMs, peakDetectionWindow, peakThreshold, peaks]);

  // Reset all processing state
  const reset = useCallback(() => {
    baselineRef.current = null;
    lastValueRef.current = null;
    setPeaks([]);
    if (dataBufferRef.current) {
      dataBufferRef.current.clear();
    }
  }, []);

  return {
    processValue,
    reset,
    peaks
  };
};
