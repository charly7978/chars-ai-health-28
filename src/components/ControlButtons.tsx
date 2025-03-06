
import React from 'react';
import MonitorButton from './MonitorButton';

interface ControlButtonsProps {
  isMonitoring: boolean;
  onMonitor: () => void;
  onReset: () => void;
}

const ControlButtons = ({ isMonitoring, onMonitor, onReset }: ControlButtonsProps) => {
  return (
    <div className="h-[70px] grid grid-cols-2 gap-px bg-gray-900 mt-auto">
      <MonitorButton 
        isMonitoring={isMonitoring}
        onClick={onMonitor}
      />
      <button 
        onClick={onReset}
        className="w-full h-full bg-gradient-to-b from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 active:from-gray-700 active:to-gray-800 text-lg font-bold shadow-md"
        style={{textShadow: '0 1px 2px rgba(0,0,0,0.2)'}}
      >
        RESETEAR
      </button>
    </div>
  );
};

export default ControlButtons;
