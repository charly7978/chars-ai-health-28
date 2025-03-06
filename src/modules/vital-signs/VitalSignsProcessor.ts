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
  
  private lastValidResults: VitalSignsResult | null = null;
  
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 40;
  private readonly CALIBRATION_DURATION_MS: number = 6000;
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
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }

  public startCalibration(): void {
    console.log("VitalSignsProcessor: Iniciando proceso de calibración simultánea");
    this.isCalibrating = true;
    this.forceCompleteCalibration = false;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      glucose: 0,
      lipids: 0
    };
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      console.log("VitalSignsProcessor: Forzando finalización de calibración por timeout");
      this.forceCompleteCalibration = true;
    }, this.CALIBRATION_DURATION_MS + 500);
  }

  private updateCalibrationProgress(): void {
    if (!this.isCalibrating) return;
    
    const elapsedTime = Date.now() - this.calibrationStartTime;
    const elapsedPercentage = Math.min(100, (elapsedTime / this.CALIBRATION_DURATION_MS) * 100);
    const samplesPercentage = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
    
    if (this.forceCompleteCalibration || elapsedTime >= this.CALIBRATION_DURATION_MS) {
      console.log("VitalSignsProcessor: Completando calibración forzadamente", {
        porTimeout: this.forceCompleteCalibration,
        tiempoTranscurrido: elapsedTime,
        porcentajeTranscurrido: elapsedPercentage
      });
      
      Object.keys(this.calibrationProgress).forEach(key => {
        this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 100;
      });
      
      this.isCalibrating = false;
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
      return;
    }
    
    const accelerationFactor = 1.5;
    
    this.calibrationProgress.heartRate = Math.min(
      elapsedPercentage * 1.2 * accelerationFactor, 
      samplesPercentage * 1.3 * accelerationFactor
    );
    
    this.calibrationProgress.spo2 = Math.min(
      elapsedPercentage * 1.1 * accelerationFactor, 
      samplesPercentage * 1.0 * accelerationFactor
    );
    
    this.calibrationProgress.pressure = Math.min(
      elapsedPercentage * 0.9 * accelerationFactor, 
      samplesPercentage * 0.95 * accelerationFactor
    );
    
    this.calibrationProgress.arrhythmia = Math.min(
      elapsedPercentage * 0.7 * accelerationFactor, 
      samplesPercentage * 0.85 * accelerationFactor
    );
    
    this.calibrationProgress.glucose = Math.min(
      elapsedPercentage * 0.8 * accelerationFactor, 
      samplesPercentage * 0.9 * accelerationFactor
    );
    
    this.calibrationProgress.lipids = Math.min(
      elapsedPercentage * 0.6 * accelerationFactor, 
      samplesPercentage * 0.8 * accelerationFactor
    );
    
    Object.keys(this.calibrationProgress).forEach(key => {
      this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 
        Math.min(100, Math.max(0, Math.round(this.calibrationProgress[key as keyof typeof this.calibrationProgress])));
    });
    
    if (elapsedTime > (this.CALIBRATION_DURATION_MS * 0.75)) {
      const minProgress = Math.min(...Object.values(this.calibrationProgress));
      
      if (minProgress > 85) {
        Object.keys(this.calibrationProgress).forEach(key => {
          const currentValue = this.calibrationProgress[key as keyof typeof this.calibrationProgress];
          this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 
            Math.min(100, currentValue + 5);
        });
      }
    }
    
    if (Object.values(this.calibrationProgress).every(progress => progress >= 100)) {
      console.log("VitalSignsProcessor: Calibración completada para todos los indicadores");
      this.isCalibrating = false;
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
    }
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    if (this.isCalibrating) {
      this.calibrationSamples++;
      this.updateCalibrationProgress();
    }
    
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    const ppgValues = this.signalProcessor.getPPGValues();
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);

    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose,
      lipids
    };
    
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    if (spo2 > 0 && bp.systolic > 0 && bp.diastolic > 0 && glucose > 0 && lipids.totalCholesterol > 0) {
      this.lastValidResults = { ...result };
    }

    return result;
  }

  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }

  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    if (!this.isCalibrating) return undefined;
    
    return {
      isCalibrating: true,
      progress: { ...this.calibrationProgress }
    };
  }

  public forceCalibrationCompletion(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Forzando finalización manual de calibración");
    this.forceCompleteCalibration = true;
    this.updateCalibrationProgress();
  }

  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.isCalibrating = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    return this.lastValidResults;
  }
  
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  public fullReset(): void {
    this.lastValidResults = null;
    this.isCalibrating = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    this.reset();
  }
}
