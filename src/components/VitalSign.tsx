
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
    <div className="relative flex flex-col justify-center items-center p-2 bg-transparent">
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/90 mb-1">
        {label}
      </div>
      
      <div className={`font-bold text-lg sm:text-xl ${highlighted ? 'text-white animate-value-glow' : 'text-white'}`}>
        <span className="relative inline-block">
          {value}
        </span>
        {unit && <span className="text-xs text-white/80 ml-1">{unit}</span>}
      </div>
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 bg-transparent overflow-hidden pointer-events-none">
          <div 
            className="h-full bg-white/5 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-white/90">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
