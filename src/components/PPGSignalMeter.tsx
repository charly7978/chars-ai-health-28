import React, { useEffect, useRef, useCallback, useState } from 'react';import React, { useEffect, useRef, useCallback, useState } from 'react';import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';ircularBuffer';ircularBuffer';

interface PPGSignalMeterProps {interface PPGSignalMeterProps {interface PPGSignalMeterProps {
  value: number;
  quality: number;r;r;
  isFingerDetected: boolean;: boolean;: boolean;
  onStartMeasurement: () => void;void;void;
  onReset: () => void;
  arrhythmiaStatus?: string;tring;tring;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;umber;umber;
  } | null;
  preserveResults?: boolean;esults?: boolean;esults?: boolean;
}

const PPGSignalMeter = ({ const PPGSignalMeter = ({ const PPGSignalMeter = ({ 
  value, 
  quality, , , 
  isFingerDetected,etected,etected,
  onStartMeasurement,t,t,
  onReset,
  arrhythmiaStatus,iaStatus,iaStatus,
  rawArrhythmiaData,,,
  preserveResults = falsefalsefalse
}: PPGSignalMeterProps) => {> {> {
  const canvasRef = useRef<HTMLCanvasElement>(null);TMLCanvasElement>(null);TMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer | null>(null);>(null);>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);;;
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);;;
  const lastArrhythmiaTime = useRef<number>(0);;;
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]); number, isArrhythmia: boolean}[]>([]); number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);

  const WINDOW_WIDTH_MS = 2800;  const WINDOW_WIDTH_MS = 2800;
  const CANVAS_WIDTH = 1000; // Increased for better resolution Increased for better resolution
  const CANVAS_HEIGHT = 900;
  const CANVAS_HEIGHT = 900; More dense grid More dense grid
  const GRID_SIZE_X = 40; // More dense grid
  const GRID_SIZE_Y = 45; // More dense grid
  const verticalScale = 28.0;5;5;
  const SMOOTHING_FACTOR = 1.5;e 60 para menor consumo
  const TARGET_FPS = 60;0 / TARGET_FPS;0 / TARGET_FPS;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;const PEAK_DETECTION_WINDOW = 8;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;S = 250;S = 250;
  const MIN_PEAK_DISTANCE_MS = 250;
  const IMMEDIATE_RENDERING = true;const IMMEDIATE_RENDERING = true;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;
  useEffect(() => {  useEffect(() => {
  useEffect(() => {Ref.current) {Ref.current) {
    if (!dataBufferRef.current) { CircularBuffer(BUFFER_SIZE); CircularBuffer(BUFFER_SIZE);
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
    }
    if (preserveResults && !isFingerDetected) {if (preserveResults && !isFingerDetected) {
    if (preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {r();r();
        dataBufferRef.current.clear();
      }eaksRef.current = [];eaksRef.current = [];
      peaksRef.current = [];null;null;
      baselineRef.current = null;;;
      lastValueRef.current = null;
    }[preserveResults, isFingerDetected]);[preserveResults, isFingerDetected]);
  }, [preserveResults, isFingerDetected]);
  const getQualityColor = useCallback((q: number) => {  const getQualityColor = useCallback((q: number) => {
  const getQualityColor = useCallback((q: number) => {ay-500';ay-500';
    if (!isFingerDetected) return 'from-gray-400 to-gray-500';
    if (q > 75) return 'from-green-500 to-emerald-500';
    if (q > 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [isFingerDetected]);
  const getQualityText = useCallback((q: number) => {  const getQualityText = useCallback((q: number) => {
  const getQualityText = useCallback((q: number) => {
    if (!isFingerDetected) return 'Sin detección';
    if (q > 75) return 'Señal óptima';e';e';
    if (q > 50) return 'Señal aceptable';
    return 'Señal débil';
  }, [isFingerDetected]);
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;ntValue - previousValue);ntValue - previousValue);
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#FDF5E6'; // Cream background););
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.beginPath();    ctx.beginPath();
    ctx.beginPath();= 'rgba(60, 60, 60, 0.3)'; // Darker grid lines= 'rgba(60, 60, 60, 0.3)'; // Darker grid lines
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.3)'; // Darker grid lines
    ctx.lineWidth = 0.5;
    // Draw vertical grid lines    // Draw vertical grid lines
    // Draw vertical grid lines_WIDTH; x += GRID_SIZE_X) {_WIDTH; x += GRID_SIZE_X) {
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);VAS_HEIGHT);VAS_HEIGHT);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {if (x % (GRID_SIZE_X * 5) === 0) {
      if (x % (GRID_SIZE_X * 5) === 0) {, 0.8)'; // Darker numbers, 0.8)'; // Darker numbers
        ctx.fillStyle = 'rgba(50, 50, 50, 0.8)'; // Darker numbers
        ctx.font = '10px Inter';;;
        ctx.textAlign = 'center';, x, CANVAS_HEIGHT - 5);, x, CANVAS_HEIGHT - 5);
        ctx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    // Draw horizontal grid lines    // Draw horizontal grid lines
    // Draw horizontal grid linesEIGHT; y += GRID_SIZE_Y) {EIGHT; y += GRID_SIZE_Y) {
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);_WIDTH, y);_WIDTH, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {if (y % (GRID_SIZE_Y * 5) === 0) {
      if (y % (GRID_SIZE_Y * 5) === 0) {, 0.8)'; // Darker numbers, 0.8)'; // Darker numbers
        ctx.fillStyle = 'rgba(50, 50, 50, 0.8)'; // Darker numbers
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';), 15, y + 3);), 15, y + 3);
        ctx.fillText(y.toString(), 15, y + 3);
      }
    }tx.stroke();tx.stroke();
    ctx.stroke();
    // Draw center line (baseline)    // Draw center line (baseline)
    // Draw center line (baseline)
    ctx.beginPath();= 'rgba(40, 40, 40, 0.5)'; // Darker center line= 'rgba(40, 40, 40, 0.5)'; // Darker center line
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)'; // Darker center line
    ctx.lineWidth = 1;AS_HEIGHT / 2);AS_HEIGHT / 2);
    ctx.moveTo(0, CANVAS_HEIGHT / 2);EIGHT / 2);EIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    // Draw arrhythmia status if present    // Draw arrhythmia status if present
    // Draw arrhythmia status if present
    if (arrhythmiaStatus) { = arrhythmiaStatus.split('|'); = arrhythmiaStatus.split('|');
      const [status, count] = arrhythmiaStatus.split('|');
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        ctx.fillStyle = '#ef4444';r';r';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';ARRITMIA DETECTADA!', 45, 35);ARRITMIA DETECTADA!', 45, 35);
        ctx.fillText('¡PRIMERA ARRITMIA DETECTADA!', 45, 35);
        setShowArrhythmiaAlert(true);
      } se if (status.includes("ARRITMIA") && Number(count) > 1) {se if (status.includes("ARRITMIA") && Number(count) > 1) {
      else if (status.includes("ARRITMIA") && Number(count) > 1) {
        ctx.fillStyle = '#ef4444';r';r';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';eaksRef.current.filter(peak => peak.isArrhythmia).length;eaksRef.current.filter(peak => peak.isArrhythmia).length;
        const redPeaksCount = peaksRef.current.filter(peak => peak.isArrhythmia).length;
        ctx.fillText(`Arritmias detectadas: ${redPeaksCount}`, 45, 35);
      }
    }[arrhythmiaStatus, showArrhythmiaAlert]);[arrhythmiaStatus, showArrhythmiaAlert]);
  }, [arrhythmiaStatus, showArrhythmiaAlert]);
  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      const recentlyProcessed = peaksRef.current.some(const recentlyProcessed = peaksRef.current.some(
      const recentlyProcessed = peaksRef.current.some() < MIN_PEAK_DISTANCE_MS) < MIN_PEAK_DISTANCE_MS
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      if (recentlyProcessed) continue;if (recentlyProcessed) continue;
      if (recentlyProcessed) continue;
      let isPeak = true;let isPeak = true;
      let isPeak = true;
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      if (isPeak) {if (isPeak) {
      if (isPeak) {= i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {= i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {value) {value) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        potentialPeaks.push({
          index: i,rrentPoint.value,rrentPoint.value,
          value: currentPoint.value,
          time: currentPoint.time,nt.isArrhythmiant.isArrhythmia
          isArrhythmia: currentPoint.isArrhythmia
        });
      }
    }
    for (const peak of potentialPeaks) {for (const peak of potentialPeaks) {
    for (const peak of potentialPeaks) {some(some(
      const tooClose = peaksRef.current.some(.time - peak.time) < MIN_PEAK_DISTANCE_MS.time - peak.time) < MIN_PEAK_DISTANCE_MS
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      if (!tooClose) {if (!tooClose) {
      if (!tooClose) {nt.push({nt.push({
        peaksRef.current.push({
          time: peak.time,e,e,
          value: peak.value,.isArrhythmia.isArrhythmia
          isArrhythmia: peak.isArrhythmia
        });
      }
    }
    peaksRef.current.sort((a, b) => a.time - b.time);peaksRef.current.sort((a, b) => a.time - b.time);
    peaksRef.current.sort((a, b) => a.time - b.time);
    peaksRef.current = peaksRef.currentpeaksRef.current = peaksRef.current
    peaksRef.current = peaksRef.current WINDOW_WIDTH_MS) WINDOW_WIDTH_MS)
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);
  const renderSignal = useCallback(() => {  const renderSignal = useCallback(() => {
  const renderSignal = useCallback(() => {ef.current) {ef.current) {
    if (!canvasRef.current || !dataBufferRef.current) {(renderSignal);(renderSignal);
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    const currentTime = performance.now();    const currentTime = performance.now();
    const currentTime = performance.now();e - lastRenderTimeRef.current;e - lastRenderTimeRef.current;
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {
    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {l);l);
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    const canvas = canvasRef.current;    const canvas = canvasRef.current;
    const canvas = canvasRef.current;', { alpha: false });', { alpha: false });
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {FrameRef.current = requestAnimationFrame(renderSignal);FrameRef.current = requestAnimationFrame(renderSignal);
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    const now = Date.now();    const now = Date.now();
    const now = Date.now();
    if (gridCanvasRef.current) {drawGrid(ctx);
    drawGrid(ctx);e(gridCanvasRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {if (preserveResults && !isFingerDetected) {
    if (preserveResults && !isFingerDetected) {
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;rveResults && !isFingerDetected) {
    } lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);if (baselineRef.current === null) {
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {rrent = baselineRef.current * 0.95 + value * 0.05;
      baselineRef.current = baselineRef.current * 0.95 + value * 0.05;
    } baselineRef.current = value;
    } else {    const smoothedValue = smoothValue(value, lastValueRef.current);
    const smoothedValue = smoothValue(value, lastValueRef.current);05;
    lastValueRef.current = smoothedValue;
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale;
    isArrhythmia = false;
    let isArrhythmia = false;baselineRef.current || 0) - smoothedValue;
    if (rawArrhythmiaData && lizedValue * verticalScale;ludes("ARRITMIA") && 
        arrhythmiaStatus?.includes("ARRITMIA") && 
        now - rawArrhythmiaData.timestamp < 1000) {
      isArrhythmia = true;&& urrent = now;
      lastArrhythmiaTime.current = now;ITMIA") && 
    }   now - rawArrhythmiaData.timestamp < 1000) {
      isArrhythmia = true;    const dataPoint: PPGDataPoint = {
    const dataPoint: PPGDataPoint = {w;
      time: now,
      value: scaledValue,
      isArrhythmiat: PPGDataPoint = {
    };time: now,
      value: scaledValue,dataBufferRef.current.push(dataPoint);
    dataBufferRef.current.push(dataPoint);
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    detectPeaks(points, now);h(dataPoint);
    const points = dataBufferRef.current.getPoints();    if (points.length > 1) {
    if (points.length > 1) {
      ctx.beginPath();, now);= '#0EA5E9';
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 2;1) {und';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';A5E9';
      ctx.lineWidth = 2;let firstPoint = true;
      let firstPoint = true;;
      ctx.lineCap = 'round';for (let i = 1; i < points.length; i++) {
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const point = points[i];
        r (let i = 1; i < points.length; i++) {const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = canvas.height / 2 - prevPoint.value;WIDTH_MS);
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = canvas.height / 2 - point.value;.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = canvas.height / 2 - prevPoint.value;        if (firstPoint) {
        if (firstPoint) {.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);y1);
          ctx.moveTo(x1, y1);ght / 2 - point.value;
          firstPoint = false;
        }f (firstPoint) {tx.lineTo(x2, y2);
        ctx.lineTo(x2, y2););
          firstPoint = false;if (point.isArrhythmia) {
        if (point.isArrhythmia) {
          ctx.stroke();y2);();
          ctx.beginPath();
          ctx.strokeStyle = '#DC2626';
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();le = '#DC2626';();
          ctx.beginPath();1);= '#0EA5E9';
          ctx.strokeStyle = '#0EA5E9';
          ctx.moveTo(x2, y2);
          firstPoint = true;
        } ctx.strokeStyle = '#0EA5E9';
      }   ctx.moveTo(x2, y2);tx.stroke();
      ctx.stroke();t = true;
        }      peaksRef.current.forEach(peak => {
      peaksRef.current.forEach(peak => {OW_WIDTH_MS);
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - peak.value;
        aksRef.current.forEach(peak => {if (x >= 0 && x <= canvas.width) {
        if (x >= 0 && x <= canvas.width) {eak.time) * canvas.width / WINDOW_WIDTH_MS);
          ctx.beginPath();eight / 2 - peak.value; 0, Math.PI * 2);
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          ctx.fill();th();
          ctx.arc(x, y, 5, 0, Math.PI * 2);          if (peak.isArrhythmia) {
          if (peak.isArrhythmia) {rrhythmia ? '#DC2626' : '#0EA5E9';
            ctx.beginPath();th.PI * 2);
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#FEF7CD';
            ctx.lineWidth = 3;
            ctx.stroke(); 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#FEF7CD';ctx.font = 'bold 12px Inter';
            ctx.font = 'bold 12px Inter';
            ctx.fillStyle = '#F97316';
            ctx.textAlign = 'center';
            ctx.fillText('ARRITMIA', x, y - 25);
          } ctx.fillStyle = '#F97316';
            ctx.textAlign = 'center';          ctx.font = 'bold 12px Inter';
          ctx.font = 'bold 12px Inter'; y - 25);
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';, x, y - 15);
          ctx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
        } ctx.fillStyle = '#000000';
      }); ctx.textAlign = 'center';
    }     ctx.fillText(Math.abs(peak.value / verticalScale).toFixed(2), x, y - 15);
        }    lastRenderTimeRef.current = currentTime;
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults]);
    lastRenderTimeRef.current = currentTime;  useEffect(() => {
  useEffect(() => {ef.current = requestAnimationFrame(renderSignal);
    renderSignal();y, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults]);
    return () => { {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }urn () => {
    };if (animationFrameRef.current) {renderSignal]);
  }, [renderSignal]);onFrame(animationFrameRef.current);
      }  const handleReset = useCallback(() => {
  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;Reset = useCallback(() => {);
    const offCtx = offscreen.getContext('2d');thmiaAlert(false);
    if(offCtx){    peaksRef.current = [];  return (
      drawGrid(offCtx);t();lassName="fixed inset-0 bg-black/5 backdrop-blur-[1px]">
      gridCanvasRef.current = offscreen;
    }
  }, [drawGrid]);
set-0 bg-black/5 backdrop-blur-[1px]">T}
  const handleReset = useCallback(() => {set-0 z-0"
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];width={CANVAS_WIDTH}
    onReset();        height={CANVAS_HEIGHT}      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
  }, [onReset]);

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px]">left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">ll rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
      <canvas
        ref={canvasRef}assName="text-lg font-bold text-black/80">PPG</span>assName="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}{getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
        className="w-full h-[100vh] absolute inset-0 z-0"ivv>
      />assName="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-black/80">PPG</span>lassName="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
          <div className="w-[180px]">  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>{getQualityText(quality)}
              <div            </span>        <div className="flex flex-col items-center">
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${isFingerDetected ? quality : 0}%` }}8 transition-colors duration-300 ${
              />
            </div>>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>s duration-300 ${
              {getQualityText(quality)}ted ? 'text-gray-400' :
            </span>uality > 75 ? 'text-green-500' :okeWidth={1.5}
          </div>'text-yellow-500' :
        </div>  'text-red-500'pan className="text-[8px] text-center font-medium text-black/80">

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 transition-colors duration-300 ${n className="text-[8px] text-center font-medium text-black/80">
              !isFingerDetected ? 'text-gray-400' :{isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
              quality > 75 ? 'text-green-500' :          </span>      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
              quality > 50 ? 'text-yellow-500' :
              'text-red-500'nStartMeasurement}
            }`}-white/10 transition-colors duration-200 text-sm font-semibold"
            strokeWidth={1.5}
          />button  INICIAR
          <span className="text-[8px] text-center font-medium text-black/80">={onStartMeasurement}
            {isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}me="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
          </span>        >        <button 
        </div>Rk={handleReset}
      </div>k/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">button  RESET
        <button ck={handleReset}n>
          onClick={onStartMeasurement}me="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >RESET
          INICIAR    </button>
        </button>    </div>
    </div>export default PPGSignalMeter;
        <button 
          onClick={handleReset}











export default PPGSignalMeter;};  );    </div>      </div>        </button>          RESET        >          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"export default PPGSignalMeter;
