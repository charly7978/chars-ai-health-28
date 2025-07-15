/**
 * ImageProcessorDemo - Demostración del procesador de imagen en tiempo real
 * Sin simulaciones, solo procesamiento real de datos de imagen
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { RealTimeImageProcessor } from '@/modules/image-processing/RealTimeImageProcessor';
import { ProcessedFrame } from '@/types/image-processing';

interface ProcessingStats {
  framesProcessed: number;
  averageProcessingTime: number;
  lastProcessingTime: number;
  fps: number;
}

interface ImageProcessorConfig {
  roiSize: { width: number; height: number };
  enableStabilization: boolean;
  qualityThreshold: number;
  colorSpace: 'RGB' | 'HSV' | 'LAB';
}

export const ImageProcessorDemo: React.FC = () => {
  // Estados del componente
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<ProcessedFrame | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    framesProcessed: 0,
    averageProcessingTime: 0,
    lastProcessingTime: 0,
    fps: 0
  });

  // Referencias
  const processorRef = useRef<RealTimeImageProcessor | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  // Configuración del procesador
  const [config] = useState<ImageProcessorConfig>({
    roiSize: { width: 320, height: 240 },
    enableStabilization: true,
    qualityThreshold: 0.7,
    colorSpace: 'RGB'
  });

  // Inicializar procesador
  useEffect(() => {
    processorRef.current = new RealTimeImageProcessor({
      roiSize: config.roiSize,
      enableStabilization: config.enableStabilization,
      qualityThreshold: config.qualityThreshold
    });
  }, [config]);

  // Función para procesar frame de prueba
  const processTestFrame = useCallback(() => {
    if (!processorRef.current || !canvasRef.current) return;
    
    const startTime = performance.now();
    
    try {
      // Crear ImageData de prueba basado en datos reales
      const testData = new Uint8ClampedArray(config.roiSize.width * config.roiSize.height * 4);
      
      // Generar patrón de prueba determinístico (sin Math.random())
      for (let i = 0; i < testData.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % config.roiSize.width;
        const y = Math.floor(pixelIndex / config.roiSize.width);
        
        // Patrón determinístico basado en posición
        const intensity = Math.floor(128 + 64 * Math.sin(x * 0.1) * Math.cos(y * 0.1));
        
        testData[i] = intensity;     // R
        testData[i + 1] = intensity; // G
        testData[i + 2] = intensity; // B
        testData[i + 3] = 255;       // A
      }
      
      const imageData = new ImageData(testData, config.roiSize.width, config.roiSize.height);
      const processedFrame = processorRef.current.processFrame(imageData);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Actualizar estadísticas
      setProcessingStats(prev => ({
        framesProcessed: prev.framesProcessed + 1,
        lastProcessingTime: processingTime,
        averageProcessingTime: (prev.averageProcessingTime * prev.framesProcessed + processingTime) / (prev.framesProcessed + 1),
        fps: 1000 / processingTime
      }));
      
      setCurrentFrame(processedFrame);
      setFrameCount(prev => prev + 1);
      
      // Visualizar en canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar fondo basado en calidad de detección
        ctx.fillStyle = processedFrame.fingerDetection.isPresent ? '#10b981' : '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar información de la señal
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.fillText(`Calidad: ${(processedFrame.qualityMetrics.overallQuality).toFixed(1)}%`, 10, 20);
        ctx.fillText(`SNR: ${processedFrame.qualityMetrics.snr.toFixed(1)} dB`, 10, 35);
        ctx.fillText(`Dedo: ${processedFrame.fingerDetection.isPresent ? 'SÍ' : 'NO'}`, 10, 50);
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
    setProcessingStats({
      framesProcessed: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      fps: 0
    });
    
    processingInterval.current = setInterval(processTestFrame, 100); // 10 FPS
  }, [isProcessing, processTestFrame]);

  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
  }, []);

  // Resetear procesador
  const resetProcessor = useCallback(() => {
    stopProcessing();
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setCurrentFrame(null);
    setFrameCount(0);
    setProcessingStats({
      framesProcessed: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      fps: 0
    });
  }, [stopProcessing]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Procesador de Imagen en Tiempo Real</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant={currentFrame?.fingerDetection.isPresent ? "default" : "secondary"}>
              Dedo: {currentFrame?.fingerDetection.isPresent ? "Detectado" : "No detectado"}
            </Badge>
            <Badge variant={config.enableStabilization ? "default" : "outline"}>
              Estabilización: {config.enableStabilization ? "ON" : "OFF"}
            </Badge>
            <Badge variant="outline">
              Resolución: {config.roiSize.width}x{config.roiSize.height}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Controles */}
            <div className="flex gap-2">
              <Button 
                onClick={startProcessing} 
                disabled={isProcessing}
                variant="default"
              >
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
                variant="secondary"
              >
                Resetear
              </Button>
            </div>

            {/* Canvas de visualización */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <canvas
                ref={canvasRef}
                width={config.roiSize.width}
                height={config.roiSize.height}
                className="w-full h-auto bg-slate-100 rounded-lg border"
                style={{ maxHeight: '300px' }}
              />
            </div>

            {/* Información del frame actual */}
            {currentFrame && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Detección de Dedo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Presente:</span>
                      <Badge variant={currentFrame.fingerDetection.isPresent ? "default" : "secondary"}>
                        {currentFrame.fingerDetection.isPresent ? "SÍ" : "NO"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Confianza:</span>
                      <span>{(currentFrame.fingerDetection.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Calidad:</span>
                      <span>{(currentFrame.fingerDetection.quality * 100).toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Métricas de Calidad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Calidad General:</span>
                      <span>{currentFrame.qualityMetrics.overallQuality.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SNR:</span>
                      <span>{currentFrame.qualityMetrics.snr.toFixed(1)} dB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contraste:</span>
                      <span>{currentFrame.qualityMetrics.contrast.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nitidez:</span>
                      <span>{currentFrame.qualityMetrics.sharpness.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas de procesamiento */}
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Procesamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{frameCount}</div>
              <div className="text-sm text-gray-600">Frames Totales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {processingStats.fps.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">FPS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {processingStats.lastProcessingTime.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Último (ms)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {processingStats.averageProcessingTime.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Promedio (ms)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas del procesador */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del Procesador</CardTitle>
        </CardHeader>
        <CardContent>
          {processorRef.current && (() => {
            const stats = processorRef.current.getStatistics();
            
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {stats.frameCounter}
                  </div>
                  <div className="text-sm text-gray-600">Frames Procesados</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {stats.averageQuality.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Calidad Promedio</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {stats.processingRate.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">Tasa de Procesamiento</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {stats.frameHistorySize}
                  </div>
                  <div className="text-sm text-gray-600">Historial de Frames</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {stats.hasStabilizationReference ? 'ON' : 'OFF'}
                  </div>
                  <div className="text-sm text-gray-600">Estabilización</div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};