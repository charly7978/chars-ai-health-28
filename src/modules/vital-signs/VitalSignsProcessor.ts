
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
    };
  };
}

export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  // Almacenamos los últimos resultados válidos
  private lastValidResults: VitalSignsResult | null = null;
  
  // Calibration state
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 40;
  private readonly CALIBRATION_DURATION_MS: number = 8000; // 8 seconds
  private calibrationProgress: {
    heartRate: number;
    spo2: number;
    pressure: number;
    arrhythmia: number;
    glucose: number;
    lipids: number;
  } = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0
  };
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }

  /**
   * Starts the calibration process for all vital signs
   */
  public startCalibration(): void {
    console.log("VitalSignsProcessor: Iniciando proceso de calibración simultánea");
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    
    // Reset all calibration progress
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      glucose: 0,
      lipids: 0
    };
  }

  /**
   * Updates calibration progress based on time elapsed and samples collected
   */
  private updateCalibrationProgress(): void {
    if (!this.isCalibrating) return;
    
    const elapsedTime = Date.now() - this.calibrationStartTime;
    const elapsedPercentage = Math.min(100, (elapsedTime / this.CALIBRATION_DURATION_MS) * 100);
    const samplesPercentage = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
    
    // We use both time and samples to calculate progress
    // Different metrics calibrate at different rates
    this.calibrationProgress.heartRate = Math.min(
      elapsedPercentage * 1.2, 
      samplesPercentage * 1.3
    );
    
    this.calibrationProgress.spo2 = Math.min(
      elapsedPercentage * 1.1, 
      samplesPercentage * 1.0
    );
    
    this.calibrationProgress.pressure = Math.min(
      elapsedPercentage * 0.9, 
      samplesPercentage * 0.95
    );
    
    this.calibrationProgress.arrhythmia = Math.min(
      elapsedPercentage * 0.7, 
      samplesPercentage * 0.85
    );
    
    this.calibrationProgress.glucose = Math.min(
      elapsedPercentage * 0.8, 
      samplesPercentage * 0.9
    );
    
    this.calibrationProgress.lipids = Math.min(
      elapsedPercentage * 0.6, 
      samplesPercentage * 0.8
    );
    
    // Cap all values to 100%
    Object.keys(this.calibrationProgress).forEach(key => {
      this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 
        Math.min(100, Math.max(0, Math.round(this.calibrationProgress[key as keyof typeof this.calibrationProgress])));
    });
    
    // Check if all calibrations are complete
    if (Object.values(this.calibrationProgress).every(progress => progress >= 100)) {
      console.log("VitalSignsProcessor: Calibración completada para todos los indicadores");
      this.isCalibrating = false;
    }
  }

  /**
   * Process an incoming PPG signal and calculate vital signs
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Update calibration if active
    if (this.isCalibrating) {
      this.calibrationSamples++;
      this.updateCalibrationProgress();
    }
    
    // Filter signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Calculate vital signs
    const ppgValues = this.signalProcessor.getPPGValues();
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    // Calculate glucose level using enhanced algorithm
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    // Calculate lipid profile using advanced spectral analysis
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);

    // Construir el resultado
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose,
      lipids
    };
    
    // Add calibration info if calibrating
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    // Solo guardamos resultados válidos (valores no cero o no iniciales)
    if (spo2 > 0 && bp.systolic > 0 && bp.diastolic > 0 && glucose > 0 && lipids.totalCholesterol > 0) {
      this.lastValidResults = { ...result };
    }

    return result;
  }

  /**
   * Check if the processor is currently calibrating
   */
  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }

  /**
   * Get current calibration progress
   */
  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    if (!this.isCalibrating) return undefined;
    
    return {
      isCalibrating: true,
      progress: { ...this.calibrationProgress }
    };
  }

  /**
   * Reset all processors to their initial state
   * pero mantener los últimos resultados válidos
   */
  public reset(): VitalSignsResult | null {
    // Reseteamos los procesadores pero mantenemos los últimos resultados válidos
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.isCalibrating = false;
    
    // Retornamos los últimos resultados válidos
    return this.lastValidResults;
  }
  
  /**
   * Obtener los últimos resultados válidos
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Reset completo incluyendo los resultados almacenados
   */
  public fullReset(): void {
    this.lastValidResults = null;
    this.isCalibrating = false;
    this.reset();
  }
}
