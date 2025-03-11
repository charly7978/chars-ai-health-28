
import React from 'react';
import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  onShare: () => void;
}

const ShareButton = ({ onShare }: ShareButtonProps) => {
  return (
    <button
      onClick={onShare}
      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-medium"
      aria-label="Compartir resultados"
    >
      <Share2 size={24} />
      <span>Compartir</span>
    </button>
  );
};

export default ShareButton;
