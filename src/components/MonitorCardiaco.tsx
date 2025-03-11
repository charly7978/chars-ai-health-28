import React from 'react';

interface MonitorCardiacoProps {
  heartRate: number;
  arrhythmiaStatus: string;
  arrhythmiaCount: string | number;
}

const MonitorCardiaco: React.FC<MonitorCardiacoProps> = ({ heartRate, arrhythmiaStatus, arrhythmiaCount }) => {
  const isArrhythmia = arrhythmiaStatus.startsWith("ARRITMIA DETECTADA");
  
  return (
    <div className="monitor-card p-4 bg-gray-800 text-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-2">Monitor Cardíaco</h2>
      
      <div className="mb-2">
        <span className="font-medium">Frecuencia Cardíaca: </span>
        <span className="text-2xl">{heartRate || '--'} BPM</span>
      </div>
      
      {isArrhythmia && (
        <div className="alert p-2 bg-red-600 rounded mb-2">
          <span className="font-bold">¡ALERTA DE ARRITMIA!</span> &nbsp;
          <span>Contador: {arrhythmiaCount}</span>
        </div>
      )}
      
      <div>
        <span className="font-medium">Estado: </span>
        <span>{arrhythmiaStatus}</span>
      </div>
    </div>
  );
};

export default MonitorCardiaco;
