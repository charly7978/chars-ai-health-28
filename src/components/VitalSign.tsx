
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit: string;
  highlighted?: boolean;
}

const VitalSign = ({ label, value, unit, highlighted = false }: VitalSignProps) => {
  return (
    <div className="relative p-1 vital-sign-panel rounded-sm backdrop-blur-sm flex flex-col items-center justify-center">
      <h3 className="text-[10px] font-bold text-gold-lighter mb-1">{label}</h3>
      
      <div className={`flex items-baseline justify-center ${highlighted ? 'animate-shine' : ''}`}>
        <span className={`text-lg sm:text-xl font-bold ${
          // Allow BPM to always show as white since it works without finger
          label.includes('FRECUENCIA') 
            ? 'text-white' 
            : highlighted 
              ? 'text-white' 
              : value === "--" || value === "--/--" || value === 0 
                ? 'text-gold-mid/50' 
                : 'text-white'
        }`}>
          {value}
        </span>
        
        <span className="text-[10px] ml-1 text-gold-light font-medium">{unit}</span>
      </div>
    </div>
  );
};

export default VitalSign;
