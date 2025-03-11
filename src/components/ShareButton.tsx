
import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const ShareButton: React.FC = () => {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    try {
      setIsSharing(true);
      
      // Usar la API Web Share si está disponible
      if (navigator.share) {
        await navigator.share({
          title: 'Biochars - Monitor Cardíaco',
          text: 'Revisar mi ritmo cardíaco con esta aplicación',
          url: window.location.href,
        });
        toast({
          title: "Compartido con éxito",
          description: "El enlace ha sido compartido correctamente",
          duration: 3000,
        });
      } else {
        // Fallback para navegadores que no soportan Web Share API
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Enlace copiado",
          description: "El enlace ha sido copiado al portapapeles",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error al compartir:', error);
      toast({
        title: "Error al compartir",
        description: "No se pudo compartir el enlace",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      onClick={handleShare}
      disabled={isSharing}
      variant="share"
      size="share"
      className="fixed bottom-4 right-4 z-50"
      aria-label="Compartir aplicación"
      title="Compartir aplicación"
    >
      <Share2 className="w-5 h-5" />
    </Button>
  );
};

export default ShareButton;
