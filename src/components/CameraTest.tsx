import React, { useEffect, useRef, useState } from 'react';
import { AndroidCameraController } from '@/modules/camera/AndroidCameraController';

const CameraTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraController, setCameraController] = useState<AndroidCameraController | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [flashState, setFlashState] = useState<'on' | 'off'>('off');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    const controller = new AndroidCameraController();
    setCameraController(controller);
    addLog('Controlador de cámara creado');

    return () => {
      if (controller) {
        controller.stop().catch(err => {
          console.error('Error al detener la cámara:', err);
        });
        addLog('Controlador de cámara limpiado');
      }
    };
  }, []);

  const startCamera = async () => {
    if (!cameraController) return;

    try {
      addLog('Iniciando cámara...');
      const stream = await cameraController.initializeRearCamera();
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        addLog('Stream de video asignado al elemento video');
      }
      
      setIsCameraOn(true);
      addLog('Cámara iniciada correctamente');
      
      // Verificar capacidades
      const capabilities = cameraController.getDeviceCapabilities();
      addLog(`Capacidades: ${JSON.stringify(capabilities, null, 2)}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al iniciar la cámara: ${errorMessage}`);
      addLog(`ERROR: ${errorMessage}`);
      console.error(errorMessage, err);
    }
  };

  const stopCamera = async () => {
    if (!cameraController) return;
    
    try {
      addLog('Deteniendo cámara...');
      await cameraController.stop();
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setIsCameraOn(false);
      addLog('Cámara detenida correctamente');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al detener la cámara: ${errorMessage}`);
      addLog(`ERROR: ${errorMessage}`);
    }
  };

  const toggleFlash = async () => {
    if (!cameraController) return;
    
    try {
      const flashController = cameraController.enableFlashControl();
      
      if (flashState === 'off') {
        await flashController.turnOn();
        setFlashState('on');
        addLog('Linterna ENCENDIDA');
      } else {
        await flashController.turnOff();
        setFlashState('off');
        addLog('Linterna APAGADA');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al controlar la linterna: ${errorMessage}`);
      addLog(`ERROR: ${errorMessage}`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Prueba de Cámara Android</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={isCameraOn ? stopCamera : startCamera}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: isCameraOn ? '#ff4444' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isCameraOn ? 'Detener Cámara' : 'Iniciar Cámara'}
        </button>
        
        <button 
          onClick={toggleFlash}
          disabled={!isCameraOn}
          style={{
            padding: '10px 20px',
            backgroundColor: flashState === 'on' ? '#FFD700' : '#555555',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isCameraOn ? 'pointer' : 'not-allowed',
            opacity: isCameraOn ? 1 : 0.5
          }}
        >
          {flashState === 'on' ? 'Apagar Linterna' : 'Encender Linterna'}
        </button>
      </div>
      
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        maxWidth: '640px', 
        margin: '0 auto',
        border: '2px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        aspectRatio: '16/9'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            transform: 'scaleX(-1)' // Espejo para que se vea como selfie
          }}
        />
        {!isCameraOn && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            color: '#666',
            fontSize: '18px'
          }}>
            Vista previa de la cámara
          </div>
        )}
      </div>
      
      {error && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#ffebee',
          borderLeft: '4px solid #f44336',
          color: '#b71c1c'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '14px',
        whiteSpace: 'pre-wrap'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Registro:</div>
        {log.length > 0 ? (
          log.map((entry, index) => (
            <div key={index} style={{
              padding: '2px 0',
              borderBottom: '1px solid #e0e0e0',
              color: entry.startsWith('ERROR:') ? '#d32f2f' : 'inherit'
            }}>
              {entry}
            </div>
          ))
        ) : (
          <div style={{ color: '#757575' }}>No hay entradas de registro aún</div>
        )}
      </div>
    </div>
  );
};

export default CameraTest;
