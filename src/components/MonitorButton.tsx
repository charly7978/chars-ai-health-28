
import React from 'react';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onClick: () => void;
}

const MonitorButton = ({ isMonitoring, onClick }: MonitorButtonProps) => {
  return (
    <button 
      onClick={onClick}
      className={`w-full h-full text-lg font-bold shadow-md text-white transition-colors duration-200 ${
        isMonitoring 
        ? 'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800' 
        : 'bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800'
      }`}
      style={{
        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
      }}
    >
      {isMonitoring ? 'DETENER' : 'INICIAR'}
    </button>
  );
};

export default MonitorButton;
