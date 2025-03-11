
import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const ShareButton: React.FC = () => {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    try {
      setIsSharing(true);
      
      // Validar si estamos en un contexto seguro
      const isSecureContext = window.isSecureContext;
      
      // Usar la API Web Share solo si está disponible y estamos en un contexto seguro
      if (navigator.share && isSecureContext) {
        try {
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
          return; // Terminar si fue exitoso
        } catch (shareError) {
          console.log("Web Share API falló, usando clipboard:", shareError);
          // Continúa al método de portapapeles si falla el Web Share API
        }
      }
      
      // Fallback: siempre usar portapapeles si Web Share no está disponible o falló
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Enlace copiado",
          description: "El enlace ha sido copiado al portapapeles",
          duration: 3000,
        });
      } catch (clipboardError) {
        console.error('Error al copiar al portapapeles:', clipboardError);
        toast({
          title: "Error al compartir",
          description: "No se pudo copiar el enlace. Intente copiar la URL manualmente.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error general al compartir:', error);
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
