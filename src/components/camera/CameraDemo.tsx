/**
 * Componente de demostración para AndroidCameraController
 * Permite probar todas las funcionalidades de la cámara trasera
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAndroidCamera } from '../../hooks/useAndroidCamera';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Flashlight, FlashlightOff, Camera, Settings, Zap } from 'lucide-react';

export const CameraDemo: React.FC = () => {
  const {
    isInitialized,
    isInitializing,
    mediaStream,
    error,
    settings,
    capabilities,
    flashSupported,
    flashState,
    initialize,
    stop,
    setFrameRate,
    enableStabilization,
    captureFrame,
    toggleFlash
  } = useAndroidCamera();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedFrames, setCapturedFrames] = useState<number>(0);
  const [frameRate, setFrameRateState] = useState<number>(60);
  
  // Configurar video stream cuando esté disponible
  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);
  
  // Handlers
  const handleInitialize = async () => {
    try {
      await initialize();
    } catch (err) {
      console.error('Error inicializando cámara:', err);
    }
  };
  
  const handleStop = async () => {
    try {
      await stop();
      setCapturedFrames(0);
    } catch (err) {
      console.error('Error deteniendo cámara:', err);
    }
  };
  
  const handleFrameRateChange = async (fps: number) => {
    try {
      await setFrameRate(fps);
      setFrameRateState(fps);
    } catch (err) {
      console.error('Error configurando frame rate:', err);
    }
  };
  
  const handleCaptureFrame = () => {
    const imageData = captureFrame();
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = imageData.width;
        canvasRef.current.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
        setCapturedFrames(prev => prev + 1);
      }
    }
  };
  
  const handleToggleFlash = async () => {
    try {
      await toggleFlash();
    } catch (err) {
      console.error('Error alternando flash:', err);
    }
  };
  
  const handleEnableStabilization = async () => {
    try {
      await enableStabilization();
    } catch (err) {
      console.error('Error habilitando estabilización:', err);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            AndroidCameraController Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado de la cámara */}
          <div className="flex items-center gap-2">
            <Badge variant={isInitialized ? "default" : "secondary"}>
              {isInitialized ? "Inicializada" : "No inicializada"}
            </Badge>
            {isInitializing && (
              <Badge variant="outline">Inicializando...</Badge>
            )}
            {flashSupported && (
              <Badge variant={flashState === 'on' ? "default" : "outline"}>
                Flash {flashState === 'on' ? 'Encendido' : 'Apagado'}
              </Badge>
            )}
          </div>
          
          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Controles principales */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleInitialize} 
              disabled={isInitialized || isInitializing}
              className="flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Inicializar Cámara
            </Button>
            
            <Button 
              onClick={handleStop} 
              disabled={!isInitialized}
              variant="outline"
            >
              Detener Cámara
            </Button>
            
            {flashSupported && (
              <Button 
                onClick={handleToggleFlash} 
                disabled={!isInitialized}
                variant="outline"
                className="flex items-center gap-2"
              >
                {flashState === 'on' ? (
                  <FlashlightOff className="w-4 h-4" />
                ) : (
                  <Flashlight className="w-4 h-4" />
                )}
                {flashState === 'on' ? 'Apagar Flash' : 'Encender Flash'}
              </Button>
            )}
            
            <Button 
              onClick={handleEnableStabilization} 
              disabled={!isInitialized}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Estabilización
            </Button>
          </div>
          
          {/* Controles de frame rate */}
          {isInitialized && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Frame Rate:</label>
              <div className="flex gap-2">
                {[30, 60, 120].map(fps => (
                  <Button
                    key={fps}
                    onClick={() => handleFrameRateChange(fps)}
                    variant={frameRate === fps ? "default" : "outline"}
                    size="sm"
                  >
                    {fps} fps
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Video y captura */}
      {isInitialized && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Video en vivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Video en Vivo</CardTitle>
            </CardHeader>
            <CardContent>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-auto bg-black rounded-lg"
                style={{ maxHeight: '300px' }}
              />
              <div className="mt-2 space-y-1">
                <Button 
                  onClick={handleCaptureFrame}
                  className="w-full"
                >
                  Capturar Frame ({capturedFrames})
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Frame capturado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Último Frame Capturado</CardTitle>
            </CardHeader>
            <CardContent>
              <canvas
                ref={canvasRef}
                className="w-full h-auto bg-gray-100 rounded-lg"
                style={{ maxHeight: '300px' }}
              />
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Información técnica */}
      {(settings || capabilities) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configuraciones actuales */}
          {settings && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-4 h-4" />
                  Configuraciones Actuales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Resolución:</span>
                    <span>{settings.resolution.width}x{settings.resolution.height}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frame Rate:</span>
                    <span>{settings.frameRate} fps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Espacio de Color:</span>
                    <span>{settings.colorSpace}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balance de Blancos:</span>
                    <span>{settings.whiteBalance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modo de Enfoque:</span>
                    <span>{settings.focusMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modo de Flash:</span>
                    <span>{settings.flashMode}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Capacidades del dispositivo */}
          {capabilities && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Capacidades del Dispositivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Cámara Trasera:</span>
                    <Badge variant={capabilities.hasRearCamera ? "default" : "secondary"}>
                      {capabilities.hasRearCamera ? "Sí" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Flash:</span>
                    <Badge variant={capabilities.hasFlash ? "default" : "secondary"}>
                      {capabilities.hasFlash ? "Sí" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Estabilización:</span>
                    <Badge variant={capabilities.hasImageStabilization ? "default" : "secondary"}>
                      {capabilities.hasImageStabilization ? "Sí" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto Enfoque:</span>
                    <Badge variant={capabilities.hasAutoFocus ? "default" : "secondary"}>
                      {capabilities.hasAutoFocus ? "Sí" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Frame Rate Máximo:</span>
                    <span>{capabilities.maxFrameRate} fps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resoluciones:</span>
                    <span>{capabilities.supportedResolutions.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};