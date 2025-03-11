
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress 
}: VitalSignProps) => {
  return (
    <div className="relative flex flex-col justify-center items-center p-2 backdrop-blur-md bg-transparent transition-all duration-500">
      <div className="text-[10px] font-medium text-black/70 uppercase tracking-tight mb-1">
        {label}
      </div>
      
      <div className="font-bold text-lg sm:text-xl text-black/90">
        {value}
        {unit && <span className="text-xs text-black/60 ml-1">{unit}</span>}
      </div>
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 backdrop-blur-sm bg-transparent overflow-hidden">
          <div 
            className="h-full bg-blue-500/10 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-black/70">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
