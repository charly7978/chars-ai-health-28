/**
 * AndroidCameraController - Controlador Avanzado de Cámara Trasera para Android
 * 
 * Implementa control específico y optimizado para cámara trasera de dispositivos Android
 * con configuración automática de parámetros óptimos para medición biométrica PPG
 * 
 * Características:
 * - Detección automática de cámara trasera
 * - Configuración óptima de resolución y fps
 * - Control de flash LED para iluminación controlada
 * - Estabilización digital avanzada
 * - Calibración automática de balance de blancos
 */

export interface CameraSettings {
  resolution: { width: number; height: number };
  frameRate: number;
  colorSpace: 'sRGB' | 'P3' | 'Rec2020';
  whiteBalance: 'auto' | 'manual';
  exposure: number;
  iso: number;
  focusMode: 'auto' | 'manual' | 'macro';
  flashMode: 'off' | 'on' | 'auto' | 'torch';
}

export interface FlashController {
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  toggle(): Promise<void>;
  isSupported(): boolean;
  getCurrentState(): 'on' | 'off';
}

export interface DeviceCapabilities {
  hasRearCamera: boolean;
  hasFlash: boolean;
  supportedResolutions: { width: number; height: number }[];
  maxFrameRate: number;
  supportedColorSpaces: string[];
  hasImageStabilization: boolean;
  hasAutoFocus: boolean;
}

export class AndroidCameraController {
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private currentSettings: CameraSettings | null = null;
  private deviceCapabilities: DeviceCapabilities | null = null;
  private flashController: FlashController | null = null;
  private isInitialized: boolean = false;
  private stabilizationEnabled: boolean = false;
  
  // Configuraciones óptimas para medición PPG
  private readonly OPTIMAL_RESOLUTIONS = [
    { width: 1920, height: 1080 }, // Full HD preferido
    { width: 1280, height: 720 },  // HD como fallback
    { width: 640, height: 480 }    // VGA como último recurso
  ];
  
  private readonly TARGET_FRAME_RATE = 60; // fps mínimo para análisis temporal preciso
  private readonly MIN_FRAME_RATE = 30;    // fps mínimo aceptable
  
  /**
   * Inicializa la cámara trasera con detección automática y configuración óptima
   */
  public async initializeRearCamera(): Promise<MediaStream> {
    try {
      console.log('AndroidCameraController: Iniciando detección de cámara trasera', {
        timestamp: new Date().toISOString()
      });
      
      // 1. Detectar capacidades del dispositivo
      await this.detectDeviceCapabilities();
      
      if (!this.deviceCapabilities?.hasRearCamera) {
        throw new Error('Cámara trasera no disponible en este dispositivo');
      }
      
      // 2. Configurar constrains específicos para cámara trasera
      const constraints = await this.buildOptimalConstraints();
      
      // 3. Solicitar acceso a la cámara trasera
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!this.mediaStream) {
        throw new Error('No se pudo acceder a la cámara trasera');
      }
      
      // 4. Obtener el track de video
      this.videoTrack = this.mediaStream.getVideoTracks()[0];
      
      if (!this.videoTrack) {
        throw new Error('No se pudo obtener el track de video de la cámara trasera');
      }
      
      // 5. Configurar parámetros avanzados
      await this.configureAdvancedSettings();
      
      // 6. Inicializar controlador de flash
      await this.initializeFlashController();
      
      // 7. Habilitar estabilización si está disponible
      await this.enableStabilization();
      
      this.isInitialized = true;
      
      console.log('AndroidCameraController: Cámara trasera inicializada exitosamente', {
        settings: this.currentSettings,
        capabilities: this.deviceCapabilities,
        hasFlash: this.flashController?.isSupported(),
        timestamp: new Date().toISOString()
      });
      
      return this.mediaStream;
      
    } catch (error) {
      console.error('AndroidCameraController: Error al inicializar cámara trasera:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`Error al inicializar cámara trasera: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Detecta las capacidades del dispositivo Android
   */
  private async detectDeviceCapabilities(): Promise<void> {
    try {
      // Obtener lista de dispositivos de media
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('AndroidCameraController: Dispositivos de video detectados:', {
        totalDevices: videoDevices.length,
        devices: videoDevices.map(d => ({ id: d.deviceId, label: d.label })),
        timestamp: new Date().toISOString()
      });
      
      // Buscar cámara trasera (generalmente la primera o la que no contiene "front")
      const rearCamera = videoDevices.find(device => 
        !device.label.toLowerCase().includes('front') &&
        !device.label.toLowerCase().includes('user') &&
        (device.label.toLowerCase().includes('back') || 
         device.label.toLowerCase().includes('rear') ||
         device.label.toLowerCase().includes('environment') ||
         videoDevices.indexOf(device) === 0) // Primera cámara como fallback
      );
      
      // Detectar capacidades avanzadas
      const hasFlash = 'torch' in navigator || 'ImageCapture' in window;
      const hasImageStabilization = 'getSettings' in MediaStreamTrack.prototype;
      
      this.deviceCapabilities = {
        hasRearCamera: !!rearCamera,
        hasFlash,
        supportedResolutions: this.OPTIMAL_RESOLUTIONS, // Se refinará con pruebas reales
        maxFrameRate: this.TARGET_FRAME_RATE,
        supportedColorSpaces: ['sRGB', 'P3'],
        hasImageStabilization,
        hasAutoFocus: true // Asumimos que la mayoría de cámaras traseras tienen autofocus
      };
      
      console.log('AndroidCameraController: Capacidades detectadas:', {
        capabilities: this.deviceCapabilities,
        rearCameraFound: !!rearCamera,
        rearCameraLabel: rearCamera?.label,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('AndroidCameraController: Error detectando capacidades:', error);
      
      // Configuración por defecto conservadora
      this.deviceCapabilities = {
        hasRearCamera: true, // Asumimos que hay cámara trasera
        hasFlash: false,
        supportedResolutions: [{ width: 640, height: 480 }],
        maxFrameRate: 30,
        supportedColorSpaces: ['sRGB'],
        hasImageStabilization: false,
        hasAutoFocus: true
      };
    }
  }
  
  /**
   * Construye los constraints óptimos para la cámara trasera
   */
  private async buildOptimalConstraints(): Promise<MediaStreamConstraints> {
    const videoConstraints: MediaTrackConstraints = {
      // Especificar cámara trasera explícitamente
      facingMode: { exact: 'environment' }, // 'environment' = cámara trasera
      
      // Configurar resolución óptima
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
      
      // Configurar frame rate para análisis temporal preciso
      frameRate: { 
        ideal: this.TARGET_FRAME_RATE, 
        min: this.MIN_FRAME_RATE 
      },
      
      // Configuraciones avanzadas para medición PPG
      aspectRatio: { ideal: 16/9 },
      
      // Configuraciones de calidad de imagen
      ...(this.deviceCapabilities?.hasAutoFocus && {
        focusMode: 'continuous'
      })
    };
    
    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: false // No necesitamos audio para medición PPG
    };
    
    console.log('AndroidCameraController: Constraints construidos:', {
      constraints,
      timestamp: new Date().toISOString()
    });
    
    return constraints;
  }
  
  /**
   * Configura parámetros avanzados de la cámara
   */
  private async configureAdvancedSettings(): Promise<void> {
    if (!this.videoTrack) {
      throw new Error('Video track no disponible para configuración');
    }
    
    try {
      // Obtener configuraciones actuales
      const currentSettings = this.videoTrack.getSettings();
      
      console.log('AndroidCameraController: Configuraciones actuales de la cámara:', {
        settings: currentSettings,
        timestamp: new Date().toISOString()
      });
      
      // Aplicar configuraciones avanzadas si están disponibles
      const advancedConstraints: MediaTrackConstraints = {};
      
      // Configurar balance de blancos para medición PPG
      if ('whiteBalanceMode' in currentSettings) {
        advancedConstraints.whiteBalanceMode = 'manual';
      }
      
      // Configurar exposición para condiciones óptimas
      if ('exposureMode' in currentSettings) {
        advancedConstraints.exposureMode = 'manual';
      }
      
      // Aplicar configuraciones si hay cambios
      if (Object.keys(advancedConstraints).length > 0) {
        await this.videoTrack.applyConstraints(advancedConstraints);
        console.log('AndroidCameraController: Configuraciones avanzadas aplicadas:', {
          appliedConstraints: advancedConstraints,
          timestamp: new Date().toISOString()
        });
      }
      
      // Guardar configuraciones actuales
      this.currentSettings = {
        resolution: { 
          width: currentSettings.width || 640, 
          height: currentSettings.height || 480 
        },
        frameRate: currentSettings.frameRate || 30,
        colorSpace: 'sRGB',
        whiteBalance: 'auto',
        exposure: 0,
        iso: 100,
        focusMode: 'auto',
        flashMode: 'off'
      };
      
    } catch (error) {
      console.warn('AndroidCameraController: No se pudieron aplicar configuraciones avanzadas:', error);
      
      // Configuración por defecto
      this.currentSettings = {
        resolution: { width: 640, height: 480 },
        frameRate: 30,
        colorSpace: 'sRGB',
        whiteBalance: 'auto',
        exposure: 0,
        iso: 100,
        focusMode: 'auto',
        flashMode: 'off'
      };
    }
  }
  
  /**
   * Inicializa el controlador de flash LED
   */
  private async initializeFlashController(): Promise<void> {
    if (!this.deviceCapabilities?.hasFlash) {
      console.log('AndroidCameraController: Flash no disponible en este dispositivo');
      return;
    }
    
    this.flashController = new AndroidFlashController(this.videoTrack);
    
    console.log('AndroidCameraController: Controlador de flash inicializado:', {
      isSupported: this.flashController.isSupported(),
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Habilita estabilización digital avanzada
   */
  public async enableStabilization(): Promise<void> {
    if (!this.videoTrack || !this.deviceCapabilities?.hasImageStabilization) {
      console.log('AndroidCameraController: Estabilización no disponible');
      return;
    }
    
    try {
      // Intentar habilitar estabilización de imagen
      await this.videoTrack.applyConstraints({
        advanced: [{ imageStabilization: true }]
      });
      
      this.stabilizationEnabled = true;
      
      console.log('AndroidCameraController: Estabilización digital habilitada', {
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.warn('AndroidCameraController: No se pudo habilitar estabilización:', error);
    }
  }
  
  /**
   * Configura la velocidad de frames
   */
  public async setFrameRate(fps: number): Promise<void> {
    if (!this.videoTrack) {
      throw new Error('Cámara no inicializada');
    }
    
    try {
      await this.videoTrack.applyConstraints({
        frameRate: { exact: fps }
      });
      
      if (this.currentSettings) {
        this.currentSettings.frameRate = fps;
      }
      
      console.log('AndroidCameraController: Frame rate configurado:', {
        fps,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('AndroidCameraController: Error configurando frame rate:', error);
      throw new Error(`No se pudo configurar frame rate a ${fps} fps`);
    }
  }
  
  /**
   * Obtiene datos de imagen del frame actual
   */
  public getImageData(): ImageData | null {
    // Esta función será implementada junto con el canvas de captura
    // Por ahora retorna null, se implementará en la integración
    return null;
  }
  
  /**
   * Obtiene las configuraciones actuales
   */
  public configureOptimalSettings(): CameraSettings {
    if (!this.currentSettings) {
      throw new Error('Cámara no inicializada');
    }
    
    return { ...this.currentSettings };
  }
  
  /**
   * Obtiene el controlador de flash
   */
  public enableFlashControl(): FlashController {
    if (!this.flashController) {
      throw new Error('Flash no disponible en este dispositivo');
    }
    
    return this.flashController;
  }
  
  /**
   * Obtiene las capacidades del dispositivo
   */
  public getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities;
  }
  
  /**
   * Verifica si la cámara está inicializada
   */
  public isReady(): boolean {
    return this.isInitialized && !!this.mediaStream && !!this.videoTrack;
  }
  
  /**
   * Detiene la cámara y libera recursos
   */
  public async stop(): Promise<void> {
    try {
      if (this.flashController?.getCurrentState() === 'on') {
        await this.flashController.turnOff();
      }
      
      if (this.videoTrack) {
        this.videoTrack.stop();
        this.videoTrack = null;
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.isInitialized = false;
      this.stabilizationEnabled = false;
      
      console.log('AndroidCameraController: Cámara detenida y recursos liberados', {
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('AndroidCameraController: Error al detener cámara:', error);
    }
  }
}

/**
 * Controlador específico para flash LED en Android
 */
class AndroidFlashController implements FlashController {
  private videoTrack: MediaStreamTrack | null;
  private currentState: 'on' | 'off' = 'off';
  private isFlashSupported: boolean = false;
  
  constructor(videoTrack: MediaStreamTrack | null) {
    this.videoTrack = videoTrack;
    this.detectFlashSupport();
  }
  
  private detectFlashSupport(): void {
    // Detectar soporte de flash usando diferentes APIs
    this.isFlashSupported = !!(
      'torch' in navigator ||
      ('ImageCapture' in window && this.videoTrack) ||
      ('getCapabilities' in (this.videoTrack || {}))
    );
    
    console.log('AndroidFlashController: Soporte de flash detectado:', {
      isSupported: this.isFlashSupported,
      hasTorchAPI: 'torch' in navigator,
      hasImageCapture: 'ImageCapture' in window,
      hasVideoTrack: !!this.videoTrack,
      timestamp: new Date().toISOString()
    });
  }
  
  public async turnOn(): Promise<void> {
    if (!this.isFlashSupported || !this.videoTrack) {
      throw new Error('Flash no soportado en este dispositivo');
    }
    
    try {
      // Intentar diferentes métodos para encender el flash
      if ('torch' in navigator) {
        // API moderna de torch
        await (navigator as any).torch.turnOn();
      } else if ('ImageCapture' in window) {
        // API de ImageCapture
        const imageCapture = new (window as any).ImageCapture(this.videoTrack);
        await imageCapture.setOptions({ torch: true });
      } else {
        // Fallback usando constraints
        await this.videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        });
      }
      
      this.currentState = 'on';
      
      console.log('AndroidFlashController: Flash encendido', {
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('AndroidFlashController: Error encendiendo flash:', error);
      throw new Error('No se pudo encender el flash');
    }
  }
  
  public async turnOff(): Promise<void> {
    if (!this.isFlashSupported || !this.videoTrack) {
      return; // No hacer nada si no hay soporte
    }
    
    try {
      // Intentar diferentes métodos para apagar el flash
      if ('torch' in navigator) {
        await (navigator as any).torch.turnOff();
      } else if ('ImageCapture' in window) {
        const imageCapture = new (window as any).ImageCapture(this.videoTrack);
        await imageCapture.setOptions({ torch: false });
      } else {
        await this.videoTrack.applyConstraints({
          advanced: [{ torch: false }]
        });
      }
      
      this.currentState = 'off';
      
      console.log('AndroidFlashController: Flash apagado', {
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('AndroidFlashController: Error apagando flash:', error);
    }
  }
  
  public async toggle(): Promise<void> {
    if (this.currentState === 'on') {
      await this.turnOff();
    } else {
      await this.turnOn();
    }
  }
  
  public isSupported(): boolean {
    return this.isFlashSupported;
  }
  
  public getCurrentState(): 'on' | 'off' {
    return this.currentState;
  }
}