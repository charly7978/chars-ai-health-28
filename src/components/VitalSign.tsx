
import React from 'react';
import { cn } from '@/lib/utils';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
  displaySize?: 'normal' | 'large' | 'xlarge';
  onDetailClick?: () => void;
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress,
  displaySize = 'normal',
  onDetailClick
}: VitalSignProps) => {
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
        case 'HEMOGLOBINA':
          if (value < 12) return 'Anemia';
          if (value > 16) return 'Policitemia';
          return '';
        case 'GLUCOSA':
          if (value > 126) return 'Hiperglucemia';
          if (value < 70) return 'Hipoglucemia';
          return '';
        default:
          return '';
      }
    }
    
    if (typeof value === 'string') {
      switch(label) {
        case 'PRESIÓN ARTERIAL':
          const pressureParts = value.split('/');
          if (pressureParts.length === 2) {
            const systolic = parseInt(pressureParts[0], 10);
            const diastolic = parseInt(pressureParts[1], 10);
            if (!isNaN(systolic) && !isNaN(diastolic)) {
              if (systolic >= 140 || diastolic >= 90) return 'Hipertensión';
              if (systolic < 90 || diastolic < 60) return 'Hipotensión';
            }
          }
          return '';
        case 'COLESTEROL/TRIGL.':
          const lipidParts = value.split('/');
          if (lipidParts.length === 2) {
            const cholesterol = parseInt(lipidParts[0], 10);
            const triglycerides = parseInt(lipidParts[1], 10);
            if (!isNaN(cholesterol)) {
              if (cholesterol > 200) return 'Hipercolesterolemia';
            }
            if (!isNaN(triglycerides)) {
              if (triglycerides > 150) return 'Hipertrigliceridemia';
            }
          }
          return '';
        case 'ARRITMIAS':
          const parts = value.split('|');
          if (parts.length === 2) {
            const status = parts[0];
            const count = parts[1];
            
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
      case 'Taquicardia':
      case 'Hipoxemia':
      case 'Hiperglucemia':
      case 'Hipertensión':
      case 'Hipercolesterolemia':
      case 'Hipertrigliceridemia':
        return 'text-[#ea384c]';
      case 'Bradicardia':
      case 'Hipoglucemia':
      case 'Hipotensión':
        return 'text-[#F97316]';
      case 'Anemia':
        return 'text-[#FEF7CD]';
      case 'Policitemia':
        return 'text-[#F2FCE2]';
      default:
        return '';
    }
  };

  const getArrhythmiaDisplay = (value: string | number) => {
    if (typeof value !== 'string') return null;
    
    const parts = value.split('|');
    if (parts.length !== 2) return null;
    
    const status = parts[0];
    const count = parts[1];
    
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

  const riskLabel = getRiskLabel(label, value);
  const riskColor = getRiskColor(riskLabel);
  const isArrhytmia = label === 'ARRITMIAS';

  // Size classes based on displaySize prop
  const labelSizeClasses = {
    'normal': 'text-[11px]',
    'large': 'text-sm',
    'xlarge': 'text-base'
  };

  const valueSizeClasses = {
    'normal': 'text-xl sm:text-2xl',
    'large': 'text-3xl sm:text-4xl',
    'xlarge': 'text-4xl sm:text-5xl'
  };

  const riskLabelSizeClasses = {
    'normal': 'text-sm',
    'large': 'text-base',
    'xlarge': 'text-lg'
  };

  return (
    <div 
      className={cn(
        "relative flex flex-col justify-center items-center p-3 bg-transparent transition-all duration-300 text-center cursor-pointer",
        highlighted && "bg-blue-500/10 rounded-lg",
        displaySize === 'large' && "p-4",
        displaySize === 'xlarge' && "p-5"
      )}
      onClick={onDetailClick}
    >
      <div className={cn(
        "font-medium uppercase tracking-wider text-white/80 mb-2",
        labelSizeClasses[displaySize]
      )}>
        {label}
      </div>
      
      <div className={cn(
        "font-bold transition-all duration-300",
        valueSizeClasses[displaySize]
      )}>
        <span className="text-white animate-value-glow">
          {isArrhytmia && typeof value === 'string' ? value.split('|')[0] : value}
        </span>
        {unit && <span className={cn(
          "text-white/70 ml-1",
          displaySize === 'normal' && "text-xs",
          displaySize === 'large' && "text-sm",
          displaySize === 'xlarge' && "text-base"
        )}>{unit}</span>}
      </div>

      {!isArrhytmia && riskLabel && (
        <div className={cn(
          `font-medium mt-1 ${riskColor}`,
          riskLabelSizeClasses[displaySize]
        )}>
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
            <span className={cn(
              "text-white/80",
              displaySize === 'normal' && "text-xs",
              displaySize === 'large' && "text-sm",
              displaySize === 'xlarge' && "text-base"
            )}>
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
