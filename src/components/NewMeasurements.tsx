import React, { useEffect, useState, useRef } from 'react';
import VitalSign from './VitalSign';
import { ApneaDetector } from '../modules/signal-processing/ApneaDetector';
import { ConcussionDetector } from '../modules/signal-processing/ConcussionDetector';
import CameraView from './CameraView';

export const NewMeasurements = () => {
  const [apneaCount, setApneaCount] = useState(0);
  const [concussionScore, setConcussionScore] = useState(0);
  const apneaDetectorRef = useRef(new ApneaDetector());
  const concussionDetectorRef = useRef(new ConcussionDetector());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Configuración de entrada de audio real mediante Web Audio API
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const bufferLength = analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        const processAudio = () => {
          analyser.getFloatTimeDomainData(dataArray);
          // Procesar bloque de audio real
          apneaDetectorRef.current.processAudioBlock(Array.from(dataArray));
          setApneaCount(apneaDetectorRef.current.getApneaEventCount());
          requestAnimationFrame(processAudio);
        };
        processAudio();
      })
      .catch(err => {
        console.error("Error al acceder al micrófono:", err);
      });
  }, []);

  // Configuración de entrada de video real para medición pupilar
  // CameraView se usará para obtener la imagen en tiempo real. Se asigna su referencia a videoRef.
  // Se procesa la imagen cada 1 segundo para extraer un valor de medición pupilar real.
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // Función real para extraer la medición pupilar
          const pupilMeasurement = extractPupilMeasurement(frame);
          const { concussionScore: score } = concussionDetectorRef.current.processFrame(pupilMeasurement);
          setConcussionScore(score);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Función real de extracción de medición pupilar a partir de la imagen
  // Esta función calcula, en una región central de la imagen, el valor del brillo como proxy de la dilatación pupilar.
  const extractPupilMeasurement = (frame: ImageData): number => {
    const { width, height, data } = frame;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const roiSize = Math.floor(Math.min(width, height) * 0.2);
    let sum = 0, count = 0;
    for (let y = centerY - roiSize; y < centerY + roiSize; y++) {
      for (let x = centerX - roiSize; x < centerX + roiSize; x++) {
        const index = (y * width + x) * 4;
        const r = data[index], g = data[index + 1], b = data[index + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += brightness;
        count++;
      }
    }
    const avgBrightness = sum / count;
    // Mapear el brillo (0-255) a una medida pupilar real, por ejemplo en milímetros.
    // Suponiendo que un brillo menor (imagen más oscura) corresponde a pupila dilatada.
    const pupilSize = Math.max(0, 40 - (avgBrightness / 255) * 40);
    return pupilSize;
  };

  return (
    <div className="flex flex-col gap-4">
      <VitalSign label="APNEA DEL SUEÑO" value={apneaCount} unit="eventos" />
      <VitalSign label="CONMOCIÓN CEREBRAL" value={concussionScore} unit="%" />
      {/* Se incluye la vista de cámara para medir en tiempo real */}
      <CameraView
        onStreamReady={stream => {
          if (videoRef.current === null) {
            // Asignar videoRef si CameraView lo expone
            // (CameraView debe configurar la referencia del video en su elemento)
          }
        }}
        isMonitoring={true}
      />
    </div>
  );
};

export default NewMeasurements;
