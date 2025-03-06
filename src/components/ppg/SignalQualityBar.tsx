
import React from 'react';

interface SignalQualityBarProps {
  quality: number;
  isFingerDetected: boolean;
}

const SignalQualityBar = ({ quality, isFingerDetected }: SignalQualityBarProps) => {
  const getQualityColor = (q: number) => {
    if (!isFingerDetected) return 'from-gray-400 to-gray-500';
    if (q > 75) return 'from-green-500 to-emerald-500';
    if (q > 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  const getQualityText = (q: number) => {
    if (!isFingerDetected) return 'Sin detección';
    if (q > 75) return 'Señal óptima';
    if (q > 50) return 'Señal aceptable';
    return 'Señal débil';
  };

  return (
    <div className="w-[180px]">
      <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
        <div
          className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
          style={{ width: `${isFingerDetected ? quality : 0}%` }}
        />
      </div>
      <span 
        className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
        style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}
      >
        {getQualityText(quality)}
      </span>
    </div>
  );
};

export default SignalQualityBar;
