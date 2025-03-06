
import React, { useRef, useEffect, useCallback } from 'react';
import { PPGDataPoint } from '../../utils/CircularBuffer';

interface SignalCanvasProps {
  points: PPGDataPoint[];
  peaks: {time: number, value: number, isArrhythmia: boolean}[];
  now: number;
  width: number;
  height: number;
  windowWidthMs: number;
  verticalScale: number;
}

const SignalCanvas = ({ 
  points, 
  peaks, 
  now, 
  width, 
  height, 
  windowWidthMs, 
  verticalScale 
}: SignalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#f1f5f9');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const GRID_SIZE_X = 20;
    const GRID_SIZE_Y = 5;

    // Draw fine grid
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.1)';
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= width; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      if (x % (GRID_SIZE_X * 4) === 0) {
        ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${x / 10}ms`, x, height - 5);
      }
    }

    for (let y = 0; y <= height; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      if (y % (GRID_SIZE_Y * 4) === 0) {
        const amplitude = ((height / 2) - y) / verticalScale;
        ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(amplitude.toFixed(1), 25, y + 4);
      }
    }
    ctx.stroke();

    // Draw bold grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += GRID_SIZE_X * 4) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }

    for (let y = 0; y <= height; y += GRID_SIZE_Y * 4) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Draw center line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [height, width, verticalScale]);

  const drawSignal = useCallback((ctx: CanvasRenderingContext2D) => {
    if (points.length <= 1) return;

    ctx.beginPath();
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    let firstPoint = true;
    
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const point = points[i];
      
      const x1 = width - ((now - prevPoint.time) * width / windowWidthMs);
      const y1 = height / 2 - prevPoint.value;
      const x2 = width - ((now - point.time) * width / windowWidthMs);
      const y2 = height / 2 - point.value;

      if (firstPoint) {
        ctx.moveTo(x1, y1);
        firstPoint = false;
      }
      ctx.lineTo(x2, y2);
      
      if (point.isArrhythmia) {
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = '#DC2626';
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = '#0EA5E9';
        ctx.moveTo(x2, y2);
        firstPoint = true;
      }
    }
    ctx.stroke();
  }, [height, now, points, width, windowWidthMs]);

  const drawPeaks = useCallback((ctx: CanvasRenderingContext2D) => {
    peaks.forEach(peak => {
      const x = width - ((now - peak.time) * width / windowWidthMs);
      const y = height / 2 - peak.value;
      
      if (x >= 0 && x <= width) {
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
  }, [height, now, peaks, verticalScale, width, windowWidthMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Clear and draw everything
    drawGrid(ctx);
    drawSignal(ctx);
    drawPeaks(ctx);

  }, [points, peaks, now, drawGrid, drawSignal, drawPeaks]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-[calc(45vh)] mt-12"
    />
  );
};

export default SignalCanvas;
