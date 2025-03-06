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
  
  private spo2Samples: number[] = [];
  private pressureSamples: number[] = [];
  private heartRateSamples: number[] = [];
  private glucoseSamples: number[] = [];
  private lipidSamples: number[] = [];
  
  private calibrationProgress = {
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
    console.log("VitalSignsProcessor: Iniciando calibración real");
    this.isCalibrating = true;
    this.forceCompleteCalibration = false;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
    
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
    
    const ppgValues = this.signalProcessor.getPPGValues();
    if (ppgValues.length < 5) return;
    
    const latestPPG = ppgValues.slice(-60);
    if (latestPPG.length >= 30) {
      const spo2Value = this.spo2Processor.calculateSpO2(latestPPG);
      if (spo2Value > 0) {
        this.spo2Samples.push(spo2Value);
        this.calibrationProgress.spo2 = Math.min(100, (this.spo2Samples.length / 20) * 100);
      }
    }
    
    if (latestPPG.length >= 40) {
      const bp = this.bpProcessor.calculateBloodPressure(latestPPG);
      if (bp.systolic > 0 && bp.diastolic > 0) {
        this.pressureSamples.push(bp.systolic + bp.diastolic);
        this.calibrationProgress.pressure = Math.min(100, (this.pressureSamples.length / 15) * 100);
      }
    }
    
    if (latestPPG.length >= 30) {
      const peaks = this.detectPeaks(latestPPG);
      if (peaks > 0) {
        this.heartRateSamples.push(peaks);
        this.calibrationProgress.heartRate = Math.min(100, (this.heartRateSamples.length / 25) * 100);
      }
    }
    
    if (latestPPG.length >= 50) {
      const glucose = this.glucoseProcessor.calculateGlucose(latestPPG);
      if (glucose > 0) {
        this.glucoseSamples.push(glucose);
        this.calibrationProgress.glucose = Math.min(100, (this.glucoseSamples.length / 18) * 100);
      }
    }
    
    if (latestPPG.length >= 50) {
      const lipids = this.lipidProcessor.calculateLipids(latestPPG);
      if (lipids.totalCholesterol > 0) {
        this.lipidSamples.push(lipids.totalCholesterol);
        this.calibrationProgress.lipids = Math.min(100, (this.lipidSamples.length / 18) * 100);
      }
    }
    
    this.calibrationProgress.arrhythmia = Math.min(
      this.calibrationProgress.heartRate,
      this.calibrationProgress.pressure
    );
    
    const elapsedTime = Date.now() - this.calibrationStartTime;
    
    if (this.forceCompleteCalibration || elapsedTime >= this.CALIBRATION_DURATION_MS) {
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
    
    if (Object.values(this.calibrationProgress).every(progress => progress >= 100)) {
      console.log("VitalSignsProcessor: Calibración real completada");
      this.isCalibrating = false;
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
    }
  }

  private detectPeaks(signal: number[]): number {
    let peaks = 0;
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        peaks++;
      }
    }
    return peaks;
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
