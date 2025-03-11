
import React, { useRef, useEffect, useState } from 'react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  onFrame?: (imageData: ImageData) => void;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  onFrame,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
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

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
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
      
      // Iniciar el procesamiento de frames
      startFrameProcessing();
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      setError(err instanceof Error ? err.message : "Error desconocido al iniciar la cámara");
      stopCamera();
    }
  };
  
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !onFrame) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Ajustar el tamaño del canvas al del video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    // Dibujar el frame actual en el canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Obtener los datos de la imagen para procesamiento
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onFrame(imageData);
    } catch (e) {
      console.error("Error al capturar frame:", e);
    }
  };
  
  const startFrameProcessing = () => {
    if (!onFrame) return;
    
    const processFrame = () => {
      captureFrame();
      animationRef.current = requestAnimationFrame(processFrame);
    };
    
    animationRef.current = requestAnimationFrame(processFrame);
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

  console.log("CameraView rendering - isMonitoring:", isMonitoring, "stream:", !!stream, "onFrame:", !!onFrame);

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
      <canvas 
        ref={canvasRef} 
        className="hidden" 
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
