
import React from 'react';

interface Peak {
  time: number;
  value: number;
  isArrhythmia: boolean;
}

interface PeakDisplayProps {
  peak: Peak;
  x: number;
  y: number;
  verticalScale: number;
  canvasWidth: number;
}

const PeakDisplay = ({ peak, x, y, verticalScale, canvasWidth }: PeakDisplayProps) => {
  if (x < 0 || x > canvasWidth) {
    return null;
  }

  return (
    <>
      <circle 
        cx={x} 
        cy={y} 
        r={5} 
        fill={peak.isArrhythmia ? '#DC2626' : '#0EA5E9'} 
      />
      
      {peak.isArrhythmia && (
        <>
          <circle 
            cx={x} 
            cy={y} 
            r={10} 
            stroke="#FEF7CD" 
            strokeWidth={3} 
            fill="none" 
          />
          
          <text 
            x={x} 
            y={y - 25} 
            textAnchor="middle" 
            fill="#F97316" 
            fontWeight="bold" 
            fontSize="12px"
            fontFamily="Inter, sans-serif"
          >
            ARRITMIA
          </text>
        </>
      )}

      <text 
        x={x} 
        y={y - 15} 
        textAnchor="middle" 
        fill="#000000" 
        fontWeight="bold" 
        fontSize="12px"
        fontFamily="Inter, sans-serif"
      >
        {Math.abs(peak.value / verticalScale).toFixed(2)}
      </text>
    </>
  );
};

export default PeakDisplay;
