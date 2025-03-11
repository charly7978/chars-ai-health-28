
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
}

const VitalSign: React.FC<VitalSignProps> = ({ 
  label, 
  value, 
  unit, 
  highlighted = false 
}) => {
  return (
    <div className="vital-sign-panel rounded-lg p-3 flex flex-col items-center justify-center h-full text-center">
      <div className="text-xs text-gold-light font-semibold tracking-wider mb-1">
        {label}
      </div>
      <div className={`font-mono text-xl md:text-2xl font-bold ${highlighted ? 'text-white animate-pulse-white' : 'text-gold-medium'}`}>
        {value}
      </div>
      {unit && (
        <div className="text-xs text-gold-light mt-1">
          {unit}
        </div>
      )}
    </div>
  );
};

export default VitalSign;
