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
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 30;
  private readonly CALIBRATION_DURATION_MS: number = 3000;
  
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
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  
  private readonly MEDIAN_WINDOW_SIZE = 5;
  private spo2Buffer: number[] = [];
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private glucoseBuffer: number[] = [];
  private cholesterolBuffer: number[] = [];
  private triglyceridesBuffer: number[] = [];
  private hemoglobinBuffer: number[] = [];

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }

  public startCalibration(): void {
    console.log("VitalSignsProcessor: Iniciando calibración avanzada");
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;
    
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
    
    for (const key in this.calibrationProgress) {
      this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 0;
    }
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      if (this.isCalibrating) {
        console.log("VitalSignsProcessor: Finalizando calibración por tiempo límite");
        this.completeCalibration();
      }
    }, this.CALIBRATION_DURATION_MS);
    
    console.log("VitalSignsProcessor: Calibración iniciada con parámetros:", {
      muestrasRequeridas: this.CALIBRATION_REQUIRED_SAMPLES,
      tiempoMáximo: this.CALIBRATION_DURATION_MS,
      inicioCalibración: new Date(this.calibrationStartTime).toISOString()
    });
  }
  
  private completeCalibration(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Completando calibración", {
      muestrasRecolectadas: this.calibrationSamples,
      muestrasRequeridas: this.CALIBRATION_REQUIRED_SAMPLES,
      duraciónMs: Date.now() - this.calibrationStartTime,
      forzado: this.forceCompleteCalibration
    });
    
    if (this.heartRateSamples.length > 5) {
      const filteredHeartRates = this.heartRateSamples.filter(v => v > 40 && v < 200);
      if (filteredHeartRates.length > 0) {
        const avgHeartRate = filteredHeartRates.reduce((a, b) => a + b, 0) / filteredHeartRates.length;
        const heartRateVariability = Math.sqrt(
          filteredHeartRates.reduce((acc, val) => acc + Math.pow(val - avgHeartRate, 2), 0) / 
          filteredHeartRates.length
        );
        
        console.log("VitalSignsProcessor: Calibración de ritmo cardíaco", {
          muestras: filteredHeartRates.length,
          promedio: avgHeartRate.toFixed(1),
          variabilidad: heartRateVariability.toFixed(2)
        });
      }
    }
    
    if (this.spo2Samples.length > 5) {
      const validSpo2 = this.spo2Samples.filter(v => v > 85 && v < 100);
      if (validSpo2.length > 0) {
        const baselineSpo2 = validSpo2.reduce((a, b) => a + b, 0) / validSpo2.length;
        
        console.log("VitalSignsProcessor: Calibración de SpO2", {
          muestras: validSpo2.length,
          nivelBase: baselineSpo2.toFixed(1)
        });
      }
    }
    
    if (this.pressureSamples.length > 5) {
      const validPressure = this.pressureSamples.filter(v => v > 30);
      if (validPressure.length > 0) {
        const baselinePressure = validPressure.reduce((a, b) => a + b, 0) / validPressure.length;
        const pressureVariability = Math.sqrt(
          validPressure.reduce((acc, val) => acc + Math.pow(val - baselinePressure, 2), 0) / 
          validPressure.length
        );
        
        console.log("VitalSignsProcessor: Calibración de presión arterial", {
          muestras: validPressure.length,
          nivelBase: baselinePressure.toFixed(1),
          variabilidad: pressureVariability.toFixed(2)
        });
      }
    }
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    this.isCalibrating = false;
    
    console.log("VitalSignsProcessor: Calibración completada exitosamente", {
      tiempoTotal: (Date.now() - this.calibrationStartTime).toFixed(0) + "ms"
    });
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    
    const mid = Math.floor(sortedValues.length / 2);
    
    if (sortedValues.length % 2 === 1) {
      return sortedValues[mid];
    }
    
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }
  
  private addToMedianBuffer(buffer: number[], value: number): void {
    if (value > 0) {
      buffer.push(value);
      
      if (buffer.length > this.MEDIAN_WINDOW_SIZE) {
        buffer.shift();
      }
    }
  }
  
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    if (this.isCalibrating) {
      this.calibrationSamples++;
      
      const elapsedTime = Date.now() - this.calibrationStartTime;
      const timeProgress = Math.min(100, (elapsedTime / this.CALIBRATION_DURATION_MS) * 100);
      const samplesProgress = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
      
      const progress = Math.min(timeProgress, samplesProgress);
      
      for (const key in this.calibrationProgress) {
        this.calibrationProgress[key as keyof typeof this.calibrationProgress] = progress;
      }
      
      if (progress >= 100 || this.forceCompleteCalibration) {
        this.completeCalibration();
      }
      
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
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
    
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    const ppgValues = this.signalProcessor.getPPGValues();
    
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    
    const hemoglobin = this.calculateHemoglobin(ppgValues);
    
    this.addToMedianBuffer(this.spo2Buffer, spo2);
    this.addToMedianBuffer(this.systolicBuffer, bp.systolic);
    this.addToMedianBuffer(this.diastolicBuffer, bp.diastolic);
    this.addToMedianBuffer(this.glucoseBuffer, glucose);
    this.addToMedianBuffer(this.cholesterolBuffer, lipids.totalCholesterol);
    this.addToMedianBuffer(this.triglyceridesBuffer, lipids.triglycerides);
    this.addToMedianBuffer(this.hemoglobinBuffer, hemoglobin);
    
    const medianSpo2 = this.calculateMedian(this.spo2Buffer);
    const medianSystolic = this.calculateMedian(this.systolicBuffer);
    const medianDiastolic = this.calculateMedian(this.diastolicBuffer);
    const medianGlucose = this.calculateMedian(this.glucoseBuffer);
    const medianCholesterol = this.calculateMedian(this.cholesterolBuffer);
    const medianTriglycerides = this.calculateMedian(this.triglyceridesBuffer);
    const medianHemoglobin = this.calculateMedian(this.hemoglobinBuffer);
    
    const medianPressure = `${Math.round(medianSystolic)}/${Math.round(medianDiastolic)}`;
    
    const result: VitalSignsResult = {
      spo2: Math.round(medianSpo2),
      pressure: medianPressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose: Math.round(medianGlucose),
      lipids: {
        totalCholesterol: Math.round(medianCholesterol),
        triglycerides: Math.round(medianTriglycerides)
      },
      hemoglobin: Number(medianHemoglobin.toFixed(1))
    };
    
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    if (medianSpo2 > 0 && medianSystolic > 0 && medianDiastolic > 0 && 
        medianGlucose > 0 && medianCholesterol > 0) {
      this.lastValidResults = { ...result };
      
      console.log("VitalSignsProcessor: Nuevos resultados medianos:", {
        spo2: { actual: spo2, mediana: medianSpo2 },
        sistólica: { actual: bp.systolic, mediana: medianSystolic },
        diastólica: { actual: bp.diastolic, mediana: medianDiastolic },
        glucosa: { actual: glucose, mediana: medianGlucose },
        colesterol: { actual: lipids.totalCholesterol, mediana: medianCholesterol }
      });
    }
    
    return result;
  }

  private calculateHemoglobin(ppgValues: number[]): number {
    if (ppgValues.length < 50) return 0;
    
    const peak = Math.max(...ppgValues);
    const valley = Math.min(...ppgValues);
    const ac = peak - valley;
    const dc = ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length;
    
    const ratio = ac / dc;
    const baseHemoglobin = 12.5;
    const hemoglobin = baseHemoglobin + (ratio - 1) * 2.5;
    
    return Math.max(8, Math.min(18, Number(hemoglobin.toFixed(1))));
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
  }

  public reset(): VitalSignsResult | null {
    const savedResults = this.lastValidResults;
    
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    this.spo2Buffer = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.glucoseBuffer = [];
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    this.hemoglobinBuffer = [];
    
    this.isCalibrating = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    return savedResults;
  }
  
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
}
