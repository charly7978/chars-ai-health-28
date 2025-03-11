
import React from 'react';
import { X } from 'lucide-react';

interface VitalSignDetailProps {
  vitalSign: {
    label: string;
    value: string | number;
    unit?: string;
    info?: {
      description: string;
      normalRange: string;
      recommendation: string;
    };
  };
  onClose: () => void;
}

const VitalSignDetailDialog = ({ vitalSign, onClose }: VitalSignDetailProps) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl w-11/12 max-w-md p-5 shadow-xl transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {vitalSign.label}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-blue-400 mb-1">
            {vitalSign.value}
            {vitalSign.unit && <span className="text-lg ml-1">{vitalSign.unit}</span>}
          </div>
        </div>
        
        {vitalSign.info && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm text-gray-400 mb-1">DESCRIPCIÓN</h3>
              <p className="text-white">{vitalSign.info.description}</p>
            </div>
            
            <div>
              <h3 className="text-sm text-gray-400 mb-1">RANGO NORMAL</h3>
              <p className="text-white">{vitalSign.info.normalRange}</p>
            </div>
            
            <div>
              <h3 className="text-sm text-gray-400 mb-1">RECOMENDACIÓN</h3>
              <p className="text-white">{vitalSign.info.recommendation}</p>
            </div>
          </div>
        )}
        
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default VitalSignDetailDialog;
