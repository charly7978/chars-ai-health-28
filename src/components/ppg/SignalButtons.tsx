
import React from 'react';
import { Play, Square, Heart } from 'lucide-react';

interface SignalButtonsProps {
  onStartMeasurement: () => void;
  onReset: () => void;
}

const SignalButtons = ({ onStartMeasurement, onReset }: SignalButtonsProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[70px] grid grid-cols-2 gap-px bg-gray-100">
      <button 
        onClick={onStartMeasurement}
        className="bg-gradient-to-b from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800 transition-colors duration-200 shadow-md flex items-center justify-center gap-2"
      >
        <Play className="h-5 w-5" />
        <span className="text-base font-semibold">
          INICIAR/DETENER
        </span>
      </button>

      <button 
        onClick={onReset}
        className="bg-gradient-to-b from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700 active:from-gray-700 active:to-gray-800 transition-colors duration-200 shadow-md flex items-center justify-center gap-2"
      >
        <Square className="h-5 w-5" />
        <span className="text-base font-semibold">
          RESETEAR
        </span>
      </button>
    </div>
  );
};

export default SignalButtons;
