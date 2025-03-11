import React from 'react';
import { cn } from '../lib/utils';

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
  const isHeartRateDisplay = label === "FRECUENCIA CARDÍACA";
  const isSpO2Display = label === "SPO2";

  const getDisplayContent = () => {
    if (!value || value === 0) {
      return {
        text: isLipidsDisplay || isPressureDisplay ? "--/--" : "--",
        color: "text-gold-light",
        status: ""
      };
    }
    
    if (isHeartRateDisplay) {
      const numValue = Number(value);
      if (numValue === 0) return { text: "--", color: "text-white", status: "" };
      
      if (numValue < 40) return { text: String(value), color: "text-red-500", status: "Bradicardia Severa" };
      if (numValue < 50) return { text: String(value), color: "text-orange-500", status: "Bradicardia Leve" };
      if (numValue > 150) return { text: String(value), color: "text-red-500", status: "Taquicardia Severa" };
      if (numValue > 120) return { text: String(value), color: "text-orange-500", status: "Taquicardia Leve" };
      return { text: String(value), color: "text-green-500", status: "Normal" };
    }

    if (isSpO2Display) {
      const numValue = Number(value);
      if (numValue === 0) return { text: "--", color: "text-white", status: "" };
      
      if (numValue < 80) return { text: String(value), color: "text-red-500", status: "Hipoxia Crítica" };
      if (numValue < 85) return { text: String(value), color: "text-red-400", status: "Hipoxia Severa" };
      if (numValue < 90) return { text: String(value), color: "text-orange-500", status: "Hipoxia Moderada" };
      if (numValue < 95) return { text: String(value), color: "text-yellow-500", status: "Hipoxia Leve" };
      return { text: String(value), color: "text-green-500", status: "Normal" };
    }
    
    if (isHemoglobinDisplay) {
      const numValue = Number(value);
      if (numValue === 0) return { text: "--", color: "text-white", status: "" };
      
      if (numValue < 8) return { text: String(value), color: "text-red-500", status: "Anemia Severa" };
      if (numValue < 12) return { text: String(value), color: "text-orange-500", status: "Anemia Moderada" };
      if (numValue > 18) return { text: String(value), color: "text-red-500", status: "Policitemia Severa" };
      if (numValue > 16) return { text: String(value), color: "text-yellow-500", status: "Policitemia Leve" };
      return { text: String(value), color: "text-green-500", status: "Normal" };
    }
    
    if (isGlucoseDisplay) {
      const numValue = Number(value);
      if (numValue === 0) return { text: "--", color: "text-white", status: "" };
      
      if (numValue < 40) return { text: String(value), color: "text-red-500", status: "Hipoglucemia Crítica" };
      if (numValue < 60) return { text: String(value), color: "text-red-400", status: "Hipoglucemia Severa" };
      if (numValue < 70) return { text: String(value), color: "text-orange-500", status: "Hipoglucemia Leve" };
      
      if (numValue > 600) return { text: String(value), color: "text-red-800", status: "Hiperglucemia Extrema" };
      if (numValue > 400) return { text: String(value), color: "text-red-500", status: "Hiperglucemia Crítica" };
      if (numValue > 300) return { text: String(value), color: "text-red-400", status: "Hiperglucemia Grave" };
      if (numValue > 200) return { text: String(value), color: "text-orange-500", status: "Hiperglucemia Moderada" };
      if (numValue > 140) return { text: String(value), color: "text-yellow-500", status: "Hiperglucemia Leve" };
      
      return { text: String(value), color: "text-green-500", status: "Normal" };
    }
    
    if (isLipidsDisplay) {
      if (value === "0/0" || value === "--/--") {
        return { text: "--/--", color: "text-white", status: "" };
      }
      
      const [cholesterol, triglycerides] = String(value).split('/').map(Number);
      let color = "text-green-500";
      let status = "Normal";
      
      if (cholesterol > 240 || triglycerides > 500) {
        color = "text-red-500";
        status = "Crítico";
      } else if (cholesterol > 200 || triglycerides > 200) {
        color = "text-orange-500";
        status = "Alto";
      } else if (cholesterol > 180 || triglycerides > 150) {
        color = "text-yellow-500";
        status = "Límite";
      }
      
      return { text: String(value), color, status };
    }
    
    if (isPressureDisplay) {
      if (value === "--/--") {
        return { text: "--/--", color: "text-white", status: "" };
      }
      
      const [systolic, diastolic] = String(value).split('/').map(Number);
      
      if (systolic >= 180 || diastolic >= 120) {
        return { text: String(value), color: "text-red-500", status: "Crisis Hipertensiva" };
      } else if (systolic >= 160 || diastolic >= 100) {
        return { text: String(value), color: "text-red-400", status: "Hipertensión Severa" };
      } else if (systolic >= 140 || diastolic >= 90) {
        return { text: String(value), color: "text-orange-500", status: "Hipertensión Leve" };
      } else if (systolic >= 120 || diastolic >= 80) {
        return { text: String(value), color: "text-yellow-500", status: "Prehipertensión" };
      } else if (systolic < 90 || diastolic < 60) {
        return { text: String(value), color: "text-blue-500", status: "Hipotensión" };
      }
      
      return { text: String(value), color: "text-green-500", status: "Normal" };
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
          color: "text-red-500 animate-pulse",
          status: "Requiere atención"
        };
      }
      
      if (status === "CALIBRANDO...") {
        return {
          text: status,
          color: "text-yellow-500",
          status: "En proceso"
        };
      }
      
      const noArrhythmiaCount = count ? `(${count})` : "";
      return {
        text: `RITMO NORMAL ${noArrhythmiaCount}`.trim(),
        color: "text-cyan-500",
        status: "Estable"
      };
    }
    
    return {
      text: value,
      color: "text-gold-light",
      status: ""
    };
  };

  const { text, color, status } = getDisplayContent();

  return (
    <div className="vital-sign-panel flex flex-col h-full bg-opacity-50">
      <div className="flex flex-col items-center justify-center flex-1 gap-2 p-2">
        <h3 className="text-gold-medium text-[12px] font-medium text-center w-full leading-tight tracking-tight break-words px-1 min-h-[32px] flex items-center justify-center">
          {label}
        </h3>
        
        <div className="flex flex-col items-center justify-center gap-1.5 flex-1 py-1">
          <div className={cn(
            "flex items-center justify-center gap-1 transition-all duration-300",
            isArrhythmiaDisplay && "relative"
          )}>
            <span 
              className={cn(
                "font-bold transition-colors duration-300",
                color,
                isArrhythmiaDisplay ? 'text-[15px]' : '',
                isLipidsDisplay || isPressureDisplay ? 'text-[18px]' : '',
                !isArrhythmiaDisplay && !isLipidsDisplay && !isPressureDisplay ? 'text-[24px]' : '',
                isArrhythmiaDisplay && typeof text === 'string' && text.includes('ARRITMIA') && 'relative after:absolute after:inset-0 after:bg-red-500/10 after:animate-pulse after:rounded-full'
              )}
            >
              {text}
            </span>
            
            {!isArrhythmiaDisplay && !isLipidsDisplay && unit && (
              <span className="text-gold-medium/90 text-[13px] font-medium">
                {unit}
              </span>
            )}
          </div>
          
          {status && (
            <span className={cn(
              "text-[12px] font-medium text-center mt-0.5 transition-all duration-300",
              color,
              isArrhythmiaDisplay && typeof text === 'string' && text.includes('ARRITMIA') && 'animate-pulse'
            )}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VitalSign;
