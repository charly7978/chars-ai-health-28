import React, { memo } from 'react';
import { BiometricReading } from '../modules/vital-signs/VitalSignsProcessor';

interface VitalSignsDisplayProps {
  data: BiometricReading;
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
        <span className="value">{data.hr} bpm</span>
      </div>
      <div className="vital-sign-item">
        <span className="label">SpO2:</span>
        <span className="value">{data.spo2}%</span>
      </div>
      <div className="vital-sign-item">
        <span className="label">Presión Arterial:</span>
        <span className="value">{data.sbp}/{data.dbp}</span>
      </div>
      <div className="vital-sign-item">
        <span className="label">Calidad de Señal:</span>
        <span className="value">{Math.round(data.confidence * 100)}%</span>
      </div>
    </div>
  );
});

VitalSignsDisplay.displayName = 'VitalSignsDisplay';

export default VitalSignsDisplay;
