
import React from 'react';

interface TimerDisplayProps {
  elapsedTime: number;
  isMonitoring: boolean;
}

const TimerDisplay = ({ elapsedTime, isMonitoring }: TimerDisplayProps) => {
  if (!isMonitoring) return null;
  
  return (
    <div className="absolute bottom-16 left-0 right-0 text-center">
      <span className="text-xl font-medium text-gray-300">{elapsedTime}s / 30s</span>
    </div>
  );
};

export default TimerDisplay;
