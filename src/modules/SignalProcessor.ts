
// Este archivo exporta el PPGSignalProcessor desde la estructura refactorizada
// para mantener compatibilidad con versiones anteriores
import { PPGSignalProcessor as OriginalPPGSignalProcessor } from './signal-processing/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Creamos una versión envuelta para asegurar que los callbacks se pasen correctamente
export class PPGSignalProcessor implements OriginalPPGSignalProcessor {
  private processor: OriginalPPGSignalProcessor;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("SignalProcessor wrapper: Creando instancia con callbacks explícitos:", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    // Pasar los callbacks explícitamente al constructor
    this.processor = new OriginalPPGSignalProcessor(onSignalReady, onError);
  }

  // Implementar todos los métodos de la interfaz
  async initialize(): Promise<void> {
    return this.processor.initialize();
  }

  start(): void {
    this.processor.start();
  }

  stop(): void {
    this.processor.stop();
  }

  async calibrate(): Promise<boolean> {
    return this.processor.calibrate();
  }

  processFrame(imageData: ImageData): void {
    // Asegurarnos que al procesar el frame, usamos los callbacks actualizados
    if (this.onSignalReady && this.processor.onSignalReady !== this.onSignalReady) {
      console.log("SignalProcessor wrapper: Actualizando onSignalReady callback");
      this.processor.onSignalReady = this.onSignalReady;
    }
    
    if (this.onError && this.processor.onError !== this.onError) {
      console.log("SignalProcessor wrapper: Actualizando onError callback");
      this.processor.onError = this.onError;
    }
    
    this.processor.processFrame(imageData);
  }
}

// También re-exportamos los tipos
export * from './signal-processing/types';
