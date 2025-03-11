
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
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevXRef = useRef<number>(0);
  const prevYRef = useRef<number>(0);

  // Add a debug effect to log values when they change
  useEffect(() => {
    console.log("PPGSignalMeter rendering with:", { 
      value, 
      quality, 
      isFingerDetected, 
      preserveResults,
      canvasExists: !!canvasRef.current
    });
  }, [value, quality, isFingerDetected, preserveResults]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("Canvas reference is null");
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn("Unable to get 2D context");
      return;
    }

    // Set canvas dimensions only if they've changed
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      console.log(`Resizing canvas from ${canvas.width}x${canvas.height} to ${canvas.clientWidth}x${canvas.clientHeight}`);
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Start with a black background
    if (!isFingerDetected && !preserveResults) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      prevXRef.current = 0;
      prevYRef.current = canvas.height / 2;
      return;
    }

    // Calculate new coordinates
    let x = prevXRef.current + 2;
    const y = canvas.height / 2 - (value * 50);

    // If we reach the right edge, scroll the waveform left
    if (x >= canvas.width) {
      // Save the current display
      const imageData = ctx.getImageData(4, 0, canvas.width - 4, canvas.height);
      
      // Clear canvas
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw previous content shifted left
      ctx.putImageData(imageData, 0, 0);
      
      // Update x to draw at the right edge
      x = canvas.width - 2;
    }

    // Draw new line segment
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.moveTo(prevXRef.current, prevYRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Update position references for next frame
    prevXRef.current = x;
    prevYRef.current = y;
    
    // Debug: Log every 50 frames to avoid console spam
    if (Math.random() < 0.02) {
      console.log(`Drawing line from (${prevXRef.current}, ${prevYRef.current}) to (${x}, ${y})`);
    }
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
