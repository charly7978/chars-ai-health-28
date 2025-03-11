
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight / 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isFingerDetected && !preserveResults) return;

    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    const x = canvas.width - 10;
    const y = canvas.height / 2 - (value * 50);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [value, isFingerDetected, preserveResults]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full bg-black"
        style={{
          imageRendering: 'pixelated'
        }}
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
