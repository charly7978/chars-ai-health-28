
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
    <div className="relative flex flex-col justify-center items-center p-2 bg-transparent transition-all duration-500 border-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-black/70 mb-1">
        {label}
      </div>
      
      <div className={`font-bold text-lg sm:text-xl transition-all duration-300 ${highlighted ? 'text-white shadow-sm animate-value-glow' : 'text-white'}`}>
        <span className="relative inline-block after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent after:animate-[progress_2s_linear_infinite] after:opacity-0 hover:after:opacity-100">
          {value}
        </span>
        {unit && <span className="text-xs text-white/70 ml-1">{unit}</span>}
      </div>
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 bg-transparent overflow-hidden pointer-events-none border-0">
          <div 
            className="h-full bg-blue-500/5 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-white/80">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
