
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
      
      if (hr < 60) return { 
        text: String(value), 
        color: "text-orange-500",
        condition: "BRADICARDIA"
      };
      if (hr > 100) return { 
        text: String(value), 
        color: "text-red-500",
        condition: "TAQUICARDIA"
      };
      return { 
        text: String(value), 
        color: "text-green-500",
        condition: "NORMAL"
      };
    }
    
    if (isOxygenDisplay) {
      const spo2 = Number(value);
      if (spo2 === 0) return { text: "--", color: "text-white" };
      
      if (spo2 < 90) return { 
        text: String(value), 
        color: "text-red-500",
        condition: "HIPOXIA SEVERA"
      };
      if (spo2 < 95) return { 
        text: String(value), 
        color: "text-orange-500",
        condition: "HIPOXIA MODERADA"
      };
      return { 
        text: String(value), 
        color: "text-green-500",
        condition: "NORMAL"
      };
    }
    
    if (isHemoglobinDisplay) {
      const hb = Number(value);
      if (hb === 0) return { text: "--", color: "text-white" };
      
      if (hb < 12) return { 
        text: String(value), 
        color: "text-red-500",
        condition: "ANEMIA"
      };
      if (hb > 16) return { 
        text: String(value), 
        color: "text-yellow-500",
        condition: "ELEVADA"
      };
      return { 
        text: String(value), 
        color: "text-green-500",
        condition: "NORMAL"
      };
    }
    
    if (isGlucoseDisplay) {
      const glucose = Number(value);
      
      if (glucose === 0) return { text: "--", color: "text-white" };
      
      if (glucose < 70) return { 
        text: String(value), 
        color: "text-orange-500",
        condition: "HIPOGLUCEMIA"
      };
      if (glucose > 180) return { 
        text: String(value), 
        color: "text-red-500",
        condition: "HIPERGLUCEMIA SEVERA"
      };
      if (glucose > 140) return { 
        text: String(value), 
        color: "text-yellow-500",
        condition: "HIPERGLUCEMIA MODERADA"
      };
      return { 
        text: String(value), 
        color: "text-green-500",
        condition: "NORMAL"
      };
    }
    
    if (isLipidsDisplay) {
      if (value === "0/0") return { text: "--/--", color: "text-white" };
      
      const [cholesterol, triglycerides] = String(value).split('/').map(Number);
      
      let color = "text-white";
      let condition = "";
      
      if (cholesterol > 240) {
        color = "text-red-500";
        condition = "ALTO RIESGO";
      } else if (cholesterol > 200) {
        color = "text-yellow-500";
        condition = "RIESGO MODERADO";
      } else if (cholesterol > 0) {
        color = "text-green-500";
        condition = "NORMAL";
      }
      
      return { text: String(value), color, condition };
    }
    
    if (isPressureDisplay) {
      if (value === "--/--") return { text: "--/--", color: "text-white" };
      
      const [systolic, diastolic] = String(value).split('/').map(Number);
      
      let color = "text-white";
      let condition = "";
      
      if (systolic >= 180 || diastolic >= 120) {
        color = "text-red-500";
        condition = "CRISIS HIPERTENSIVA";
      } else if (systolic >= 140 || diastolic >= 90) {
        color = "text-orange-500";
        condition = "HIPERTENSIÓN";
      } else if (systolic >= 130 || diastolic >= 80) {
        color = "text-yellow-500";
        condition = "PREHIPERTENSIÓN";
      } else if (systolic > 0 && diastolic > 0) {
        color = "text-green-500";
        condition = "NORMAL";
      }
      
      return { text: String(value), color, condition };
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
    
    return {
      text: value,
      color: "text-white"
    };
  };

  const { text, color, condition, isCalibrating: isDisplayCalibrating } = getDisplayContent();

  return (
    <div className={`relative overflow-hidden group bg-black backdrop-blur-md rounded-lg p-3 transition-all duration-300 ${
      highlighted ? 'from-black to-black' : ''
    }`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[progress_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {isCalibrating && (
        <div className="absolute bottom-0 left-0 h-1 bg-yellow-500" style={{ width: `${calibrationProgress}%` }}></div>
      )}
      
      <div className="flex flex-col items-center justify-center h-full min-h-[100px] gap-2">
        <h3 className={`text-white text-[13px] font-medium text-center tracking-wide uppercase ${highlighted ? 'text-cyan-400/90' : ''}`}>
          {label}
        </h3>
        
        <div className="flex flex-col items-center justify-center gap-1.5">
          <span 
            className={`font-bold text-center ${color} transition-colors duration-300 
              ${isArrhythmiaDisplay ? 'text-[13px] leading-tight tracking-wide' : ''}
              ${isDisplayCalibrating && !isArrhythmiaDisplay ? 'text-[14px] tracking-wide' : ''}
              ${isLipidsDisplay || isPressureDisplay ? 'text-[18px] leading-tight tracking-wide' : ''}
              ${!isDisplayCalibrating && !isArrhythmiaDisplay && !isLipidsDisplay && !isPressureDisplay ? 'text-[20px] leading-tight tracking-wide' : ''}
              ${highlighted ? 'drop-shadow-glow' : ''}`}
            style={{
              textShadow: highlighted ? '0 0 8px rgba(6, 182, 212, 0.5)' : 'none'
            }}
          >
            {text}
          </span>
          
          {!isArrhythmiaDisplay && !isLipidsDisplay && !isCalibrating && unit && (
            <span className={`text-gray-400/90 text-[12px] font-medium leading-none tracking-wide ${highlighted ? 'text-cyan-400/90' : ''}`}>
              {unit}
            </span>
          )}
          
          {condition && !isCalibrating && (
            <span className={`${color} text-[12px] font-medium leading-tight mt-1 tracking-wide uppercase text-center max-w-full px-1`}>
              {condition}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VitalSign;
