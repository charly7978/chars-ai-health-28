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
  const isHemoglobinDisplay = label === "HEMOGLOBINA";
  const isHeartRateDisplay = label === "FRECUENCIA CARDÍACA";
  const isOxygenDisplay = label === "SPO2";
  const isCalibrating = calibrationProgress !== undefined && calibrationProgress < 100;

  const getDisplayContent = () => {
    if (isCalibrating) {
      return {
        text: `CALIBRANDO ${Math.round(calibrationProgress)}%`,
        color: "text-yellow-500",
        isCalibrating: true
      };
    }
    
    if (!value || value === 0) {
      return {
        text: isLipidsDisplay || isPressureDisplay ? "--/--" : "--",
        color: "text-white"
      };
    }

    if (isHeartRateDisplay) {
      const hr = Number(value);
      if (hr === 0) return { text: "--", color: "text-white" };
      
      if (hr < 60) return { text: String(value), color: "text-orange-500" };  // Bradicardia
      if (hr > 100) return { text: String(value), color: "text-red-500" };    // Taquicardia
      return { text: String(value), color: "text-green-500" };                 // Normal
    }
    
    if (isOxygenDisplay) {
      const spo2 = Number(value);
      if (spo2 === 0) return { text: "--", color: "text-white" };
      
      if (spo2 < 90) return { text: String(value), color: "text-red-500" };     // Hipoxia severa
      if (spo2 < 95) return { text: String(value), color: "text-orange-500" };  // Hipoxia moderada
      return { text: String(value), color: "text-green-500" };                   // Normal
    }
    
    if (isHemoglobinDisplay) {
      const hb = Number(value);
      if (hb === 0) return { text: "--", color: "text-white" };
      
      if (hb < 12) return { text: String(value), color: "text-red-500" };      // Anemia
      if (hb > 16) return { text: String(value), color: "text-yellow-500" };   // Elevada
      return { text: String(value), color: "text-green-500" };                 // Normal
    }
    
    if (isArrhythmiaDisplay) {
      if (value === "--") return { text: "--/--", color: "text-white" };
      
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
      const glucose = Number(value);
      
      if (glucose === 0) return { text: "--", color: "text-white" };
      
      if (glucose < 70) return { text: String(value), color: "text-orange-500" };  // Hipoglucemia
      if (glucose > 180) return { text: String(value), color: "text-red-500" };    // Hiperglucemia severa
      if (glucose > 140) return { text: String(value), color: "text-yellow-500" }; // Hiperglucemia moderada
      return { text: String(value), color: "text-green-500" };                     // Normal
    }
    
    if (isLipidsDisplay) {
      if (value === "0/0") return { text: "--/--", color: "text-white" };
      
      const [cholesterol, triglycerides] = String(value).split('/').map(Number);
      
      let color = "text-white";
      // Evaluación del colesterol
      if (cholesterol > 240) {
        color = "text-red-500";      // Alto riesgo
      } else if (cholesterol > 200) {
        color = "text-yellow-500";   // Riesgo moderado
      } else if (cholesterol > 0) {
        color = "text-green-500";    // Normal
      }
      
      return { text: String(value), color };
    }
    
    if (isPressureDisplay) {
      if (value === "--/--") return { text: "--/--", color: "text-white" };
      
      const [systolic, diastolic] = String(value).split('/').map(Number);
      
      let color = "text-white";
      if (systolic >= 180 || diastolic >= 120) {
        color = "text-red-500";       // Crisis hipertensiva
      } else if (systolic >= 140 || diastolic >= 90) {
        color = "text-orange-500";    // Hipertensión
      } else if (systolic >= 130 || diastolic >= 80) {
        color = "text-yellow-500";    // Prehipertensión
      } else if (systolic > 0 && diastolic > 0) {
        color = "text-green-500";     // Normal
      }
      
      return { text: String(value), color };
    }
    
    return {
      text: value,
      color: "text-white"
    };
  };

  const { text, color, isCalibrating: isDisplayCalibrating } = getDisplayContent();

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
              ${isArrhythmiaDisplay ? 'text-[10px] leading-tight' : ''}
              ${isDisplayCalibrating && !isArrhythmiaDisplay ? 'text-[11px]' : ''}
              ${isLipidsDisplay || isPressureDisplay ? 'text-[13px] leading-none' : ''}
              ${!isDisplayCalibrating && !isArrhythmiaDisplay && !isLipidsDisplay && !isPressureDisplay ? 'text-sm leading-none' : ''}
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
