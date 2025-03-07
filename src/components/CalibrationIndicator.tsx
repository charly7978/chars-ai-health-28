import React from 'react';

interface CalibrationProgress {
  heartRate: number;
  spo2: number;
  pressure: number;
  arrhythmia: number;
  glucose: number;
  lipids: number;
  hemoglobin: number;
}

interface CalibrationIndicatorProps {
  isCalibrating: boolean;
  progress: CalibrationProgress;
  message?: string;
}

const CalibrationIndicator: React.FC<CalibrationIndicatorProps> = ({
  isCalibrating,
  progress,
  message
}) => {
  if (!isCalibrating) return null;

  const renderProgressBar = (value: number, label: string) => (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 p-4 bg-black/80 backdrop-blur-sm z-50">
      <div className="max-w-md mx-auto space-y-4">
        {message && (
          <p className="text-center text-sm font-medium text-gray-300 mb-4">
            {message}
          </p>
        )}
        
        <div className="space-y-3">
          {renderProgressBar(progress.heartRate, "Frecuencia Cardíaca")}
          {renderProgressBar(progress.spo2, "SpO2")}
          {renderProgressBar(progress.pressure, "Presión Arterial")}
          {renderProgressBar(progress.arrhythmia, "Detección de Arritmias")}
          {renderProgressBar(progress.glucose, "Glucosa")}
          {renderProgressBar(progress.lipids, "Lípidos")}
          {renderProgressBar(progress.hemoglobin, "Hemoglobina")}
        </div>

        <div className="flex justify-center items-center gap-2 mt-4">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-gray-400">Calibrando sensores...</span>
        </div>
      </div>
    </div>
  );
};

export default CalibrationIndicator; 