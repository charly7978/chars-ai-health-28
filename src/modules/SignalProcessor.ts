
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
    console.log("PPGSignalProcessor wrapper: Creando instancia con callbacks explícitos:", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
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
    console.log("PPGSignalProcessor wrapper: Inicializando con callbacks", {
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
    // VERIFICACIÓN CRÍTICA: Asegurar que los callbacks están correctamente configurados
    if (this.onSignalReady && super.onSignalReady !== this.onSignalReady) {
      console.log("PPGSignalProcessor wrapper: Actualizando onSignalReady callback");
      super.onSignalReady = this.onSignalReady;
    }
    
    if (this.onError && super.onError !== this.onError) {
      console.log("PPGSignalProcessor wrapper: Actualizando onError callback");
      super.onError = this.onError;
    }
    
    // Dar más información para debug
    console.log("PPGSignalProcessor wrapper: Procesando frame", {
      hasOnSignalReadyCallback: !!this.onSignalReady,
      superHasCallback: !!super.onSignalReady,
      imageSize: `${imageData.width}x${imageData.height}`,
      timestamp: new Date().toISOString()
    });
    
    // Si no se ha inicializado, hacerlo ahora
    if (!this.isInitialized) {
      console.log("PPGSignalProcessor: Inicializando en processFrame");
      this.initialize().then(() => {
        console.log("PPGSignalProcessor: Inicializado correctamente, procesando frame");
        // Llamar al método de la clase padre
        super.processFrame(imageData);
      }).catch(error => {
        console.error("PPGSignalProcessor: Error al inicializar", error);
      });
    } else {
      // Llamar al método de la clase padre
      super.processFrame(imageData);
    }
  }
}

// También re-exportamos los tipos
export * from './signal-processing/types';
