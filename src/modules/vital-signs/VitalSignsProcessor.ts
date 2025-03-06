
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';

/**
 * VitalSignsProcessor
 * 
 * Procesador integrado de signos vitales que implementa algoritmos avanzados
 * para el análisis de señales PPG en tiempo real.
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
  }

  /**
   * Procesa una señal PPG entrante y calcula los signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
    // Filtrar señal usando algoritmos avanzados
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Calcular características fisiológicas
    const physFeatures = this.signalProcessor.calculatePhysiologicalFeatures();
    
    // Detectar picos para análisis de ritmo cardíaco
    const peaks = this.signalProcessor.detectPeaks();
    
    // Procesar datos de arritmia con algoritmo mejorado
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Calcular signos vitales basados en la señal filtrada
    const ppgValues = this.signalProcessor.getPPGValues();
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = `${bp.systolic}/${bp.diastolic}`;

    return {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      signalQuality: physFeatures.signalQuality,
      perfusionIndex: physFeatures.perfusionIndex
    };
  }

  /**
   * Reinicia todos los procesadores a su estado inicial
   */
  public reset(): void {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
  }
}
