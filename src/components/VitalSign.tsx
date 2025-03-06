
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number; // Add calibration progress prop
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
    // Si está calibrando, mostrar estado de calibración
    if (isCalibrating) {
      return {
        text: `CALIBRANDO ${Math.round(calibrationProgress)}%`,
        color: "text-yellow-500"
      };
    }
    
    // Para arritmias
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
    
    // Para niveles de glucosa
    if (isGlucoseDisplay) {
      const numValue = Number(value);
      
      if (value === "--" || numValue === 0) {
        return {
          text: "--",
          color: "text-white"
        };
      }
      
      // Interpretación según criterios médicos
      if (numValue < 70) {
        return {
          text: String(value),
          color: "text-orange-500"  // Hipoglucemia - naranja
        };
      } else if (numValue > 140) {
        return {
          text: String(value),
          color: "text-red-500"     // Hiperglucemia - rojo
        };
      } else {
        return {
          text: String(value),
          color: "text-green-500"   // Normal - verde
        };
      }
    }
    
    // Para el perfil lipídico
    if (isLipidsDisplay) {
      if (value === "--" || value === "0/0" || value === "--/--") {
        return {
          text: "--/--",
          color: "text-white"
        };
      }
      
      // Analizar colesterol y triglicéridos
      const [cholesterol, triglycerides] = String(value).split('/').map(Number);
      
      // Determinar el color basado en el colesterol total
      let color = "text-white";
      if (cholesterol > 200) {
        color = "text-red-500";     // Alto - rojo
      } else if (cholesterol > 180) {
        color = "text-yellow-500";  // Límite - amarillo
      } else if (cholesterol > 0) {
        color = "text-green-500";   // Normal - verde
      }
      
      return {
        text: String(value),
        color
      };
    }
    
    // Para todas las demás mediciones
    return {
      text: value,
      color: "text-white"
    };
  };

  const { text, color } = getDisplayContent();

  return (
    <div className={`relative overflow-hidden group bg-black backdrop-blur-md rounded-lg p-4 py-8 transition-all duration-300 ${
      highlighted ? 'from-black to-black' : ''
    }`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[progress_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Barra de calibración */}
      {isCalibrating && (
        <div className="absolute bottom-0 left-0 h-1 bg-yellow-500" style={{ width: `${calibrationProgress}%` }}></div>
      )}
      
      <h3 className={`text-white text-sm text-center pt-1 mb-2 truncate ${highlighted ? 'text-cyan-400/90' : ''}`}>{label}</h3>
      <div className="flex items-baseline gap-1 justify-center min-h-[45px]">
        <span 
          className={`${isArrhythmiaDisplay ? 'text-sm' : isLipidsDisplay ? 'text-lg' : isPressureDisplay ? 'text-lg' : 'text-2xl'} font-bold truncate ${color} transition-colors duration-300 ${
            highlighted ? 'drop-shadow-glow' : ''
          }`}
          style={{
            textShadow: highlighted ? '0 0 8px rgba(6, 182, 212, 0.5)' : 'none'
          }}
        >
          {text}
        </span>
        {!isArrhythmiaDisplay && !isLipidsDisplay && !isCalibrating && unit && (
          <span className={`text-gray-400/90 text-sm ${highlighted ? 'text-cyan-400/90' : ''}`}>{unit}</span>
        )}
      </div>
    </div>
  );
};

export default VitalSign;
