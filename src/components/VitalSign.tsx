import React from 'react';
import { motion } from 'framer-motion';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  calibrationProgress?: number;
}

const VitalSign: React.FC<VitalSignProps> = ({ 
  label, 
  value, 
  unit, 
  calibrationProgress 
}) => {
  // Determinar si estamos en calibración y el valor debe mostrarse como especial
  const isCalibrating = calibrationProgress !== undefined && calibrationProgress < 100;
  
  // Si es una cadena que contiene el formato "STATUS|NUMBER", extraer solo el STATUS
  let displayValue = value;
  if (typeof value === 'string' && value.includes('|')) {
    displayValue = value.split('|')[0];
  }
  
  // Si está calibrando y el valor es 0 o "--/--", mostrar indicador de calibración
  if (isCalibrating && (value === 0 || value === "--/--" || String(value).includes("CALIBRA"))) {
    displayValue = "···";
  }

  return (
    <div className="flex flex-col items-center p-2 relative">
      {/* Barra de progreso de calibración (visible solo durante calibración) */}
      {isCalibrating && (
        <motion.div 
          className="absolute -bottom-1 left-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600"
          initial={{ width: 0 }}
          animate={{ width: `${calibrationProgress}%` }}
          transition={{ duration: 0.5 }}
        />
      )}
      
      <span className="text-xs text-gray-400 font-semibold text-center">
        {label}
      </span>
      
      <div className="flex items-end mt-1">
        <span className={`text-xl font-bold ${isCalibrating ? 'text-blue-400' : 'text-white'}`}>
          {displayValue}
        </span>
        {unit && !String(displayValue).includes("CALIBRA") && (
          <span className="ml-1 text-xs text-gray-400">
            {unit}
          </span>
        )}
      </div>
      
      {/* Indicador de calibración */}
      {isCalibrating && (
        <span className="text-[10px] text-blue-400 absolute -bottom-3 left-0 right-0 text-center">
          Calibrando {Math.round(calibrationProgress || 0)}%
        </span>
      )}
    </div>
  );
};

export default VitalSign;
