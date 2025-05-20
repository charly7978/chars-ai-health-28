
// Este archivo exporta el PPGSignalProcessor desde la estructura refactorizada
// para mantener compatibilidad con versiones anteriores
import { PPGSignalProcessor as OriginalPPGSignalProcessor } from './signal-processing/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Ahora extendemos la clase original en lugar de implementar su interfaz
export class PPGSignalProcessor extends OriginalPPGSignalProcessor {
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
    
    // Llamar al método de la clase padre
    super.processFrame(imageData);
  }
  
  // Sobrescribir initialize para asegurar callbacks correctos
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
    return super.initialize();
  }
}

// También re-exportamos los tipos
export * from './signal-processing/types';
