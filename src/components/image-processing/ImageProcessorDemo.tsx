/**
 * Componente de demostración para RealTimeImageProcessor
 * Permite probar y visualizar todas las funcionalidades de procesamiento de imagen
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useImageProcessor } from '../../hooks/useImageProcessor';
import { useAndroidCamera } from '../../hooks/useAndroidCamera';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Camera, 
  Image, 
  Activity, 
  BarChart3, 
  Settings, 
  Eye,
  Zap,
  Target
} from 'lucide-react';

export const ImageProcessorDemo: React.FC = () => {
  const {
    isInitialized: cameraInitialized,
    mediaStream,
    initialize: initializeCamera,
    captureFrame
  } = useAndroidCamera();
  
  const {
    isProcessing,
    lastFrame,
    frameCount,
    averageQuality,
    currentQuality,
    fingerDetection,
    opticalDensity,
    config,
    processFrame,
    updateConfig,
    reset,
    processingStats
  } = useImageProcessor();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [processingInterval, setProcessingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Configurar video stream
  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);
  
  // Inicializar cámara automáticamente
  useEffect(() => {
    if (!cameraInitialized) {
      initializeCamera();
    }
  }, [cameraInitialized, initializeCamera]);
  
  // Función para procesar frames continuamente
  const startProcessing = useCallback(() => {
    if (!cameraInitialized || isRunning) return;
    
    setIsRunning(true);
    
    const interval = setInterval(() => {
      const imageData = captureFrame();
      if (imageData) {
        const result = processFrame(imageData);
        
        // Visualizar ROI si hay resultado
        if (result && roiCanvasRef.current) {
          const ctx = roiCanvasRef.current.getContext('2d');
          if (ctx) {
            roiCanvasRef.current.width = config.roiSize.width;
            roiCanvasRef.current.height = config.roiSize.height;
            
            // Dibujar ROI extraído (simulado)
            ctx.fillStyle = fingerDetection?.isPresent ? '#4ade80' : '#ef4444';
            ctx.fillRect(0, 0, config.roiSize.width, config.roiSize.height);
            ctx.globalAlpha = 0.3;
            ctx.fillRect(0, 0, config.roiSize.width, config.roiSize.height);
            ctx.globalAlpha = 1;
            
            // Dibujar información de detección
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px monospace';
            ctx.fillText(`Finger: ${fingerDetection?.isPresent ? 'YES' : 'NO'}`, 5, 15);
            ctx.fillText(`Conf: ${(fingerDetection?.confidence || 0).toFixed(2)}`, 5, 30);
            ctx.fillText(`Qual: ${(currentQuality?.overallQuality || 0).toFixed(0)}`, 5, 45);
          }
        }
      }
    }, 100); // 10 FPS para demo
    
    setProcessingInterval(interval);
  }, [cameraInitialized, isRunning, captureFrame, processFrame, config, fingerDetection, currentQuality]);
  
  const stopProcessing = useCallback(() => {
    setIsRunning(false);
    if (processingInterval) {
      clearInterval(processingInterval);
      setProcessingInterval(null);
    }
  }, [processingInterval]);
  
  const handleReset = useCallback(() => {
    stopProcessing();
    reset();
  }, [stopProcessing, reset]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };
  }, [processingInterval]);
  
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            RealTimeImageProcessor Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado y controles */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={cameraInitialized ? "default" : "secondary"}>
              Cámara: {cameraInitialized ? "Lista" : "No inicializada"}
            </Badge>
            <Badge variant={isRunning ? "default" : "outline"}>
              Procesamiento: {isRunning ? "Activo" : "Detenido"}
            </Badge>
            <Badge variant={fingerDetection?.isPresent ? "default" : "secondary"}>
              Dedo: {fingerDetection?.isPresent ? "Detectado" : "No detectado"}
            </Badge>
            <Badge variant="outline">
              Frames: {frameCount}
            </Badge>
          </div>
          
          {/* Controles principales */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={startProcessing} 
              disabled={!cameraInitialized || isRunning}
              className="flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Iniciar Procesamiento
            </Button>
            
            <Button 
              onClick={stopProcessing} 
              disabled={!isRunning}
              variant="outline"
            >
              Detener
            </Button>
            
            <Button 
              onClick={handleReset} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Reset
            </Button>
          </div>
          
          {/* Métricas principales */}
          {currentQuality && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Calidad General</div>
                <div className="text-2xl font-bold">{currentQuality.overallQuality.toFixed(0)}%</div>
                <Progress value={currentQuality.overallQuality} className="h-2" />
              </div>
              
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">SNR</div>
                <div className="text-2xl font-bold">{currentQuality.snr.toFixed(1)} dB</div>
                <Progress value={Math.min(currentQuality.snr * 2, 100)} className="h-2" />
              </div>
              
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Contraste</div>
                <div className="text-2xl font-bold">{(currentQuality.contrast * 100).toFixed(0)}%</div>
                <Progress value={currentQuality.contrast * 100} className="h-2" />
              </div>
              
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Estabilidad</div>
                <div className="text-2xl font-bold">{currentQuality.stability.toFixed(0)}%</div>
                <Progress value={currentQuality.stability} className="h-2" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Tabs defaultValue="video" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Video
          </TabsTrigger>
          <TabsTrigger value="detection" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Detección
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Análisis
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </TabsTrigger>
        </TabsList>
        
        {/* Tab de Video */}
        <TabsContent value="video" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ROI Procesado</CardTitle>
              </CardHeader>
              <CardContent>
                <canvas
                  ref={roiCanvasRef}
                  className="w-full h-auto bg-gray-100 rounded-lg border"
                  style={{ maxHeight: '300px' }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Tab de Detección */}
        <TabsContent value="detection" className="space-y-4">
          {fingerDetection && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detección de Dedo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Presente</div>
                      <Badge variant={fingerDetection.isPresent ? "default" : "secondary"}>
                        {fingerDetection.isPresent ? "SÍ" : "NO"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Confianza</div>
                      <div className="text-lg font-semibold">
                        {(fingerDetection.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cobertura</div>
                      <div className="text-lg font-semibold">
                        {(fingerDetection.coverage * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Textura</div>
                      <div className="text-lg font-semibold">
                        {(fingerDetection.textureScore * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Posición</div>
                    <div className="text-sm font-mono">
                      X: {fingerDetection.position.x.toFixed(0)}, 
                      Y: {fingerDetection.position.y.toFixed(0)}<br/>
                      W: {fingerDetection.position.width.toFixed(0)}, 
                      H: {fingerDetection.position.height.toFixed(0)}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {opticalDensity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Densidad Óptica</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">OD Promedio</div>
                        <div className="text-lg font-semibold">
                          {opticalDensity.averageOD.toFixed(3)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Ratio OD</div>
                        <div className="text-lg font-semibold">
                          {opticalDensity.odRatio.toFixed(3)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Canales</div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Rojo:</span>
                          <span>{opticalDensity.redOD.length} muestras</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Verde:</span>
                          <span>{opticalDensity.greenOD.length} muestras</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Azul:</span>
                          <span>{opticalDensity.blueOD.length} muestras</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
        
        {/* Tab de Análisis */}
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estadísticas de Procesamiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Frames Procesados</div>
                    <div className="text-2xl font-bold">{processingStats.framesProcessed}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Tiempo Promedio</div>
                    <div className="text-2xl font-bold">
                      {processingStats.averageProcessingTime.toFixed(1)}ms
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Calidad Promedio</div>
                    <div className="text-2xl font-bold">{averageQuality.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Detección de Dedo</div>
                    <div className="text-2xl font-bold">
                      {processingStats.fingerDetectionRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {currentQuality && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Métricas Detalladas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>SNR:</span>
                      <span>{currentQuality.snr.toFixed(2)} dB</span>
                    </div>
                    <Progress value={Math.min(currentQuality.snr * 2, 100)} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Contraste:</span>
                      <span>{(currentQuality.contrast * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={currentQuality.contrast * 100} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Nitidez:</span>
                      <span>{(currentQuality.sharpness * 1000).toFixed(1)}</span>
                    </div>
                    <Progress value={Math.min(currentQuality.sharpness * 1000, 100)} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Iluminación:</span>
                      <span>{currentQuality.illumination.toFixed(1)}%</span>
                    </div>
                    <Progress value={currentQuality.illumination} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        {/* Tab de Configuración */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuración del Procesador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Tamaño ROI</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        value={config.roiSize.width}
                        onChange={(e) => updateConfig({
                          roiSize: { ...config.roiSize, width: parseInt(e.target.value) }
                        })}
                        className="flex-1 px-3 py-2 border rounded-md"
                        placeholder="Ancho"
                      />
                      <input
                        type="number"
                        value={config.roiSize.height}
                        onChange={(e) => updateConfig({
                          roiSize: { ...config.roiSize, height: parseInt(e.target.value) }
                        })}
                        className="flex-1 px-3 py-2 border rounded-md"
                        placeholder="Alto"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Umbral de Calidad</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.qualityThreshold}
                      onChange={(e) => updateConfig({ qualityThreshold: parseInt(e.target.value) })}
                      className="w-full mt-1"
                    />
                    <div className="text-sm text-muted-foreground mt-1">
                      {config.qualityThreshold}%
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Espacio de Color</label>
                    <select
                      value={config.colorSpaceConversion}
                      onChange={(e) => updateConfig({ 
                        colorSpaceConversion: e.target.value as 'RGB' | 'XYZ' | 'Lab' | 'YUV'
                      })}
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    >
                      <option value="RGB">RGB</option>
                      <option value="XYZ">XYZ</option>
                      <option value="Lab">Lab</option>
                      <option value="YUV">YUV</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="stabilization"
                      checked={config.enableStabilization}
                      onChange={(e) => updateConfig({ enableStabilization: e.target.checked })}
                    />
                    <label htmlFor="stabilization" className="text-sm font-medium">
                      Habilitar Estabilización
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};