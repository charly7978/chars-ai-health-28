import React, { useRef, useEffect, useState } from 'react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = async () => {
    console.log("Deteniendo cámara...");
    if (stream) {
      stream.getTracks().forEach(track => {
        if (track.kind === 'video' && track.getCapabilities()?.torch) {
          console.log("Desactivando linterna...");
          track.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => console.error("Error desactivando linterna:", err));
        }
        track.stop();
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      console.log("Cámara detenida correctamente");
    }
  };

  const startCamera = async () => {
    try {
      console.log("Iniciando cámara...");
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado en este dispositivo");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };

      console.log("Solicitando permisos de cámara...");
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Permisos de cámara concedidos");

      const videoTrack = newStream.getVideoTracks()[0];
      console.log("Configuración de la cámara:", videoTrack.getSettings());

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Esperar a que el video esté realmente listo
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log("Video metadata cargada");
              resolve(true);
            };
          }
        });

        // Intentar reproducir el video
        try {
          await videoRef.current.play();
          console.log("Video reproduciendo correctamente");
        } catch (playError) {
          console.error("Error al reproducir el video:", playError);
          throw new Error("No se pudo iniciar la reproducción del video");
        }
      }

      setStream(newStream);
      
      // Activar la linterna después de un breve retraso
      setTimeout(async () => {
        if (videoTrack.getCapabilities()?.torch) {
          console.log("Activando linterna...");
          try {
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
            console.log("Linterna activada correctamente");
          } catch (torchError) {
            console.error("Error al activar la linterna:", torchError);
          }
        } else {
          console.log("Este dispositivo no tiene linterna");
        }
      }, 500);

      if (onStreamReady) {
        onStreamReady(newStream);
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      setError(err instanceof Error ? err.message : "Error desconocido al iniciar la cámara");
      stopCamera();
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Iniciando cámara (isMonitoring=true)");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Deteniendo cámara (isMonitoring=false)");
      stopCamera();
    }
    
    return () => {
      console.log("Componente CameraView desmontándose");
      stopCamera();
    };
  }, [isMonitoring]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      />
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-2 rounded shadow">
          {error}
        </div>
      )}
    </>
  );
};

export default CameraView;
