import React, { useEffect } from 'react';

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
  const isHemoglobinDisplay = label === "HEMOGLOBINA";
  const isCalibrating = calibrationProgress !== undefined && calibrationProgress < 100;

  // Loguear cuando cambia el progreso de calibración para depuración
  useEffect(() => {
    if (isCalibrating) {
      console.log(`Progreso de calibración para ${label}: ${calibrationProgress}%`);
    }
  }, [calibrationProgress, label, isCalibrating]);

  const getDisplayContent = () => {
    if (isCalibrating) {
      if (isArrhythmiaDisplay) {
        return {
          text: `Calibrando ${Math.round(calibrationProgress)}%`,
          color: "text-yellow-500",
          isCalibrating: true
        };
      }
      
      return {
        text: value && value !== 0 ? value : "--",
        secondaryText: `${Math.round(calibrationProgress)}%`,
        color: "text-white",
        secondaryColor: "text-yellow-500",
        isCalibrating: true
      };
    }
    
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

  const { text, color, secondaryText, secondaryColor, isCalibrating: isDisplayCalibrating } = getDisplayContent();

  return (
    <div className={`relative overflow-hidden group bg-black backdrop-blur-md rounded-lg p-2.5 transition-all duration-300 ${
      highlighted ? 'from-black to-black' : ''
    } ${isCalibrating ? 'ring-1 ring-yellow-500' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[progress_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {isCalibrating && calibrationProgress !== undefined && (
        <>
          <div 
            className="absolute bottom-0 left-0 h-1.5 bg-yellow-500 transition-all duration-300" 
            style={{ width: `${calibrationProgress}%` }}
          ></div>
          <div className="absolute top-0 right-0 h-1 w-1 rounded-full bg-yellow-500 animate-pulse"></div>
        </>
      )}
      
      <div className="flex flex-col items-center justify-center h-full">
        <h3 className={`text-white text-xs font-medium mb-0.5 text-center w-full ${highlighted ? 'text-cyan-400/90' : ''}`}>
          {label}
        </h3>
        
        <div className="flex items-center justify-center gap-1 min-h-[28px]">
          <span 
            className={`font-bold ${color} transition-colors duration-300 
              ${isArrhythmiaDisplay ? 'text-xs leading-tight' : ''}
              ${isDisplayCalibrating && !isArrhythmiaDisplay ? 'text-sm' : ''}
              ${isLipidsDisplay || isPressureDisplay ? 'text-sm leading-none' : ''}
              ${!isDisplayCalibrating && !isArrhythmiaDisplay && !isLipidsDisplay && !isPressureDisplay ? 'text-base leading-none' : ''}
              ${highlighted ? 'drop-shadow-glow' : ''}`}
            style={{
              textShadow: highlighted ? '0 0 8px rgba(6, 182, 212, 0.5)' : 'none'
            }}
          >
            {text}
          </span>
          
          {secondaryText && (
            <span className={`${secondaryColor || 'text-yellow-500'} text-[10px] font-medium leading-none ml-0.5`}>
              {secondaryText}
            </span>
          )}
          
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
