import React, { useState, useRef, useEffect, useCallback } from 'react';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus: string;
  rawArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null | undefined;
  preserveResults?: boolean;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 200;

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
  const [points, setPoints] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#f1f5f9');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let i = gridSize; i < CANVAS_WIDTH; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let j = gridSize; j < CANVAS_HEIGHT; j += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(CANVAS_WIDTH, j);
      ctx.stroke();
    }
  }, []);

  const drawSignal = useCallback((ctx: CanvasRenderingContext2D, points: number[]) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = isFingerDetected ? '#4ade80' : '#f43f5e';
    ctx.beginPath();
    if (points.length > 0) {
      ctx.moveTo(0, CANVAS_HEIGHT / 2 + points[0]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(i, CANVAS_HEIGHT / 2 + points[i]);
      }
      ctx.stroke();
    }
  }, [isFingerDetected]);

  const drawQualityIndicator = useCallback((ctx: CanvasRenderingContext2D, quality: number) => {
    const centerX = CANVAS_WIDTH - 50;
    const centerY = 30;
    const radius = 20;
    const angle = Math.PI * 2 * quality;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, angle, quality < 0.5);
    ctx.fillStyle = isFingerDetected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(248, 113, 113, 0.5)';
    ctx.fill();

    ctx.strokeStyle = isFingerDetected ? '#10b981' : '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '12px sans-serif';
    ctx.fillStyle = isFingerDetected ? '#10b981' : '#f87171';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(quality * 100)}%`, centerX, centerY);
  }, [isFingerDetected]);

  const drawArrhythmiaStatus = useCallback((ctx: CanvasRenderingContext2D, arrhythmiaStatus: string) => {
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const [status, count] = arrhythmiaStatus.split('|');
    
    let textColor = '#4ade80';
    if (status !== "SIN ARRITMIAS") {
      textColor = '#f87171';
    }
    
    ctx.fillStyle = textColor;
    ctx.fillText(`Arritmia: ${status} (${count || 0})`, 10, 10);
  }, []);

  const renderFrame = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGrid(ctx);
    drawSignal(ctx, points);
    drawQualityIndicator(ctx, quality);
    drawArrhythmiaStatus(ctx, arrhythmiaStatus);

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [points, quality, isFingerDetected, drawGrid, arrhythmiaStatus, drawQualityIndicator, drawSignal, drawArrhythmiaStatus]);

  useEffect(() => {
    setPoints(prevPoints => {
      const newPoints = [...prevPoints, value];
      while (newPoints.length > CANVAS_WIDTH) {
        newPoints.shift();
      }
      return newPoints;
    });
  }, [value]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderFrame]);

  return (
    <div className="w-full h-full flex flex-col bg-black">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full"
      />
    </div>
  );
};

export default PPGSignalMeter;
