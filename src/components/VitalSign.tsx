import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress 
}: VitalSignProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const getRiskLabel = (label: string, value: string | number) => {
    if (typeof value === 'number') {
      switch(label) {
        case 'FRECUENCIA CARDÍACA':
          if (value > 100) return 'Taquicardia';
          if (value < 60) return 'Bradicardia';
          return '';
        case 'SPO2':
          if (value < 95) return 'Hipoxemia';
          return '';
        case 'APNEA DEL SUEÑO':
          if (typeof value === 'boolean') {
            return value ? 'Detectada' : 'Normal';
          }
          if (typeof value === 'number' && value > 0) {
            return 'Detectada';
          }
          return 'Normal';
        case 'CONMOCIÓN CEREBRAL':
          if (value >= 30) return 'Riesgo Alto';
          if (value >= 20) return 'Riesgo Moderado';
          if (value > 10) return 'Riesgo Bajo';
          return 'Normal';
        default:
          return '';
      }
    }
    
    if (typeof value === 'string') {
      switch(label) {
        case 'PRESIÓN ARTERIAL':
          const pressureData = value.split('/');
          if (pressureData.length === 2) {
            const systolic = parseInt(pressureData[0], 10);
            const diastolic = parseInt(pressureData[1], 10);
            if (!isNaN(systolic) && !isNaN(diastolic)) {
              if (systolic >= 140 || diastolic >= 90) return 'Hipertensión';
              if (systolic < 90 || diastolic < 60) return 'Hipotensión';
            }
          }
          return '';
        case 'ARRITMIAS':
          const arrhythmiaData = value.split('|');
          if (arrhythmiaData.length === 2) {
            const status = arrhythmiaData[0];
            const count = arrhythmiaData[1];
            
            if (status === "ARRITMIA DETECTADA" && parseInt(count) > 1) {
              return `Arritmias: ${count}`;
            } else if (status === "SIN ARRITMIAS") {
              return 'Normal';
            } else if (status === "CALIBRANDO...") {
              return 'Calibrando';
            }
          }
          return '';
        default:
          return '';
      }
    }
    
    return '';
  };

  const getRiskColor = (riskLabel: string) => {
    switch(riskLabel) {
      case 'Detectada':
      case 'Riesgo Alto':
        return 'text-[#ea384c]';
      case 'Riesgo Moderado':
        return 'text-[#F97316]';
      case 'Riesgo Bajo':
        return 'text-[#FCD34D]';
      case 'Taquicardia':
      case 'Hipoxemia':
        return 'text-[#ea384c]';
      case 'Bradicardia':
      case 'Hipotensión':
        return 'text-[#F97316]';
      case 'Normal':
        return 'text-green-500';
      default:
        return '';
    }
  };

  const getArrhythmiaDisplay = (value: string | number) => {
    if (typeof value !== 'string') return null;
    
    const arrhythmiaData = value.split('|');
    if (arrhythmiaData.length !== 2) return null;
    
    const [status, count] = arrhythmiaData;
    
    if (status === "ARRITMIA DETECTADA" && parseInt(count) > 1) {
      return (
        <div className="text-xl font-medium mt-2 text-[#ea384c]">
          Arritmias: {count}
        </div>
      );
    } else if (status === "SIN ARRITMIAS") {
      return (
        <div className="text-sm font-medium mt-2 text-green-500">
          Normal
        </div>
      );
    } else if (status === "CALIBRANDO...") {
      return (
        <div className="text-sm font-medium mt-2 text-blue-400">
          Calibrando...
        </div>
      );
    }
    
    return null;
  };

  const getMedianAndAverageInfo = (label: string, value: string | number) => {
    if (typeof value === 'number') {
      switch(label) {
        case 'FRECUENCIA CARDÍACA':
          return {
            median: "75",
            average: "72",
            interpretation: value > 100 
              ? "Su frecuencia está por encima del rango normal (60-100 BPM)."
              : value < 60 
                ? "Su frecuencia está por debajo del rango normal (60-100 BPM)."
                : "Su frecuencia está dentro del rango normal (60-100 BPM)."
          };
        case 'APNEA DEL SUEÑO':
          return {
            median: "0-5",
            average: "2-3",
            interpretation: value > 5 
              ? "Número elevado de eventos de apnea detectados. Se recomienda consulta médica."
              : value > 0
                ? "Se detectaron algunos eventos de apnea. Monitoree su condición."
                : "No se detectaron eventos significativos de apnea."
          };
        case 'CONMOCIÓN CEREBRAL':
          return {
            median: "5-15",
            average: "10",
            interpretation: value >= 30 
              ? "Respuesta pupilar severamente alterada. Busque atención médica inmediata."
              : value >= 20
                ? "Respuesta pupilar moderadamente alterada. Se recomienda evaluación médica."
                : "Respuesta pupilar dentro de rangos normales."
          };
        default:
          return null;
      }
    }
    return null;
  };

  const riskLabel = getRiskLabel(label, value);
  const riskColor = getRiskColor(riskLabel);
  const isArrhytmia = label === 'ARRITMIAS';
  const medianAndAverage = getMedianAndAverageInfo(label, value);

  const handleClick = () => {
    setShowDetails(!showDetails);
  };

  return (
    <div 
      className={cn(
        "relative flex flex-col justify-center items-center p-2 bg-transparent transition-all duration-500 text-center cursor-pointer",
        highlighted && "animate-pulse",
        showDetails && "bg-gray-800/20 backdrop-blur-sm rounded-lg"
      )}
      onClick={handleClick}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-black/70 mb-1">
        {label}
      </div>
      
      <div className="font-bold text-xl sm:text-2xl transition-all duration-300">
        <span className="text-gradient-soft animate-value-glow">
          {isArrhytmia && typeof value === 'string' ? value.split('|')[0] : value}
        </span>
        {unit && <span className="text-xs text-white/70 ml-1">{unit}</span>}
      </div>

      {!isArrhytmia && riskLabel && (
        <div className={`text-sm font-medium mt-1 ${riskColor}`}>
          {riskLabel}
        </div>
      )}
      
      {isArrhytmia && getArrhythmiaDisplay(value)}
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 bg-transparent overflow-hidden pointer-events-none border-0">
          <div 
            className="h-full bg-blue-500/5 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-white/80">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}

      {showDetails && medianAndAverage && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 p-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg text-left">
          <div className="text-sm font-medium text-gray-900 mb-2">Información adicional:</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-xs">
              <span className="font-medium">Rango normal:</span> {medianAndAverage.median} {unit}
            </div>
            <div className="text-xs">
              <span className="font-medium">Promedio típico:</span> {medianAndAverage.average} {unit}
            </div>
          </div>
          <div className="text-xs mt-1 text-gray-800">
            {medianAndAverage.interpretation}
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
