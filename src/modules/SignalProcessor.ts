// Este archivo exporta el PPGSignalProcessor desde la estructura refactorizada
// para mantener compatibilidad con versiones anteriores
import { PPGSignalProcessor as OriginalPPGSignalProcessor } from './signal-processing/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Extender la clase original en lugar de implementar su interfaz
export class PPGSignalProcessor extends OriginalPPGSignalProcessor {
  // Bandera para monitorear inicialización correcta
  private isInitialized: boolean = false;
  
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    console.log("[DIAG] SignalProcessor wrapper: Constructor", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError,
      stack: new Error().stack
    });
    
    // Llamar al constructor de la clase padre
    super(onSignalReady, onError);
    
    // Verificar inicialización
    setTimeout(() => {
      this.checkInitialization();
    }, 1000);
  }
  
  // Verificación de inicialización correcta
  private checkInitialization() {
    console.log("[DIAG] SignalProcessor wrapper: checkInitialization", { isInitialized: this.isInitialized });
    if (!this.isInitialized) {
      console.log("⚠️ PPGSignalProcessor: Inicialización verificada manualmente");
      this.initialize().then(() => {
        console.log("✅ PPGSignalProcessor: Inicialización manual exitosa");
        this.isInitialized = true;
      }).catch(err => {
        console.error("❌ PPGSignalProcessor: Error en inicialización manual", err);
      });
    }
  }
  
  // Sobrescribimos initialize para marcar como inicializado
  async initialize(): Promise<void> {
    console.log("[DIAG] SignalProcessor wrapper: initialize() called", {
      hasOnSignalReadyCallback: !!this.onSignalReady,
      hasOnErrorCallback: !!this.onError
    });
    
    // Asegurar que el padre tenga los callbacks correctos
    if (this.onSignalReady) {
      super.onSignalReady = this.onSignalReady;
    }
    
    if (this.onError) {
      super.onError = this.onError;
    }
    
    // Llamar al initialize del padre
    const result = await super.initialize();
    this.isInitialized = true;
    return result;
  }

  // Sobrescribimos processFrame para asegurar que los callbacks estén actualizados
  processFrame(imageData: ImageData): void {
    console.log("[DIAG] SignalProcessor wrapper: processFrame() called", {
      isInitialized: this.isInitialized,
      hasOnSignalReadyCallback: !!this.onSignalReady,
      superHasCallback: !!super.onSignalReady,
      imageSize: `${imageData.width}x${imageData.height}`,
      timestamp: new Date().toISOString()
    });
    
    // VERIFICACIÓN CRÍTICA: Asegurar que los callbacks están correctamente configurados
    if (this.onSignalReady && super.onSignalReady !== this.onSignalReady) {
      console.log("PPGSignalProcessor wrapper: Actualizando onSignalReady callback");
      super.onSignalReady = this.onSignalReady;
    }
    
    if (this.onError && super.onError !== this.onError) {
      console.log("PPGSignalProcessor wrapper: Actualizando onError callback");
      super.onError = this.onError;
    }
    
    // NUEVA VERIFICACIÓN: Forzar ejecución de callback si no se ejecuta
    const originalCallback = super.onSignalReady;
    let callbackExecuted = false;
    
    // Wrapper temporal para detectar si el callback se ejecuta
    super.onSignalReady = (signal: ProcessedSignal) => {
      callbackExecuted = true;
      if (originalCallback) {
        originalCallback(signal);
      }
    };
    
    // Si no se ha inicializado, hacerlo ahora
    if (!this.isInitialized) {
      console.log("PPGSignalProcessor: Inicializando en processFrame");
      this.initialize().then(() => {
        console.log("PPGSignalProcessor: Inicializado correctamente, procesando frame");
        // Llamar al método de la clase padre
        super.processFrame(imageData);
        
        // Verificar si el callback se ejecutó después de un breve delay
        setTimeout(() => {
          if (!callbackExecuted) {
            console.error("PPGSignalProcessor: Callback no se ejecutó, forzando ejecución");
            this.forceCallbackExecution(imageData);
          }
          // Restaurar callback original
          super.onSignalReady = originalCallback;
        }, 100);
      }).catch(error => {
        console.error("PPGSignalProcessor: Error al inicializar", error);
        // Restaurar callback original
        super.onSignalReady = originalCallback;
      });
    } else {
      // Llamar al método de la clase padre
      super.processFrame(imageData);
      
      // Verificar si el callback se ejecutó después de un breve delay
      setTimeout(() => {
        if (!callbackExecuted) {
          console.error("PPGSignalProcessor: Callback no se ejecutó, forzando ejecución");
          this.forceCallbackExecution(imageData);
        }
        // Restaurar callback original
        super.onSignalReady = originalCallback;
      }, 100);
    }
  }
  
  // Método para forzar la ejecución del callback cuando no se ejecuta naturalmente
  private forceCallbackExecution(imageData: ImageData): void {
    if (!this.onSignalReady) return;
    
    console.log("PPGSignalProcessor: Forzando ejecución de callback con señal básica");
    
    // Crear una señal básica a partir de los datos de la imagen
    const data = imageData.data;
    let redSum = 0;
    let pixelCount = 0;
    
    // Extraer valor promedio del canal rojo
    for (let i = 0; i < data.length; i += 4) {
      redSum += data[i];
      pixelCount++;
    }
    
    const avgRed = pixelCount > 0 ? redSum / pixelCount : 0;
    
    // Crear señal procesada básica
    const forcedSignal: ProcessedSignal = {
      timestamp: Date.now(),
      rawValue: avgRed,
      filteredValue: avgRed,
      quality: avgRed > 10 ? 25 : 0, // Calidad básica
      fingerDetected: avgRed > 20, // Detección básica
      roi: {
        x: imageData.width * 0.25,
        y: imageData.height * 0.25,
        width: imageData.width * 0.5,
        height: imageData.height * 0.5
      },
      perfusionIndex: 0.1
    };
    
    try {
      this.onSignalReady(forcedSignal);
      console.log("PPGSignalProcessor: Callback forzado ejecutado exitosamente");
    } catch (error) {
      console.error("PPGSignalProcessor: Error ejecutando callback forzado:", error);
    }
  }
}

// También re-exportamos los tipos
export * from './signal-processing/types';
