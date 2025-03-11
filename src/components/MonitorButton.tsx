
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
      className={`w-full h-full text-xl font-bold text-white transition-all duration-300 ${
        isMonitoring 
        ? 'bg-gradient-to-b from-red-500 to-red-600' 
        : 'bg-gradient-to-b from-green-500 to-green-600'
      }`}
      style={{
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        borderRadius: '0',
        border: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
      }}
    >
      {isMonitoring ? 'DETENER' : 'INICIAR'}
    </button>
  );
};

export default MonitorButton;
