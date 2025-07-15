/**
 * Componente de demostración para PPGSignalExtractor
 * Permite probar y visualizar todas las funcionalidades de extracción PPG
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePPGExtractor } from '../../hooks/usePPGExtractor';
import { useImageProcessor } from '../../hooks/useImageProcessor';
import { useAndroidCamera } from '../../hooks/useAndroidCamera';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Heart, 
  Activity, 
  BarChart3, 
  Settings, 
  Zap,
  TrendingUp,
  Waves
} from 'lucide-react';

export const PPGExtractionDemo: React.FC = () => {
  const {
    isInitialized: cameraInitialized,
    mediaStream,
    initialize: initializeCamera,
    captureFrame
  } = useAndroidCamera();
  
  const {
    processFrame,
    lastFrame: processedFrame,
    currentQuality
  } = useImageProcessor();
  
  const {
    isExtracting,
    isCalibrated,
    calibrationProgress,
    currentSignal,
    pulseWaveform,
    spectralAnalysis,
    signalQuality,
    heartRate,
    perfusionIndex,
    config,
    extractSignal,
    updateConfig,
    reset,
    statistics
  } = usePPGExtractor();
  
  const [isRunning, setIsRunning] = useState(false);
  const [extractionInterval, setExtractionInterval] = useState<NodeJS.Timeout | null>(null);
  const frameBufferRef = useRef<any[]>([]);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Configurar video stream
  useEffect(() => {
    if (!cameraInitialized) {
      initializeCamera();
    }
  }, [cameraInitialized, initializeCamera]); 
 // Función para procesar y extraer PPG continuamente
  const startExtraction = useCallback(() => {
    if (!cameraInitialized || isRunning) return;
    
    setIsRunning(true);
    frameBufferRef.current = [];
    
    const interval = setInterval(() => {
      const imageData = captureFrame();
      if (imageData) {
        const processed = processFrame(imageData);
        if (processed) {
          frameBufferRef.current.push(processed);
          
          // Mantener buffer de 60 frames (2 segundos a 30fps)
          if (frameBufferRef.current.length > 60) {
            frameBufferRef.current.shift();
          }
          
          // Extraer PPG cada 30 frames
          if (frameBufferRef.current.length >= 30 && frameBufferRef.current.length % 10 === 0) {
            const result = extractSignal(frameBufferRef.current);
            
            if (result && chartCanvasRef.current) {
              drawSignalChart(result.signal);
            }
            
            if (result?.pulseWaveform && waveformCanvasRef.current) {
              drawWaveform(result.pulseWaveform, result.signal.acComponent);
            }
          }
        }
      }
    }, 100); // 10 FPS para demo
    
    setExtractionInterval(interval);
  }, [cameraInitialized, isRunning, captureFrame, processFrame, extractSignal]);
  
  const stopExtraction = useCallback(() => {
    setIsRunning(false);
    if (extractionInterval) {
      clearInterval(extractionInterval);
      setExtractionInterval(null);
    }
    frameBufferRef.current = [];
  }, [extractionInterval]);
  
  const handleReset = useCallback(() => {
    stopExtraction();
    reset();
    frameBufferRef.current = [];
  }, [stopExtraction, reset]);
  
  // Función para dibujar gráfico de señal PPG
  const drawSignalChart = useCallback((signal: any) => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Configurar estilos
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Dibujar señal roja (principal)
    if (signal.red && signal.red.length > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      
      const stepX = width / (signal.red.length - 1);
      const minVal = Math.min(...signal.red);
      const maxVal = Math.max(...signal.red);
      const range = maxVal - minVal || 1;
      
      signal.red.forEach((value: number, index: number) => {
        const x = index * stepX;
        const y = height - ((value - minVal) / range) * height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }
    
    // Dibujar componente AC
    if (signal.acComponent && signal.acComponent.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const stepX = width / (signal.acComponent.length - 1);
      const minVal = Math.min(...signal.acComponent);
      const maxVal = Math.max(...signal.acComponent);
      const range = maxVal - minVal || 1;
      
      signal.acComponent.forEach((value: number, index: number) => {
        const x = index * stepX;
        const y = height - ((value - minVal) / range) * height * 0.3 + height * 0.7;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }
  }, []);
  
  // Función para dibujar forma de onda de pulso
  const drawWaveform = useCallback((waveform: any, acSignal: number[]) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !acSignal.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Dibujar forma de onda
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const stepX = width / (acSignal.length - 1);
    const minVal = Math.min(...acSignal);
    const maxVal = Math.max(...acSignal);
    const range = maxVal - minVal || 1;
    
    acSignal.forEach((value, index) => {
      const x = index * stepX;
      const y = height - ((value - minVal) / range) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Marcar pico sistólico
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    const peakIndex = acSignal.indexOf(Math.max(...acSignal));
    const peakX = peakIndex * stepX;
    const peakY = height - ((Math.max(...acSignal) - minVal) / range) * height;
    ctx.arc(peakX, peakY, 4, 0, 2 * Math.PI);
    ctx.fill();
    
    // Etiquetas
    ctx.fillStyle = '#374151';
    ctx.font = '12px monospace';
    ctx.fillText('Pico Sistólico', peakX + 10, peakY - 10);
  }, []);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (extractionInterval) {
        clearInterval(extractionInterval);
      }
    };
  }, [extractionInterval]);