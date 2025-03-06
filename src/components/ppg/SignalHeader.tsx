
import React from 'react';
import { Fingerprint } from 'lucide-react';
import SignalQualityBar from './SignalQualityBar';

interface SignalHeaderProps {
  quality: number;
  isFingerDetected: boolean;
}

const SignalHeader = ({ quality, isFingerDetected }: SignalHeaderProps) => {
  return (
    <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-white/60 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-slate-700">PPG</span>
        <SignalQualityBar quality={quality} isFingerDetected={isFingerDetected} />
      </div>

      <div className="flex flex-col items-center">
        <Fingerprint
          className={`h-8 w-8 transition-colors duration-300 ${
            !isFingerDetected ? 'text-gray-400' :
            quality > 75 ? 'text-green-500' :
            quality > 50 ? 'text-yellow-500' :
            'text-red-500'
          }`}
          strokeWidth={1.5}
        />
        <span className="text-[8px] text-center font-medium text-slate-600">
          {isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}
        </span>
      </div>
    </div>
  );
};

export default SignalHeader;
