
import React from 'react';
import { Progress } from "@/components/ui/progress";

interface CalibrationIndicatorProps {
  isCalibrating: boolean;
  progress: {
    heartRate: number;
    spo2: number;
    pressure: number;
    arrhythmia: number;
    glucose: number;
    lipids: number;
    hemoglobin: number;
  };
  message: string;
  isFingerDetected: boolean;
}

const CalibrationIndicator: React.FC<CalibrationIndicatorProps> = ({
  isCalibrating,
  progress,
  message,
  isFingerDetected
}) => {
  if (!isCalibrating) return null;

  const avgProgress = Math.round(
    Object.values(progress).reduce((a, b) => a + b, 0) / Object.keys(progress).length
  );

  return (
    <div className="absolute inset-x-0 top-[35%] px-4 z-50">
      <div className="px-4 py-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[#C8C8C9] text-xs font-medium">
              {!isFingerDetected ? "Coloque su dedo en la cámara para comenzar la calibración" : message}
            </span>
            <span className="text-[#C8C8C9] text-xs font-medium">{isFingerDetected ? `${avgProgress}%` : '0%'}</span>
          </div>
          <Progress 
            value={isFingerDetected ? avgProgress : 0} 
            className="h-1.5 bg-[#2C2A2B]/20" 
          />
        </div>
      </div>
    </div>
  );
};

export default CalibrationIndicator;
