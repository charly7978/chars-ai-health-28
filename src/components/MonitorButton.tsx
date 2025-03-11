
import React, { useEffect } from 'react';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onClick: () => void;
}

const MonitorButton = ({ isMonitoring, onClick }: MonitorButtonProps) => {
  useEffect(() => {
    console.log('MonitorButton: Estado actualizado', { isMonitoring, timestamp: new Date().toISOString() });
  }, [isMonitoring]);

  const handleClick = () => {
    console.log('MonitorButton: Botón presionado', { 
      acción: isMonitoring ? 'Detener monitoreo' : 'Iniciar monitoreo', 
      estadoActual: isMonitoring,
      timestamp: new Date().toISOString()
    });
    onClick();
  };

  return (
    <button 
      onClick={handleClick}
      className={`w-full h-full text-lg font-bold text-white transition-colors duration-200 ${
        isMonitoring 
        ? 'bg-gradient-to-b from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 active:from-red-800 active:to-red-950 border-t border-red-500/30' 
        : 'bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 active:from-blue-800 active:to-blue-950 border-t border-blue-500/30'
      }`}
    >
      {isMonitoring ? 'DETENER' : 'INICIAR'}
    </button>
  );
};

export default MonitorButton;
