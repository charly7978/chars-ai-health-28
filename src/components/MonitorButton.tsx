
import React from 'react';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onClick: () => void;
}

const MonitorButton = ({ isMonitoring, onClick }: MonitorButtonProps) => {
  return (
    <button 
      onClick={onClick}
      className={`w-full p-3 text-xl font-bold text-white rounded-md transition-colors duration-200 ${
        isMonitoring 
          ? 'bg-red-600 hover:bg-red-700 active:bg-red-800' 
          : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
      }`}
    >
      {isMonitoring ? 'DETENER' : 'INICIAR'}
    </button>
  );
};

export default MonitorButton;
