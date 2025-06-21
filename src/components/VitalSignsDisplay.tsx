import React, { memo } from 'react';
import { VitalSigns } from '../types';

interface VitalSignsDisplayProps {
  data: VitalSigns;
  loading?: boolean;
}

const VitalSignsDisplay = memo(({ data, loading }: VitalSignsDisplayProps) => {
  if (loading) {
    return (
      <div className="vital-signs-loading">
        <p>Procesando datos...</p>
      </div>
    );
  }

  return (
    <div className="vital-signs-container">
      <div className="vital-sign-item">
        <span className="label">Frecuencia Cardíaca:</span>
        <span className="value">{data.heartRate} bpm</span>
      </div>
      <div className="vital-sign-item">
        <span className="label">SpO2:</span>
        <span className="value">{data.spo2}%</span>
      </div>
      <div className="vital-sign-item">
        <span className="label">Presión Arterial:</span>
        <span className="value">{data.bloodPressure.systolic}/{data.bloodPressure.diastolic}</span>
      </div>
      <div className="vital-sign-item">
        <span className="label">Calidad de Señal:</span>
        <span className="value">{data.signalQuality}%</span>
      </div>
    </div>
  );
});

VitalSignsDisplay.displayName = 'VitalSignsDisplay';

export default VitalSignsDisplay;
