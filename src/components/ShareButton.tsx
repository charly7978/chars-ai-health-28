
import React from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareButtonProps {
  onShare: () => void;
}

const ShareButton = ({ onShare }: ShareButtonProps) => {
  const handleShare = async () => {
    try {
      onShare();
    } catch (error) {
      console.error("Error al compartir:", error);
      toast.error("No se pudo compartir la información");
    }
  };

  return (
    <button 
      onClick={handleShare}
      className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800 flex items-center justify-center gap-2"
    >
      <Share2 className="w-6 h-6" />
      <span>COMPARTIR</span>
    </button>
  );
};

export default ShareButton;
