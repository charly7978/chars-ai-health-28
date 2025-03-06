
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
  const isArrhythmiaDisplay = label === "ARRITMIAS";
  const isLipidsDisplay = label === "COLESTEROL/TRIGL.";
  const isPressureDisplay = label === "PRESIÓN ARTERIAL";
  const isGlucoseDisplay = label === "GLUCOSA";
  const isHemoglobinDisplay = label === "HEMOGLOBINA";

  const getDisplayContent = () => {
    if (!value || value === 0) {
      return {
        text: isLipidsDisplay || isPressureDisplay ? "--/--" : "--",
        color: "text-white"
      };
    }
    
    if (isHemoglobinDisplay) {
      const numValue = Number(value);
      if (numValue === 0) {
        return {
          text: "--",
          color: "text-white"
        };
      }
      
      if (numValue < 12) {
        return {
          text: String(value),
          color: "text-red-500"
        };
      } else if (numValue > 16) {
        return {
          text: String(value),
          color: "text-yellow-500"
        };
      } else {
        return {
          text: String(value),
          color: "text-green-500"
        };
      }
    }
    
    if (isArrhythmiaDisplay) {
      if (value === "--") {
        return { 
          text: "--/--", 
          color: "text-white" 
        };
      }
      
      const [status, count] = String(value).split('|');
      
      if (status === "ARRITMIA DETECTADA") {
        const displayCount = count ? `(${count})` : "";
        return {
          text: `ARRITMIA DETECTADA ${displayCount}`.trim(),
          color: "text-red-500"
        };
      }
      
      if (status === "CALIBRANDO...") {
        return {
          text: status,
          color: "text-yellow-500"
        };
      }
      
      const noArrhythmiaCount = count ? `(${count})` : "";
      return {
        text: `SIN ARRITMIAS ${noArrhythmiaCount}`.trim(),
        color: "text-cyan-500"
      };
    }
    
    if (isGlucoseDisplay) {
      const numValue = Number(value);
      
      if (numValue === 0) {
        return {
          text: "--",
          color: "text-white"
        };
      }
      
      if (numValue < 70) {
        return {
          text: String(value),
          color: "text-orange-500"
        };
      } else if (numValue > 140) {
        return {
          text: String(value),
          color: "text-red-500"
        };
      } else {
        return {
          text: String(value),
          color: "text-green-500"
        };
      }
    }
    
    if (isLipidsDisplay) {
      if (value === "0/0") {
        return {
          text: "--/--",
          color: "text-white"
        };
      }
      
      const [cholesterol, triglycerides] = String(value).split('/').map(Number);
      
      let color = "text-white";
      if (cholesterol > 200) {
        color = "text-red-500";
      } else if (cholesterol > 180) {
        color = "text-yellow-500";
      } else if (cholesterol > 0) {
        color = "text-green-500";
      }
      
      return {
        text: String(value),
        color
      };
    }
    
    return {
      text: value,
      color: "text-white"
    };
  };

  const { text, color } = getDisplayContent();

  return (
    <div className={`relative overflow-hidden group bg-black backdrop-blur-md rounded-lg p-3 transition-all duration-300 ${
      highlighted ? 'from-black to-black' : ''
    }`}>
      <div className="flex flex-col items-center justify-center h-full">
        <h3 className={`text-white text-[13px] font-medium mb-2 text-center w-full leading-tight ${
          highlighted ? 'text-cyan-400/90' : ''
        }`}>
          {label}
        </h3>
        
        <div className="flex items-center justify-center gap-1 min-h-[32px]">
          <span 
            className={`font-bold ${color} transition-colors duration-300 
              ${isArrhythmiaDisplay ? 'text-[12px] leading-tight' : ''}
              ${isLipidsDisplay || isPressureDisplay ? 'text-[15px] leading-tight' : ''}
              ${!isArrhythmiaDisplay && !isLipidsDisplay && !isPressureDisplay ? 'text-[16px] leading-tight' : ''}
              ${highlighted ? 'drop-shadow-glow' : ''}`}
            style={{
              textShadow: highlighted ? '0 0 8px rgba(6, 182, 212, 0.5)' : 'none'
            }}
          >
            {text}
          </span>
          
          {!isArrhythmiaDisplay && !isLipidsDisplay && unit && (
            <span className={`text-gray-400/90 text-[11px] font-medium leading-tight ${highlighted ? 'text-cyan-400/90' : ''}`}>
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VitalSign;
