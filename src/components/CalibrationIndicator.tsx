
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
}

const CalibrationIndicator: React.FC<CalibrationIndicatorProps> = ({
  isCalibrating,
  progress,
  message
}) => {
  if (!isCalibrating) return null;

  const avgProgress = Math.round(
    Object.values(progress).reduce((a, b) => a + b, 0) / Object.keys(progress).length
  );

  return (
    <div className="absolute inset-x-0 top-[15%] px-4 z-50">
      <div className="bg-[#2C2A2B]/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[#D4C6A3]/80 text-sm font-medium">{message}</span>
            <span className="text-[#D4C6A3] text-sm font-medium">{avgProgress}%</span>
          </div>
          <Progress value={avgProgress} className="h-2" />
        </div>
      </div>
    </div>
  );
};

export default CalibrationIndicator;
