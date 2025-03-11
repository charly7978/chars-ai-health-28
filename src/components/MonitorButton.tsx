
import React, { useEffect } from 'react';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onClick: () => void;
  position?: 'top' | 'bottom';
}

const MonitorButton = ({ isMonitoring, onClick, position = 'bottom' }: MonitorButtonProps) => {
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

  // Styles based on position
  const buttonClasses = position === 'top' 
    ? 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-8 py-3 rounded-full shadow-lg'
    : 'w-full h-full';

  return (
    <button 
      onClick={handleClick}
      className={`text-xl font-bold text-white transition-colors duration-200 ${
        isMonitoring 
          ? 'bg-gradient-to-b from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 active:from-red-800 active:to-red-950' 
          : 'bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 active:from-blue-800 active:to-blue-950'
      } ${buttonClasses}`}
    >
      {isMonitoring ? 'DETENER' : 'INICIAR'}
    </button>
  );
};

export default MonitorButton;
