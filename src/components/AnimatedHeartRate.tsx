
import React, { useEffect, useRef, useState } from 'react';

interface AnimatedHeartRateProps {
  bpm: number;
  isPulsing?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AnimatedHeartRate = ({ bpm, isPulsing = false, size = 'md' }: AnimatedHeartRateProps) => {
  const [isBeating, setIsBeating] = useState(false);
  const beatTimeoutRef = useRef<number | null>(null);
  
  // Size classes optimizadas
  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-28 h-28",
    lg: "w-36 h-36"
  };
  
  const textSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  };

  useEffect(() => {
    // MEJORA 2025: Detección a cualquier BPM > 0 para máxima sensibilidad visual
    if (isPulsing && bpm > 0) {
      const beatInterval = 60000 / Math.max(30, bpm); // Garantizar intervalo razonable
      
      const startBeatAnimation = () => {
        setIsBeating(true);
        
        // Duración de animación más rápida para mejor feedback
        const animationDuration = Math.max(150, Math.min(300, 400 - bpm * 1.5));
        
        // Reset beat animation after dynamic duration
        setTimeout(() => {
          setIsBeating(false);
        }, animationDuration);
        
        // Schedule next beat
        beatTimeoutRef.current = window.setTimeout(startBeatAnimation, beatInterval);
      };
      
      // Start initial beat animation
      startBeatAnimation();
    }
    
    return () => {
      // Clean up timeout on unmount
      if (beatTimeoutRef.current) {
        clearTimeout(beatTimeoutRef.current);
      }
    };
  }, [bpm, isPulsing]);
  
  return (
    <div className="relative">
      <div className={`relative ${sizeClasses[size]} mx-auto`}>
        {/* Heart SVG con animación mejorada */}
        <svg 
          viewBox="0 0 32 32" 
          fill="currentColor"
          className={`absolute inset-0 w-full h-full text-red-500 transition-transform duration-300 ${
            isBeating ? 'scale-130 text-red-600' : 'scale-100'
          }`}
        >
          <path d="M16,28.261c0,0-14-7.926-14-17.046c0-5.356,3.825-9.115,9.167-9.115c4.243,0,6.557,2.815,6.557,2.815 s2.314-2.815,6.557-2.815c5.342,0,9.166,3.759,9.166,9.115C33.338,20.335,16,28.261,16,28.261z"/>
        </svg>
        
        {/* BPM display con mejor transición y valor mínimo "0" */}
        <div className={`absolute inset-0 flex items-center justify-center ${
          isBeating ? 'scale-110' : 'scale-100'
        } transition-transform duration-300`}>
          <div className="text-center">
            <span className={`${textSizes[size]} font-bold text-white`}>
              {bpm > 0 ? bpm : '0'}
            </span>
            <span className="text-xs block text-white/80 font-medium -mt-1">
              BPM
            </span>
          </div>
        </div>
      </div>
      
      {/* Pulse visualization mejorada con mayor amplitud y sensibilidad */}
      {isPulsing && bpm > 0 && (
        <div className="absolute -bottom-6 left-0 right-0 flex justify-center mt-2">
          <div className="relative h-8 w-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 right-0 flex items-center">
              <svg viewBox="0 0 100 20" className="w-full">
                <path
                  fill="none" 
                  stroke="#ef4444" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  d={`M 0,10 
                      Q 12.5,10 25,10 
                      T 37.5,${isBeating ? '0' : '10'} 
                      T 50,${isBeating ? '20' : '10'} 
                      T 62.5,${isBeating ? '0' : '10'} 
                      T 75,10 
                      T 100,10`}
                  className="transition-all duration-200"
                />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimatedHeartRate;
