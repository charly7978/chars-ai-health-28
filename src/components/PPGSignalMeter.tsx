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
  const pointsRef = useRef<{x: number, y: number}[]>([]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match its display size
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear the canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If no finger or preserving results, keep current points
    if (!isFingerDetected && !preserveResults) {
      pointsRef.current = [];
      return;
    }

    // Calculate the y position for this value (centered, scaled)
    const y = canvas.height / 2 - (value * 50);
    
    // Add new point
    if (isFingerDetected || preserveResults) {
      // If we've been drawing, add the next point
      if (pointsRef.current.length > 0) {
        // Get the last X position and increment it
        const lastX = pointsRef.current[pointsRef.current.length - 1].x;
        const x = lastX + 2;
        
        // If we're at the right edge, shift everything left
        if (x > canvas.width) {
          // Shift all points left
          pointsRef.current = pointsRef.current.map(point => ({
            x: point.x - 4,
            y: point.y
          })).filter(point => point.x >= 0);
          
          // Add new point at the rightmost position
          pointsRef.current.push({
            x: canvas.width - 2,
            y
          });
        } else {
          // Just add the new point
          pointsRef.current.push({ x, y });
        }
      } else {
        // First point, start at the left
        pointsRef.current.push({ x: 0, y });
      }
    }

    // Draw the waveform
    if (pointsRef.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      
      // Move to the first point
      ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
      
      // Draw lines to each subsequent point
      for (let i = 1; i < pointsRef.current.length; i++) {
        ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
      }
      
      ctx.stroke();
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
