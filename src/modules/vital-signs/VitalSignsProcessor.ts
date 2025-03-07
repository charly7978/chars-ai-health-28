import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';

export interface VitalSignsResult {
  timestamp?: number;
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData: any | null;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      hemoglobin: number;
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
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 100;
  private readonly CALIBRATION_DURATION_MS: number = 10000;
  
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
    lipids: 0,
    hemoglobin: 0
  };

  private readonly SIGNAL_QUALITY_THRESHOLD = 0.75;
  private readonly MIN_CALIBRATION_QUALITY = 0.60;
  private signalQualityBuffer: number[] = [];
  private readonly QUALITY_BUFFER_SIZE = 10;

  constructor(calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0
  }) {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.calibrationProgress = calibrationProgress;

    const savedCalibration = localStorage.getItem('calibrationData');
    if (savedCalibration) {
      const calibrationData = JSON.parse(savedCalibration);
      this.bpProcessor.setCalibrationValues(calibrationData.systolic, calibrationData.diastolic);
    }
  }

  public startCalibration(): void {
    console.log("Iniciando calibración con datos reales");
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.signalQualityBuffer = [];
    this.resetCalibrationBuffers();
    
    this.spo2Processor.startCalibration();
    this.bpProcessor.startCalibration();
    this.arrhythmiaProcessor.startCalibration();
    this.glucoseProcessor.startCalibration();
    this.lipidProcessor.startCalibration();
  }

  private resetCalibrationBuffers(): void {
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
  }

  private updateSignalQuality(value: number): number {
    const normalizedValue = Math.abs(value);
    this.signalQualityBuffer.push(normalizedValue);
    
    if (this.signalQualityBuffer.length > this.QUALITY_BUFFER_SIZE) {
      this.signalQualityBuffer.shift();
    }

    if (this.signalQualityBuffer.length < 5) return 0;

    const mean = this.signalQualityBuffer.reduce((a, b) => a + b, 0) / this.signalQualityBuffer.length;
    const variance = this.signalQualityBuffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.signalQualityBuffer.length;
    const stability = Math.exp(-variance);
    
    return Math.min(1, stability * (normalizedValue > 0.1 ? 1 : 0.5));
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    const timestamp = Date.now();
    const signalQuality = this.updateSignalQuality(ppgValue);

    if (this.isCalibrating) {
      if (signalQuality >= this.MIN_CALIBRATION_QUALITY) {
        this.calibrationSamples++;
        
        this.spo2Samples.push(ppgValue);
        this.pressureSamples.push(ppgValue);
        this.heartRateSamples.push(ppgValue);
        
        const progress = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
        this.updateCalibrationProgress(progress);
        
        if (this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES) {
          this.completeCalibration();
        }
      }

      return {
        timestamp,
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "CALIBRANDO...|0",
        lastArrhythmiaData: null,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0,
        calibration: {
          isCalibrating: true,
          progress: { ...this.calibrationProgress }
        }
      };
    }

    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    const ppgValues = this.signalProcessor.getPPGValues();
    
    const arrhythmiaResult = this.arrhythmiaProcessor.processSignal(filtered, rrData?.intervals || []);
    
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues);
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues);
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const hemoglobin = this.calculateHemoglobin(ppgValues);

    this.updateMedianBuffers(spo2, bp, glucose, lipids, hemoglobin);
    
    const result: VitalSignsResult = {
      timestamp,
      spo2: this.getMedianSpo2(),
      pressure: this.getMedianPressure(),
      arrhythmiaStatus: arrhythmiaResult.status,
      lastArrhythmiaData: arrhythmiaResult.data,
      glucose: this.getMedianGlucose(),
      lipids: this.getMedianLipids(),
      hemoglobin: this.getMedianHemoglobin(),
      calibration: {
        isCalibrating: false,
        progress: {
          heartRate: 100,
          spo2: 100,
          pressure: 100,
          arrhythmia: 100,
          glucose: 100,
          lipids: 100,
          hemoglobin: 100
        }
      }
    };

    this.lastValidResults = result;
    return result;
  }

  public completeCalibration(): void {
    if (this.isCalibrating) {
      console.log("Completando calibración");
      this.isCalibrating = false;
      
      this.calibrationProgress = {
        heartRate: 100,
        spo2: 100,
        pressure: 100,
        arrhythmia: 100,
        glucose: 100,
        lipids: 100,
        hemoglobin: 100
      };
    }
  }

  private updateCalibrationProgress(progress: number): void {
    this.calibrationProgress = {
      heartRate: Math.min(100, Math.max(0, Math.round(progress))),
      spo2: Math.min(100, Math.max(0, Math.round(progress - 5))),
      pressure: Math.min(100, Math.max(0, Math.round(progress - 10))),
      arrhythmia: Math.min(100, Math.max(0, Math.round(progress - 5))),
      glucose: Math.min(100, Math.max(0, Math.round(progress - 5))),
      lipids: Math.min(100, Math.max(0, Math.round(progress - 15))),
      hemoglobin: Math.min(100, Math.max(0, Math.round(progress - 20)))
    };
  }

  private updateMedianBuffers(spo2: number, bp: { systolic: number; diastolic: number }, glucose: number, lipids: { totalCholesterol: number; triglycerides: number }, hemoglobin: number): void {
    if (spo2 > 0) {
      this.spo2Samples.push(spo2);
    }
    
    if (bp.systolic > 0 && bp.diastolic > 0) {
      this.pressureSamples.push(bp.systolic);
      this.pressureSamples.push(bp.diastolic);
    }
    
    if (glucose > 0) {
      this.glucoseSamples.push(glucose);
    }
    
    if (lipids.totalCholesterol > 0) {
      this.lipidSamples.push(lipids.totalCholesterol);
    }
    
    if (lipids.triglycerides > 0) {
      this.lipidSamples.push(lipids.triglycerides);
    }
    
    if (hemoglobin > 0) {
      this.heartRateSamples.push(hemoglobin);
    }
  }

  private getMedianValue(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private getMedianSpo2(): number {
    if (this.spo2Samples.length > 10) {
      this.spo2Samples = this.spo2Samples.slice(-10);
    }
    return Math.round(this.getMedianValue(this.spo2Samples));
  }

  private getMedianPressure(): string {
    if (this.pressureSamples.length < 2) return "--/--";
    
    if (this.pressureSamples.length > 20) {
      this.pressureSamples = this.pressureSamples.slice(-20);
    }
    
    const systolicValues = this.pressureSamples.filter((_, i) => i % 2 === 0);
    const diastolicValues = this.pressureSamples.filter((_, i) => i % 2 === 1);
    
    const systolic = Math.round(this.getMedianValue(systolicValues));
    const diastolic = Math.round(this.getMedianValue(diastolicValues));
    
    return systolic && diastolic ? `${systolic}/${diastolic}` : "--/--";
  }

  private getMedianGlucose(): number {
    if (this.glucoseSamples.length > 10) {
      this.glucoseSamples = this.glucoseSamples.slice(-10);
    }
    return Math.round(this.getMedianValue(this.glucoseSamples));
  }

  private getMedianLipids(): { totalCholesterol: number; triglycerides: number } {
    if (this.lipidSamples.length > 20) {
      this.lipidSamples = this.lipidSamples.slice(-20);
    }
    
    const cholesterolValues = this.lipidSamples.filter((_, i) => i % 2 === 0);
    const triglyceridesValues = this.lipidSamples.filter((_, i) => i % 2 === 1);
    
    return {
      totalCholesterol: Math.round(this.getMedianValue(cholesterolValues)),
      triglycerides: Math.round(this.getMedianValue(triglyceridesValues))
    };
  }

  private getMedianHemoglobin(): number {
    if (this.heartRateSamples.length > 10) {
      this.heartRateSamples = this.heartRateSamples.slice(-10);
    }
    return Math.round(this.getMedianValue(this.heartRateSamples) * 10) / 10;
  }

  public reset(): VitalSignsResult | null {
    const savedResults = this.lastValidResults;
    
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
    
    this.isCalibrating = false;
    
    return savedResults;
  }
  
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }

  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }

  public getCalibrationProgress(): any {
    return this.calibrationProgress;
  }

  private calculateHemoglobin(values: number[]): number {
    if (values.length < 30) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.max(10, Math.min(18, mean * 0.05 + 12));
  }
}
