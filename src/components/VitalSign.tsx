
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'normal';
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress,
  riskLevel = 'normal'
}: VitalSignProps) => {
  // Function to determine risk color
  const getRiskColor = () => {
    switch (riskLevel) {
      case 'high':
        return 'bg-[#ea384c]/10 border-[#ea384c] shadow-[0_0_8px_rgba(234,56,76,0.3)]';
      case 'medium':
        return 'bg-[#F97316]/10 border-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.3)]';
      case 'low':
        return 'bg-[#FEF7CD]/10 border-[#FEF7CD] shadow-[0_0_6px_rgba(254,247,205,0.2)]';
      case 'normal':
      default:
        return 'bg-[#F2FCE2]/10 border-[#F2FCE2]/30 shadow-[0_0_4px_rgba(242,252,226,0.2)]';
    }
  };

  // Get risk indicator class
  const riskIndicatorClass = getRiskColor();

  return (
    <div className={`relative flex flex-col justify-center items-center p-2 transition-all duration-500 border-[1px] rounded-md ${riskIndicatorClass} text-center`}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-black/70 mb-1">
        {label}
      </div>
      
      <div className={`font-bold text-lg sm:text-xl transition-all duration-300 ${highlighted ? 'text-white shadow-sm animate-[value-glow_2.5s_ease-in-out_infinite]' : 'text-white'}`}>
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
