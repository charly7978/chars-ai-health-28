import React from 'react';
import { motion } from 'framer-motion';

interface CalibrationIndicatorProps {
  isCalibrating: boolean;
  progress?: {
    heartRate?: number;
    spo2?: number;
    pressure?: number;
    arrhythmia?: number;
    glucose?: number;
    lipids?: number;
    hemoglobin?: number;
  };
  message?: string;
}

const CalibrationIndicator: React.FC<CalibrationIndicatorProps> = ({ 
  isCalibrating, 
  progress = {}, 
  message 
}) => {
  if (!isCalibrating) return null;

  // Calcular el progreso promedio
  const values = Object.values(progress).filter(val => typeof val === 'number') as number[];
  const averageProgress = values.length > 0 
    ? Math.round(values.reduce((acc, val) => acc + val, 0) / values.length) 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-gray-900/80 p-6 rounded-2xl max-w-md w-full mx-4 shadow-xl border border-gray-800">
        <h2 className="text-xl font-bold text-white text-center mb-4">
          Calibrando Sistema
        </h2>
        
        {message && (
          <p className="text-gray-300 text-center mb-6">{message}</p>
        )}
        
        <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden mb-3">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-purple-600"
            initial={{ width: '0%' }}
            animate={{ width: `${averageProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        <p className="text-gray-400 text-center">
          Progreso: {averageProgress}%
        </p>
        
        <div className="mt-8 space-y-3">
          {Object.entries(progress).map(([key, value]) => {
            if (typeof value !== 'number') return null;
            // Convertir camelCase a texto legible
            const label = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
              
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">{label}</span>
                <div className="flex-1 mx-3">
                  <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="absolute top-0 left-0 h-full bg-blue-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                <span className="text-gray-300 text-sm w-8 text-right">{value}%</span>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Por favor mantenga su dedo en posición durante la calibración...
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default CalibrationIndicator; 