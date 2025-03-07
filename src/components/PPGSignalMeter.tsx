import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint, AlertCircle, Heart, Check } from 'lucide-react';
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
}

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false
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
  const [calibrationCompleted, setCalibrationCompleted] = useState(false);
  const [measurementEnded, setMeasurementEnded] = useState(false);
  const [arrhythmiaAlertEndTime, setArrhythmiaAlertEndTime] = useState<number | null>(null);

  const WINDOW_WIDTH_MS = 3000;
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 400;
  const GRID_SIZE_X = 20;
  const GRID_SIZE_Y = 5;
  const verticalScale = 28.0;
  const SMOOTHING_FACTOR = 1.3;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  
  const PEAK_DETECTION_WINDOW = 8;
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

  useEffect(() => {
    if (measurementEnded && showArrhythmiaAlert) {
      setArrhythmiaAlertEndTime(Date.now() + 10000);
    }
  }, [measurementEnded, showArrhythmiaAlert]);

  useEffect(() => {
    if (arrhythmiaStatus && arrhythmiaStatus.includes("SIN ARRITMIAS") && !calibrationCompleted) {
      if (quality > 60 && isFingerDetected) {
        setCalibrationCompleted(true);
        setShowArrhythmiaAlert(false);
      }
    }
    
    if (arrhythmiaStatus && arrhythmiaStatus.includes("ARRITMIA")) {
      const currentTime = Date.now();
      const [_, countPart] = arrhythmiaStatus.split('|');
      const newCount = parseInt(countPart || '0', 10);
      
      if (newCount > arrhythmiaCountRef.current) {
        setShowArrhythmiaAlert(true);
        setCalibrationCompleted(false);
        arrhythmiaCountRef.current = newCount;
        lastArrhythmiaTime.current = currentTime;
      } else if (currentTime - lastArrhythmiaTime.current > 5000 && !measurementEnded) {
        setShowArrhythmiaAlert(false);
        setCalibrationCompleted(true);
      }
    }
  }, [arrhythmiaStatus, quality, isFingerDetected, calibrationCompleted, measurementEnded]);

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
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#FEF7CD');
    gradient.addColorStop(1, '#FDE1D3');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.1)';
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 4) === 0) {
        ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${x / 10}ms`, x, CANVAS_HEIGHT - 5);
      }
    }

    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 4) === 0) {
        const amplitude = ((CANVAS_HEIGHT / 2) - y) / verticalScale;
        ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(amplitude.toFixed(1), 25, y + 4);
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
      const [status, countStr] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && rawArrhythmiaData && 
          Date.now() - rawArrhythmiaData.timestamp < 500 && !showArrhythmiaAlert) {
        setShowArrhythmiaAlert(true);
      } 
    }
    
    if (calibrationCompleted && !showArrhythmiaAlert) {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.8)';
      ctx.beginPath();
      ctx.roundRect(10, 15, 160, 30, 8);
      ctx.fill();
      
      ctx.strokeStyle = '#33C3F0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.fillStyle = '#0369A1';
      ctx.font = 'bold 16px Inter';
      ctx.textAlign = 'left';
      ctx.fillText('LATIDO NORMAL', 45, 35);
      
      ctx.beginPath();
      ctx.arc(30, 30, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#33C3F0';
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(25, 30);
      ctx.lineTo(29, 34);
      ctx.lineTo(35, 26);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (showArrhythmiaAlert) {
      const now = Date.now();
      if (arrhythmiaAlertEndTime && now > arrhythmiaAlertEndTime) {
        setShowArrhythmiaAlert(false);
        setArrhythmiaAlertEndTime(null);
      } else {
        ctx.fillStyle = 'rgba(254, 202, 202, 0.85)';
        ctx.beginPath();
        ctx.roundRect(10, 15, 200, 32, 8);
        ctx.fill();
        
        ctx.strokeStyle = '#B91C1C';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.fillStyle = '#DC2626';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('ARRITMIA DETECTADA', 45, 35);
        
        ctx.beginPath();
        ctx.arc(30, 30, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#DC2626';
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(30, 25);
        ctx.lineTo(30, 32);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(30, 35, 1, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    }
    
    ctx.stroke();
  }, [arrhythmiaStatus, showArrhythmiaAlert, calibrationCompleted, arrhythmiaAlertEndTime, rawArrhythmiaData]);

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
        now - rawArrhythmiaData.timestamp < 500 && 
        !showArrhythmiaAlert) {
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
    setCalibrationCompleted(false);
    setMeasurementEnded(false);
    setArrhythmiaAlertEndTime(null);
    arrhythmiaCountRef.current = 0;
    peaksRef.current = [];
    onReset();
  }, [onReset]);

  const handleStartStop = useCallback(() => {
    if (showArrhythmiaAlert) {
      setMeasurementEnded(true);
    }
    
    if (!calibrationCompleted && !showArrhythmiaAlert && isFingerDetected && quality > 60) {
      setTimeout(() => {
        setCalibrationCompleted(true);
      }, 3000);
    }
    
    onStartMeasurement();
  }, [onStartMeasurement, showArrhythmiaAlert, calibrationCompleted, isFingerDetected, quality]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-white to-slate-50/30">
      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-white/60 backdrop-blur-sm border-b border-slate-100 shadow-sm pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-700">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${isFingerDetected ? quality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
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
          <span className="text-[8px] text-center font-medium text-slate-600">
            {isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[calc(45vh)] mt-14"
      />

      <div className="fixed bottom-0 left-0 right-0 h-[70px] grid grid-cols-2 gap-px bg-gray-100">
        <button 
          onClick={handleStartStop}
          className="bg-gradient-to-b from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800 transition-colors duration-200 shadow-md"
        >
          <span className="text-base font-semibold">
            INICIAR/DETENER
          </span>
        </button>

        <button 
          onClick={handleReset}
          className="bg-gradient-to-b from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 active:from-gray-700 active:to-gray-800 transition-colors duration-200 shadow-md"
        >
          <span className="text-base font-semibold">
            RESETEAR
          </span>
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
