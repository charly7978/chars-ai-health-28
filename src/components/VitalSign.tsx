import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
}

const VitalSign: React.FC<VitalSignProps> = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress 
}) => {
  const isArrhythmiaDisplay = label === "ARRITMIAS";
  const isLipidsDisplay = label === "COLESTEROL/TRIGL.";
  const isPressureDisplay = label === "PRESIÓN ARTERIAL";
  const isGlucoseDisplay = label === "GLUCOSA";
  const isCalibrating = calibrationProgress !== undefined && calibrationProgress < 100;

  const getDisplayContent = () => {
    if (isCalibrating) {
      return {
        text: `CALIBRANDO ${Math.round(calibrationProgress)}%`,
        color: "text-yellow-500"
      };
    }
    
    if (!value || value === 0) {
      return {
        text: isLipidsDisplay || isPressureDisplay ? "--/--" : "--",
        color: "text-white"
      };
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
        return {
          text: count ? `ARRITMIA DETECTADA (${count})` : "ARRITMIA DETECTADA",
          color: "text-red-500"
        };
      }
      
      if (status === "CALIBRANDO...") {
        return {
          text: status,
          color: "text-yellow-500"
        };
      }
      
      return {
        text: "SIN ARRITMIA DETECTADA",
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
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[progress_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {isCalibrating && (
        <div className="absolute bottom-0 left-0 h-1 bg-yellow-500" style={{ width: `${calibrationProgress}%` }}></div>
      )}
      
      <div className="flex flex-col items-center justify-center h-full">
        <h3 className={`text-white text-[11px] font-medium mb-1.5 text-center w-full ${highlighted ? 'text-cyan-400/90' : ''}`}>
          {label}
        </h3>
        
        <div className="flex items-center justify-center gap-1 min-h-[32px]">
          <span 
            className={`font-bold ${color} transition-colors duration-300 
              ${isArrhythmiaDisplay ? 'text-[10px] leading-tight' : 'text-sm leading-none'}
              ${isLipidsDisplay || isPressureDisplay ? 'text-[13px] leading-none' : ''}
              ${highlighted ? 'drop-shadow-glow' : ''}`}
            style={{
              textShadow: highlighted ? '0 0 8px rgba(6, 182, 212, 0.5)' : 'none'
            }}
          >
            {text}
          </span>
          {!isArrhythmiaDisplay && !isLipidsDisplay && !isCalibrating && unit && (
            <span className={`text-gray-400/90 text-[10px] font-medium leading-none ${highlighted ? 'text-cyan-400/90' : ''}`}>
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VitalSign;
