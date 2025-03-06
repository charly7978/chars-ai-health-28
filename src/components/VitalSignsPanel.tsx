
import React from 'react';
import VitalSign from './VitalSign';

interface VitalSignsPanelProps {
  heartRate: number;
  vitalSigns: {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
  };
}

const VitalSignsPanel = ({ heartRate, vitalSigns }: VitalSignsPanelProps) => {
  return (
    <div className="absolute bottom-[90px] left-0 right-0 px-4">
      <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4">
          <VitalSign 
            label="FRECUENCIA CARDÍACA"
            value={heartRate || "--"}
            unit="BPM"
          />
          <VitalSign 
            label="SPO2"
            value={vitalSigns.spo2 || "--"}
            unit="%"
          />
          <VitalSign 
            label="PRESIÓN ARTERIAL"
            value={vitalSigns.pressure}
            unit="mmHg"
          />
          <VitalSign 
            label="ARRITMIAS"
            value={vitalSigns.arrhythmiaStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default VitalSignsPanel;
