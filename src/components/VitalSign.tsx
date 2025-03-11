
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
    <div className={`relative flex flex-col justify-center items-center p-2 rounded-lg ${
      highlighted ? 'bg-black/15' : 'bg-black/15'
    } backdrop-blur-sm border-0 transition-all duration-500`}>
      <div className="text-[10px] font-medium text-white/70 uppercase tracking-tight mb-1">
        {label}
      </div>
      
      <div className="font-bold text-lg sm:text-xl text-white/90">
        {value}
        {unit && <span className="text-xs text-white/60 ml-1">{unit}</span>}
      </div>
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-blue-400/10 rounded-lg overflow-hidden">
          <div 
            className="h-full bg-blue-500/10 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-white/70">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
