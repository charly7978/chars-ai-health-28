
import React from 'react';
import MonitorButton from './MonitorButton';

interface TopControlBarProps {
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
}

const TopControlBar = ({ isMonitoring, onToggleMonitoring }: TopControlBarProps) => {
  return (
    <div className="absolute top-2 left-0 right-0 z-20 px-4">
      <div className="bg-black/70 backdrop-blur-sm rounded-xl p-2">
        <MonitorButton 
          isMonitoring={isMonitoring} 
          onClick={onToggleMonitoring} 
        />
      </div>
    </div>
  );
};

export default TopControlBar;
