
import React from 'react';
import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  onShare: () => void;
}

const ShareButton = ({ onShare }: ShareButtonProps) => {
  return (
    <button 
      onClick={onShare}
      className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800 flex items-center justify-center gap-2"
    >
      <Share2 className="w-6 h-6" />
      <span>COMPARTIR</span>
    </button>
  );
};

export default ShareButton;
