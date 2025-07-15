/**
 * Componente de demostración para RealTimeImageProcessor
 * Permite probar y visualizar el procesamiento de imagen en tiempo real
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RealTimeImageProcessor } from '../../modules/image-processing/RealTimeImageProcessor';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Eye, Activity, Settings, Camera } from 'lucide-react';
import type { ProcessedFrame, ImageProcessingConfig } from '../../types/image-processing';

export const ImageProcessorDemo: React.FC = () => {
  // Referencias
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<RealTimeImageProcessor | null>(null);
  
  // Estados del componente
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<ProcessedFrame | null>(null);
  const [processingInterval, setProcessingInterval] = useState<NodeJS.Timeout | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [processingStats, setProcessingStats] = useState({
    averageTime: 0,
    fps: 0,
    totalFrames: 0
  });
  
  // Configuración del procesador
  const [config] = useState<ImageProcessingConfig>({
    roiSize: { width: 200, height: 200 },
    roiPosition: { x: 0.5, y: 0.5 },
    enableStabilization: true,
    qualityThreshold: 70,
    textureAnalysisDepth: 3,
    colorSpaceConversion: 'Lab'
  });
  
  // Inicializar procesador
  useEffect(() => {
    processorRef.current = new RealTimeImageProcessor(config);
  }, [config]);
  
  // Función para procesar frame de prueba
  const processTestFrame = useCallback(() => {
    if (!processorRef.current) return;
    
    const startTime = performance.now();
    
    try {
      // Crear ImageData de prueba
      const testData = new Uint8ClampedArray(config.roiSize.width * config.roiSize.height * 4);
      for (let i = 0; i < testData.length; i += 4) {
        testData[i] = 128;     // R
        testData[i + 1] = 96;  // G
        testData[i + 2] = 64;  // B
        testData[i + 3] = 255; // A
      }
      
      const imageData = new ImageData(testData, config.roiSize.width, config.roiSize.height);
      const processedFrame = processorRef.current.processFrame(imageData);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Actualizar estadísticas
      setProcessingStats(prev => {
        const newTotalFrames = prev.totalFrames + 1;
        const newAverageTime = (prev.averageTime * prev.totalFrames + processingTime) / newTotalFrames;
        const newFps = newTotalFrames > 1 ? 1000 / newAverageTime : 0;
        
        return {
          averageTime: newAverageTime,
          fps: newFps,
          totalFrames: newTotalFrames
        };
      });
      
      setCurrentFrame(processedFrame);
      setFrameCount(prev => prev + 1);
      
      // Visualizar en canvas si existe
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.fillStyle = processedFrame.fingerDetection.isPresent ? '#10b981' : '#ef4444';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px sans-serif';
          ctx.fillText(
            `Calidad: ${processedFrame.qualityMetrics.overallQuality.toFixed(0)}%`,
            10, 30
          );
          ctx.fillText(
            `Dedo: ${processedFrame.fingerDetection.isPresent ? 'Detectado' : 'No detectado'}`,
            10, 50
          );
        }
      }
      
    } catch (error) {
      console.error('Error procesando frame:', error);
    }
  }, [config]);
  
  // Iniciar procesamiento
  const startProcessing = useCallback(() => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setFrameCount(0);
    setProcessingStats({ averageTime: 0, fps: 0, totalFrames: 0 });
    
    const interval = setInterval(processTestFrame, 100); // 10 FPS para demo
    setProcessingInterval(interval);
  }, [isProcessing, processTestFrame]);
  
  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    if (processingInterval) {
      clearInterval(processingInterval);
      setProcessingInterval(null);
    }
  }, [processingInterval]);
  
  // Resetear procesador
  const resetProcessor = useCallback(() => {
    stopProcessing();
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setCurrentFrame(null);
    setFrameCount(0);
    setProcessingStats({ averageTime: 0, fps: 0, totalFrames: 0 });
  }, [stopProcessing]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };
  }, [processingInterval]);
  
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            RealTimeImageProcessor Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado y controles principales */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={isProcessing ? "default" : "outline"}>
              Procesamiento: {isProcessing ? "Activo" : "Detenido"}
            </Badge>
            <Badge variant={currentFrame?.fingerDetection.isPresent ? "default" : "secondary"}>
              Dedo: {currentFrame?.fingerDetection.isPresent ? "Detectado" : "No detectado"}
            </Badge>
            <Badge variant={config.enableStabilization ? "default" : "outline"}>
              Estabilización: {config.enableStabilization ? "ON" : "OFF"}
            </Badge>
          </div>
          
          {/* Controles principales */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={startProcessing} 
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Iniciar Procesamiento
            </Button>
            
            <Button 
              onClick={stopProcessing} 
              disabled={!isProcessing}
              variant="outline"
            >
              Detener
            </Button>
            
            <Button 
              onClick={resetProcessor} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Reset
            </Button>
          </div>
          
          {/* Métricas de rendimiento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Frames Procesados</div>
              <div className="text-2xl font-bold">{frameCount}</div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">FPS Promedio</div>
              <div className="text-2xl font-bold">{processingStats.fps.toFixed(1)}</div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Tiempo Procesamiento</div>
              <div className="text-2xl font-bold">{processingStats.averageTime.toFixed(1)}ms</div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Calidad General</div>
              <div className="text-2xl font-bold">
                {currentFrame ? currentFrame.qualityMetrics.overallQuality.toFixed(0) : '0'}%
              </div>
              <Progress 
                value={currentFrame ? currentFrame.qualityMetrics.overallQuality : 0} 
                className="h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Visualización */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Visualización de Procesamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasRef}
              width={config.roiSize.width}
              height={config.roiSize.height}
              className="w-full h-auto bg-slate-100 rounded-lg border"
              style={{ maxHeight: '300px' }}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Métricas de Análisis</CardTitle>
          </CardHeader>
          <CardContent>
            {currentFrame ? (
              <div className="space-y-4">
                {/* Detección de Dedo */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Confianza de Detección</span>
                    <span className="text-sm font-semibold">
                      {(currentFrame.fingerDetection.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={currentFrame.fingerDetection.confidence * 100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Score de Textura</span>
                    <span className="text-sm font-semibold">
                      {(currentFrame.fingerDetection.textureScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={currentFrame.fingerDetection.textureScore * 100} className="h-2" />
                </div>
                
                {/* Métricas de Calidad */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">SNR</div>
                    <div className="text-lg font-semibold">
                      {currentFrame.qualityMetrics.snr.toFixed(1)} dB
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Contraste</div>
                    <div className="text-lg font-semibold">
                      {currentFrame.qualityMetrics.contrast.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Nitidez</div>
                    <div className="text-lg font-semibold">
                      {currentFrame.qualityMetrics.sharpness.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Iluminación</div>
                    <div className="text-lg font-semibold">
                      {currentFrame.qualityMetrics.illumination.toFixed(0)}%
                    </div>
                  </div>
                </div>
                
                {/* Densidad Óptica */}
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Densidad Óptica</div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">OD Promedio</span>
                    <span className="text-sm font-semibold">
                      {currentFrame.opticalDensity.averageOD.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Ratio OD</span>
                    <span className="text-sm font-semibold">
                      {currentFrame.opticalDensity.odRatio.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No hay datos de análisis disponibles. Inicie el procesamiento para ver los resultados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Estadísticas del Procesador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado del Procesador</CardTitle>
        </CardHeader>
        <CardContent>
          {processorRef.current && (() => {
            const stats = processorRef.current.getStatistics();
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Historial de Frames</div>
                  <div className="text-lg font-semibold">{stats.frameHistorySize}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Contador de Frames</div>
                  <div className="text-lg font-semibold">{stats.frameCounter}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Referencia de Estabilización</div>
                  <div className="text-lg font-semibold">
                    {stats.hasStabilizationReference ? 'Sí' : 'No'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Calidad Promedio</div>
                  <div className="text-lg font-semibold">
                    {stats.averageQuality.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Tasa de Procesamiento</div>
                  <div className="text-lg font-semibold">
                    {stats.processingRate.toFixed(1)} fps
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};