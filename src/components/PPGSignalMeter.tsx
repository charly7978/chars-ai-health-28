
import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus: string;
  rawArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  preserveResults?: boolean;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({
  value,
  quality,
  isFingerDetected,
  onStartMeasurement,
  onReset,
  preserveResults = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevXRef = useRef<number>(0);
  const prevYRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Clear old data if no finger detected and not preserving results
    if (!isFingerDetected && !preserveResults) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      prevXRef.current = 0;
      prevYRef.current = canvas.height / 2;
      return;
    }

    // Calculate new point coordinates
    const x = prevXRef.current + 2;
    const y = canvas.height / 2 - (value * 50);

    // Reset X position if we reach the end of canvas
    if (x >= canvas.width) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      prevXRef.current = 0;
      prevYRef.current = y;
      return;
    }

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.moveTo(prevXRef.current, prevYRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Store current position for next frame
    prevXRef.current = x;
    prevYRef.current = y;
  }, [value, isFingerDetected, preserveResults]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full bg-black"
      />
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
        <Button
          onClick={onStartMeasurement}
          className="bg-transparent border border-white backdrop-blur-sm hover:bg-white/10"
        >
          INICIAR MEDICIÓN
        </Button>
        
        <Button
          onClick={onReset}
          className="bg-transparent border border-white backdrop-blur-sm hover:bg-white/10"
        >
          RESETEAR
        </Button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
