
import React from 'react';

interface MonitorCardiacoProps {
  heartRate: number;
  arrhythmiaStatus: string;
  arrhythmiaCount: string | number;
  isFingerDetected?: boolean; // New prop for finger detection status
}

const MonitorCardiaco: React.FC<MonitorCardiacoProps> = ({ 
  heartRate, 
  arrhythmiaStatus, 
  arrhythmiaCount, 
  isFingerDetected = true 
}) => {
  const isArrhythmia = arrhythmiaStatus.startsWith("ARRITMIA DETECTADA");
  
  // Different text color based on finger detection
  const textColorClass = isFingerDetected ? "text-white" : "text-gray-500";
  
  return (
    <div className={`monitor-card p-4 bg-gray-800 ${textColorClass} rounded-lg shadow-lg`}>
      <h2 className="text-xl font-bold mb-2">Monitor Cardíaco</h2>
      
      <div className="mb-2">
        <span className="font-medium">Frecuencia Cardíaca: </span>
        <span className={`text-2xl ${!isFingerDetected && "text-gray-400"}`}>
          {heartRate || '--'} BPM
        </span>
      </div>
      
      {isArrhythmia && isFingerDetected && (
        <div className="alert p-2 bg-red-600 rounded mb-2">
          <span className="font-bold">¡ALERTA DE ARRITMIA!</span> &nbsp;
          <span>Contador: {arrhythmiaCount}</span>
        </div>
      )}
      
      <div>
        <span className="font-medium">Estado: </span>
        <span>{isFingerDetected ? arrhythmiaStatus : "DEDO NO DETECTADO"}</span>
      </div>
    </div>
  );
};

export default MonitorCardiaco;
