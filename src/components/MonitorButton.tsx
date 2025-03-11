
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
      className={`w-full h-full text-lg font-bold shadow-md text-white transition-colors duration-200 ${
        isMonitoring 
        ? 'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800' 
        : 'bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800'
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
