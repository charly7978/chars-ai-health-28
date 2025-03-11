
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

  // Colores muy claros y definidos para asegurar que el cambio sea notable
  return (
    <button 
      onClick={handleClick}
      className={`w-full h-full text-xl font-bold shadow-md text-white transition-colors duration-200 ${
        isMonitoring 
        ? 'bg-red-600 hover:bg-red-700 active:bg-red-800' // Rojo para DETENER
        : 'bg-green-600 hover:bg-green-700 active:bg-green-800' // Verde para INICIAR
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
