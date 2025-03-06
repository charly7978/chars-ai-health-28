import React from 'react';

interface MeasurementButtonProps {
  isMonitoring: boolean;
  onClick: () => void;
}

const MeasurementButton = ({ isMonitoring, onClick }: MeasurementButtonProps) => {
  return (
    <button 
      onClick={onClick}
      className={`w-full h-full text-xl font-extrabold shadow-lg text-white transition-colors duration-300 ${
        isMonitoring 
        ? 'bg-gradient-to-b from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 active:from-red-800 active:to-red-950' 
        : 'bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 active:from-blue-800 active:to-blue-950'
      }`}
      style={{
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}
    >
      {isMonitoring ? '⚠️ DETENER MEDICION ⚠️' : '✅ INICIAR MEDICION ✅'}
    </button>
  );
};

export default MeasurementButton; 