/**
 * Hook personalizado para AndroidCameraController
 * Proporciona una interfaz React para el control avanzado de cámara trasera
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AndroidCameraController } from '../modules/camera/AndroidCameraController';
import { CameraSettings, DeviceCapabilities, FlashController, CameraInitializationResult } from '../types/camera';

export interface UseAndroidCameraResult {
  // Estado
  isInitialized: boolean;
  isInitializing: boolean;
  mediaStream: MediaStream | null;
  error: string | null;
  
  // Configuraciones
  settings: CameraSettings | null;
  capabilities: DeviceCapabilities | null;
  
  // Controladores
  flashController: FlashController | null;
  
  // Métodos
  initialize: () => Promise<boolean>;
  stop: () => Promise<void>;
  setFrameRate: (fps: number) => Promise<void>;
  enableStabilization: () => Promise<void>;
  captureFrame: () => ImageData | null;
  
  // Estado del flash
  flashSupported: boolean;
  flashState: 'on' | 'off';
  toggleFlash: () => Promise<void>;
}

export const useAndroidCamera = (): UseAndroidCameraResult => {
  // Estados
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CameraSettings | null>(null);
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [flashController, setFlashController] = useState<FlashController | null>(null);
  const [flashState, setFlashState] = useState<'on' | 'off'>('off');
  
  // Referencias
  const cameraControllerRef = useRef<AndroidCameraController | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Crear instancia del controlador
  useEffect(() => {
    cameraControllerRef.current = new AndroidCameraController();
    
    console.log('useAndroidCamera: Controlador de cámara creado', {
      timestamp: new Date().toISOString()
    });
    
    return () => {
      // Cleanup al desmontar
      if (cameraControllerRef.current) {
        cameraControllerRef.current.stop().catch(console.error);
      }
    };
  }, []);
  
  /**
   * Inicializa la cámara trasera
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!cameraControllerRef.current || isInitializing) {
      return false;
    }
    
    setIsInitializing(true);
    setError(null);
    
    try {
      console.log('useAndroidCamera: Iniciando inicialización de cámara trasera', {
        timestamp: new Date().toISOString()
      });
      
      // Inicializar cámara trasera
      const stream = await cameraControllerRef.current.initializeRearCamera();
      
      // Obtener configuraciones y capacidades
      const cameraSettings = cameraControllerRef.current.configureOptimalSettings();
      const deviceCapabilities = cameraControllerRef.current.getDeviceCapabilities();
      
      // Configurar controlador de flash si está disponible
      let flash: FlashController | null = null;
      try {
        flash = cameraControllerRef.current.enableFlashControl();
        setFlashState(flash.getCurrentState());
      } catch (flashError) {
        console.log('useAndroidCamera: Flash no disponible:', flashError);
      }
      
      // Actualizar estados
      setMediaStream(stream);
      setSettings(cameraSettings);
      setCapabilities(deviceCapabilities);
      setFlashController(flash);
      setIsInitialized(true);
      
      console.log('useAndroidCamera: Cámara inicializada exitosamente', {
        settings: cameraSettings,
        capabilities: deviceCapabilities,
        hasFlash: !!flash,
        timestamp: new Date().toISOString()
      });
      
      return true;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al inicializar cámara';
      
      console.error('useAndroidCamera: Error en inicialización:', {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      setError(errorMessage);
      setIsInitialized(false);
      
      return false;
      
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing]);
  
  /**
   * Detiene la cámara y libera recursos
   */
  const stop = useCallback(async (): Promise<void> => {
    if (!cameraControllerRef.current) {
      return;
    }
    
    try {
      await cameraControllerRef.current.stop();
      
      // Resetear estados
      setMediaStream(null);
      setSettings(null);
      setCapabilities(null);
      setFlashController(null);
      setFlashState('off');
      setIsInitialized(false);
      setError(null);
      
      console.log('useAndroidCamera: Cámara detenida y estados reseteados', {
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('useAndroidCamera: Error al detener cámara:', err);
    }
  }, []);
  
  /**
   * Configura la velocidad de frames
   */
  const setFrameRate = useCallback(async (fps: number): Promise<void> => {
    if (!cameraControllerRef.current || !isInitialized) {
      throw new Error('Cámara no inicializada');
    }
    
    try {
      await cameraControllerRef.current.setFrameRate(fps);
      
      // Actualizar configuraciones
      const updatedSettings = cameraControllerRef.current.configureOptimalSettings();
      setSettings(updatedSettings);
      
      console.log('useAndroidCamera: Frame rate actualizado:', {
        fps,
        newSettings: updatedSettings,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al configurar frame rate';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isInitialized]);
  
  /**
   * Habilita estabilización digital
   */
  const enableStabilization = useCallback(async (): Promise<void> => {
    if (!cameraControllerRef.current || !isInitialized) {
      throw new Error('Cámara no inicializada');
    }
    
    try {
      await cameraControllerRef.current.enableStabilization();
      
      console.log('useAndroidCamera: Estabilización habilitada', {
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.warn('useAndroidCamera: No se pudo habilitar estabilización:', err);
    }
  }, [isInitialized]);
  
  /**
   * Captura un frame actual como ImageData
   */
  const captureFrame = useCallback((): ImageData | null => {
    if (!mediaStream || !isInitialized) {
      return null;
    }
    
    try {
      // Crear elementos de captura si no existen
      if (!videoElementRef.current) {
        videoElementRef.current = document.createElement('video');
        videoElementRef.current.autoplay = true;
        videoElementRef.current.muted = true;
        videoElementRef.current.playsInline = true;
      }
      
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      
      const video = videoElementRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('useAndroidCamera: No se pudo obtener contexto 2D del canvas');
        return null;
      }
      
      // Configurar video stream si no está configurado
      if (video.srcObject !== mediaStream) {
        video.srcObject = mediaStream;
      }
      
      // Esperar a que el video esté listo
      if (video.readyState < 2) {
        console.warn('useAndroidCamera: Video no está listo para captura');
        return null;
      }
      
      // Configurar canvas con las dimensiones del video
      canvas.width = video.videoWidth || settings?.resolution.width || 640;
      canvas.height = video.videoHeight || settings?.resolution.height || 480;
      
      // Capturar frame actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Obtener ImageData
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      return imageData;
      
    } catch (err) {
      console.error('useAndroidCamera: Error capturando frame:', err);
      return null;
    }
  }, [mediaStream, isInitialized, settings]);
  
  /**
   * Alterna el estado del flash
   */
  const toggleFlash = useCallback(async (): Promise<void> => {
    if (!flashController) {
      throw new Error('Flash no disponible');
    }
    
    try {
      await flashController.toggle();
      setFlashState(flashController.getCurrentState());
      
      console.log('useAndroidCamera: Flash alternado:', {
        newState: flashController.getCurrentState(),
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al alternar flash';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [flashController]);
  
  // Cleanup automático cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (isInitialized) {
        stop().catch(console.error);
      }
    };
  }, [isInitialized, stop]);
  
  return {
    // Estado
    isInitialized,
    isInitializing,
    mediaStream,
    error,
    
    // Configuraciones
    settings,
    capabilities,
    
    // Controladores
    flashController,
    
    // Métodos
    initialize,
    stop,
    setFrameRate,
    enableStabilization,
    captureFrame,
    
    // Estado del flash
    flashSupported: !!flashController?.isSupported(),
    flashState,
    toggleFlash
  };
};