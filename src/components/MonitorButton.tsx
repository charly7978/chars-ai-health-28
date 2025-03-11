import React from 'react';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onToggle: () => void;
}

const MonitorButton: React.FC<MonitorButtonProps> = ({ isMonitoring, onToggle }) => {
  return (
    <button 
      onClick={onToggle} 
      className={`px-4 py-2 rounded transition-colors duration-300 ${isMonitoring ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
    >
      {isMonitoring ? 'Detener' : 'Iniciar'}
    </button>
  );
};

export default MonitorButton;
