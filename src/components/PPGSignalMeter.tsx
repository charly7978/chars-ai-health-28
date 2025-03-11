
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint, AlertCircle, Activity } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';

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
  preserveResults?: boolean;
  elapsedTime?: number;
}

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false,
  elapsedTime = 0
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const isMonitoring = elapsedTime > 0;

  const WINDOW_WIDTH_MS = 3000;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 1000; // Increased height to extend the graph
  const GRID_SIZE_X = 10;
  const GRID_SIZE_Y = 10;
  const verticalScale = 28.0;
  const SMOOTHING_FACTOR = 1.3;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  
  const PEAK_DETECTION_WINDOW = 6;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 250;
  
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
    }
    
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults, isFingerDetected]);

  const getQualityColor = useCallback((q: number) => {
    if (!isFingerDetected) return 'from-gray-400 to-gray-500';
    if (q > 75) return 'from-green-500 to-emerald-500';
    if (q > 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [isFingerDetected]);

  const getQualityText = useCallback((q: number) => {
    if (!isFingerDetected) return 'Sin detección';
    if (q > 75) return 'Señal óptima';
    if (q > 50) return 'Señal aceptable';
    return 'Señal débil';
  }, [isFingerDetected]);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    // Create a very light gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, 'rgba(254, 247, 205, 0.2)');
    gradient.addColorStop(1, 'rgba(253, 225, 211, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(159, 142, 106, 0.3)';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 4) === 0) {
        const amplitude = ((CANVAS_HEIGHT / 2) - y) / verticalScale;
        ctx.fillStyle = 'rgba(159, 142, 106, 0.7)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(amplitude.toFixed(1), 25, y + 4);
      }
    }
    
    // Vertical grid lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 4) === 0) {
        ctx.fillStyle = 'rgba(159, 142, 106, 0.7)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${x / 10}ms`, x, CANVAS_HEIGHT - 5);
      }
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X * 4) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }

    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y * 4) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();

    if (arrhythmiaStatus) {
      const [status, _] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && !showArrhythmiaAlert) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('¡ARRITMIA DETECTADA!', 45, 35);
        setShowArrhythmiaAlert(true);
      } 
    }
    
    ctx.stroke();
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia
        });
      }
    }
    
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia
        });
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;

    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const now = Date.now();
    
    drawGrid(ctx);
    
    if (preserveResults && !isFingerDetected) {
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    }

    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;

    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale;
    
    let isArrhythmia = false;
    if (rawArrhythmiaData && 
        arrhythmiaStatus?.includes("ARRITMIA") && 
        now - rawArrhythmiaData.timestamp < 500) {
      isArrhythmia = true;
      lastArrhythmiaTime.current = rawArrhythmiaData.timestamp;
    }

    const dataPoint: PPGDataPoint = {
      time: now,
      value: scaledValue,
      isArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    const points = dataBufferRef.current.getPoints();
    
    detectPeaks(points, now);

    if (points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      let firstPoint = true;
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const point = points[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = canvas.height / 2 - prevPoint.value;
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = canvas.height / 2 - point.value;

        if (firstPoint) {
          ctx.moveTo(x1, y1);
          firstPoint = false;
        }
        
        if (point.isArrhythmia && !firstPoint) {
          ctx.lineTo(x1, y1);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 3;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.strokeStyle = '#0EA5E9';
          ctx.lineWidth = 2;
          ctx.moveTo(x2, y2);
          firstPoint = true;
        } else {
          ctx.lineTo(x2, y2);
        }
      }
      
      if (!firstPoint) {
        ctx.stroke();
      }

      peaksRef.current.forEach(peak => {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - peak.value;
        
        if (x >= 0 && x <= canvas.width) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          ctx.fill();

          if (peak.isArrhythmia) {
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#FEF7CD';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.font = 'bold 12px Inter';
            ctx.fillStyle = '#F97316';
            ctx.textAlign = 'center';
            ctx.fillText('ARRITMIA', x, y - 25);
          }

          ctx.font = 'bold 12px Inter';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
        }
      });
    }

    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults]);

  useEffect(() => {
    renderSignal();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    onReset();
  }, [onReset]);

  return (
    <div className="fixed inset-0 bg-transparent flex flex-col">
      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent pt-6 z-10">
        <div className="flex items-center gap-2 mr-6">
          <span className="text-lg font-bold text-gold-medium">PPG</span>
          <div className="ml-13 w-[180px] mt-1">
            <div className="flex items-center space-x-1.5">
              <Activity size={16} className="text-gold-medium" />
              <div className="relative w-full h-2.5 bg-white/20 rounded-full overflow-hidden shadow-inner">
                <div 
                  className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full bg-gradient-to-r ${getQualityColor(quality)}`}
                  style={{ 
                    width: `${isFingerDetected ? quality : 0}%`,
                    boxShadow: 'inset 0 0 6px rgba(255, 255, 255, 0.6)'
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-gold-medium w-12 text-right">
                {isFingerDetected ? `${quality}%` : '--%'}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px] font-medium text-gold-medium">
                {getQualityText(quality)}
              </span>
              {quality <= 50 && isFingerDetected && (
                <span className="text-[8px] font-medium text-red-500 animate-pulse">
                  Reposicione su dedo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 transition-colors duration-300 ${
              !isFingerDetected ? 'text-gray-400' :
              quality > 75 ? 'text-green-500' :
              quality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-[8px] text-center font-medium text-gold-medium">
            {isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
          </span>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="canvas-container absolute inset-0">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full graph-grid"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-[100px] grid grid-cols-2 gap-px bg-transparent">
        <button 
          onClick={onStartMeasurement}
          className="bg-transparent soft-button text-white transition-colors duration-200 flex items-center justify-center"
        >
          <div className="flex items-center justify-center gap-2">
            {isMonitoring ? (
              <>
                <span className="text-xl font-semibold">{30 - elapsedTime}s</span>
              </>
            ) : (
              <span className="text-xl font-semibold">INICIAR</span>
            )}
          </div>
        </button>

        <button 
          onClick={handleReset}
          className="bg-transparent soft-button text-white hover:bg-red-500/20 transition-colors duration-200"
        >
          <span className="text-xl font-semibold">
            RESETEAR
          </span>
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
