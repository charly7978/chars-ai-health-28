
import React, { useEffect, useRef } from 'react';
import SignalHeader from './ppg/SignalHeader';
import SignalCanvas from './ppg/SignalCanvas';
import SignalButtons from './ppg/SignalButtons';
import { useSignalProcessing } from '../hooks/useSignalProcessing';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData
}: PPGSignalMeterProps) => {
  // Constants for signal processing
  const WINDOW_WIDTH_MS = 3000;
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 500;
  const VERTICAL_SCALE = 28.0;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 250;
  const SMOOTHING_FACTOR = 1.3;
  const MAX_PEAKS_TO_DISPLAY = 25;
  
  // Use the signal processing hook
  const { processValue, reset: resetSignal, peaks } = useSignalProcessing({
    bufferSize: BUFFER_SIZE,
    peakDetectionWindow: PEAK_DETECTION_WINDOW,
    peakThreshold: PEAK_THRESHOLD,
    minPeakDistanceMs: MIN_PEAK_DISTANCE_MS,
    smoothingFactor: SMOOTHING_FACTOR,
    maxPeaksToDisplay: MAX_PEAKS_TO_DISPLAY,
    verticalScale: VERTICAL_SCALE
  });

  // Handle reset button click
  const handleReset = () => {
    resetSignal();
    onReset();
  };

  // Process the current value and prepare data for rendering
  const processedData = processValue(value, arrhythmiaStatus, rawArrhythmiaData);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-white to-slate-50/30">
      <SignalHeader quality={quality} isFingerDetected={isFingerDetected} />
      
      <SignalCanvas 
        points={processedData.points}
        peaks={peaks}
        now={Date.now()}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        windowWidthMs={WINDOW_WIDTH_MS}
        verticalScale={VERTICAL_SCALE}
      />
      
      <SignalButtons 
        onStartMeasurement={onStartMeasurement}
        onReset={handleReset}
      />
    </div>
  );
};

export default PPGSignalMeter;
