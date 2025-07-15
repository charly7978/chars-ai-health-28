/**
 * Pruebas unitarias para AndroidCameraController
 * Verifica el funcionamiento correcto de todas las funciones de control de cámara
 */

import { AndroidCameraController } from '../AndroidCameraController';

// Mocks para APIs del navegador
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();
const mockVideoTrack = {
  getSettings: jest.fn(),
  applyConstraints: jest.fn(),
  stop: jest.fn()
};
const mockMediaStream = {
  getVideoTracks: jest.fn(() => [mockVideoTrack]),
  getTracks: jest.fn(() => [mockVideoTrack])
};

// Setup de mocks globales
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices
  },
  writable: true
});

describe('AndroidCameraController', () => {
  let controller: AndroidCameraController;
  
  beforeEach(() => {
    controller = new AndroidCameraController();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockEnumerateDevices.mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera1', label: 'Back Camera' },
      { kind: 'videoinput', deviceId: 'camera2', label: 'Front Camera' }
    ]);
    
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    
    mockVideoTrack.getSettings.mockReturnValue({
      width: 1920,
      height: 1080,
      frameRate: 60,
      facingMode: 'environment'
    });
    
    mockVideoTrack.applyConstraints.mockResolvedValue(undefined);
  });
  
  describe('initializeRearCamera', () => {
    it('debe inicializar correctamente la cámara trasera', async () => {
      const result = await controller.initializeRearCamera();
      
      expect(result).toBe(mockMediaStream);
      expect(mockEnumerateDevices).toHaveBeenCalled();
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: { exact: 'environment' }
          }),
          audio: false
        })
      );
      expect(controller.isReady()).toBe(true);
    });
    
    it('debe manejar error cuando no hay cámara trasera', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'camera1', label: 'Front Camera' }
      ]);
      
      await expect(controller.initializeRearCamera()).rejects.toThrow(
        'Cámara trasera no disponible en este dispositivo'
      );
    });
    
    it('debe manejar error de getUserMedia', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      await expect(controller.initializeRearCamera()).rejects.toThrow(
        'Error al inicializar cámara trasera'
      );
    });
  });
  
  describe('detectDeviceCapabilities', () => {
    it('debe detectar correctamente las capacidades del dispositivo', async () => {
      await controller.initializeRearCamera();
      const capabilities = controller.getDeviceCapabilities();
      
      expect(capabilities).toEqual(
        expect.objectContaining({
          hasRearCamera: true,
          hasFlash: expect.any(Boolean),
          supportedResolutions: expect.any(Array),
          maxFrameRate: 60,
          supportedColorSpaces: expect.any(Array),
          hasImageStabilization: expect.any(Boolean),
          hasAutoFocus: true
        })
      );
    });
  });
  
  describe('setFrameRate', () => {
    beforeEach(async () => {
      await controller.initializeRearCamera();
    });
    
    it('debe configurar correctamente el frame rate', async () => {
      await controller.setFrameRate(30);
      
      expect(mockVideoTrack.applyConstraints).toHaveBeenCalledWith({
        frameRate: { exact: 30 }
      });
    });
    
    it('debe lanzar error si la cámara no está inicializada', async () => {
      const newController = new AndroidCameraController();
      
      await expect(newController.setFrameRate(30)).rejects.toThrow(
        'Cámara no inicializada'
      );
    });
    
    it('debe manejar error de applyConstraints', async () => {
      mockVideoTrack.applyConstraints.mockRejectedValue(new Error('Constraint error'));
      
      await expect(controller.setFrameRate(120)).rejects.toThrow(
        'No se pudo configurar frame rate a 120 fps'
      );
    });
  });
  
  describe('enableStabilization', () => {
    beforeEach(async () => {
      await controller.initializeRearCamera();
    });
    
    it('debe habilitar estabilización cuando está disponible', async () => {
      await controller.enableStabilization();
      
      expect(mockVideoTrack.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ imageStabilization: true }]
      });
    });
    
    it('debe manejar graciosamente cuando la estabilización no está disponible', async () => {
      mockVideoTrack.applyConstraints.mockRejectedValue(new Error('Not supported'));
      
      // No debe lanzar error
      await expect(controller.enableStabilization()).resolves.toBeUndefined();
    });
  });
  
  describe('configureOptimalSettings', () => {
    beforeEach(async () => {
      await controller.initializeRearCamera();
    });
    
    it('debe retornar configuraciones válidas', () => {
      const settings = controller.configureOptimalSettings();
      
      expect(settings).toEqual(
        expect.objectContaining({
          resolution: expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number)
          }),
          frameRate: expect.any(Number),
          colorSpace: expect.any(String),
          whiteBalance: expect.any(String),
          exposure: expect.any(Number),
          iso: expect.any(Number),
          focusMode: expect.any(String),
          flashMode: expect.any(String)
        })
      );
    });
    
    it('debe lanzar error si la cámara no está inicializada', () => {
      const newController = new AndroidCameraController();
      
      expect(() => newController.configureOptimalSettings()).toThrow(
        'Cámara no inicializada'
      );
    });
  });
  
  describe('stop', () => {
    beforeEach(async () => {
      await controller.initializeRearCamera();
    });
    
    it('debe detener correctamente la cámara y liberar recursos', async () => {
      await controller.stop();
      
      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(controller.isReady()).toBe(false);
    });
    
    it('debe manejar errores durante el stop graciosamente', async () => {
      mockVideoTrack.stop.mockImplementation(() => {
        throw new Error('Stop error');
      });
      
      // No debe lanzar error
      await expect(controller.stop()).resolves.toBeUndefined();
    });
  });
  
  describe('Flash Controller', () => {
    beforeEach(async () => {
      // Mock flash support
      Object.defineProperty(window, 'ImageCapture', {
        value: jest.fn(),
        writable: true
      });
      
      await controller.initializeRearCamera();
    });
    
    it('debe crear controlador de flash cuando está disponible', () => {
      const flashController = controller.enableFlashControl();
      
      expect(flashController).toBeDefined();
      expect(flashController.isSupported()).toBe(true);
    });
    
    it('debe lanzar error cuando el flash no está disponible', () => {
      // Remove flash support
      delete (window as any).ImageCapture;
      
      const newController = new AndroidCameraController();
      
      expect(() => newController.enableFlashControl()).toThrow(
        'Flash no disponible en este dispositivo'
      );
    });
  });
  
  describe('Constraints Building', () => {
    it('debe construir constraints óptimos para cámara trasera', async () => {
      await controller.initializeRearCamera();
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          frameRate: { ideal: 60, min: 30 },
          aspectRatio: { ideal: 16/9 },
          focusMode: 'continuous'
        },
        audio: false
      });
    });
  });
  
  describe('Error Handling', () => {
    it('debe manejar dispositivos sin enumerateDevices', async () => {
      delete (navigator.mediaDevices as any).enumerateDevices;
      
      // Debe usar configuración por defecto
      await expect(controller.initializeRearCamera()).resolves.toBeDefined();
    });
    
    it('debe manejar falta de video tracks', async () => {
      mockMediaStream.getVideoTracks.mockReturnValue([]);
      
      await expect(controller.initializeRearCamera()).rejects.toThrow(
        'No se pudo obtener el track de video de la cámara trasera'
      );
    });
  });
});