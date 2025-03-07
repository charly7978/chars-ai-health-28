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

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();

    // Cargar calibración previa si existe
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
    
    // Iniciar calibración en cada procesador
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
    // Calcular calidad de señal basada en variabilidad y estabilidad
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
  ): VitalSignsResult | null {
    const timestamp = Date.now();
    const signalQuality = this.updateSignalQuality(ppgValue);

    if (this.isCalibrating) {
      this.calibrationSamples++;
      
      // Solo procesar muestras con calidad suficiente
      if (signalQuality >= this.MIN_CALIBRATION_QUALITY) {
        this.spo2Samples.push(ppgValue);
        this.pressureSamples.push(ppgValue);
        this.heartRateSamples.push(ppgValue);
        
        // Actualizar progreso basado en muestras válidas
        const progress = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
        this.updateCalibrationProgress(progress);
        
        // Verificar si tenemos suficientes muestras de calidad
        if (this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES && 
            this.getAverageSignalQuality() >= this.SIGNAL_QUALITY_THRESHOLD) {
          this.completeCalibration();
        }
      }

      // Timeout de seguridad
      if (timestamp - this.calibrationStartTime > this.CALIBRATION_DURATION_MS) {
        if (this.getAverageSignalQuality() >= this.MIN_CALIBRATION_QUALITY) {
          this.completeCalibration();
        } else {
          console.warn("Calibración fallida por baja calidad de señal");
          this.reset();
        }
      }

      return {
        timestamp,
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: `CALIBRANDO...|${Math.round(this.getCalibrationProgress().progress.heartRate)}`,
        lastArrhythmiaData: null,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0,
        calibration: this.getCalibrationProgress()
      };
    }

    // Procesar señal solo si la calidad es suficiente
    if (signalQuality < this.MIN_CALIBRATION_QUALITY) {
      return this.lastValidResults || {
        timestamp,
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "SEÑAL DÉBIL|0",
        lastArrhythmiaData: null,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      };
    }

    // Procesar con cada procesador especializado
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Procesar arritmias
    const arrhythmiaResult = this.arrhythmiaProcessor.processHeartbeat(filtered, rrData?.intervals || []);
    
    // Calcular valores vitales
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues);
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues);
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const hemoglobin = this.calculateHemoglobin(ppgValues);

    // Aplicar filtro de mediana a los resultados
    this.updateMedianBuffers(spo2, bp, glucose, lipids, hemoglobin);
    
    const result: VitalSignsResult = {
      timestamp,
      spo2: this.getMedianSpo2(),
      pressure: this.getMedianPressure(),
      arrhythmiaStatus: arrhythmiaResult.status,
      lastArrhythmiaData: arrhythmiaResult.data,
      glucose: this.getMedianGlucose(),
      lipids: {
        totalCholesterol: this.getMedianCholesterol(),
        triglycerides: this.getMedianTriglycerides()
      },
      hemoglobin: this.getMedianHemoglobin()
    };

    this.lastValidResults = result;
    return result;
  }

  private getAverageSignalQuality(): number {
    if (this.signalQualityBuffer.length === 0) return 0;
    return this.signalQualityBuffer.reduce((a, b) => a + b, 0) / this.signalQualityBuffer.length;
  }

  private calculateHemoglobin(ppgValues: number[]): number {
    if (ppgValues.length < 50) return 0;
    
    // Calculate using real PPG data based on absorption characteristics
    const peak = Math.max(...ppgValues);
    const valley = Math.min(...ppgValues);
    const ac = peak - valley;
    const dc = ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length;
    
    // Beer-Lambert law application for hemoglobin estimation
    const ratio = ac / dc;
    const baseHemoglobin = 12.5;
    const hemoglobin = baseHemoglobin + (ratio - 1) * 2.5;
    
    // Clamp to physiologically relevant range
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

  public completeCalibration(): void {
    if (this.isCalibrating) {
      console.log("Forzando finalización de calibración");
      this.isCalibrating = false;
      this.calibrationStartTime = Date.now();
      
      // Asegurar que todos los procesadores completen su calibración
      this.arrhythmiaProcessor.completeCalibration();
      
      // Actualizar el progreso de calibración a 100%
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

  private getMedianSpo2(): number {
    if (this.spo2Samples.length === 0) return 0;
    return this.calculateMedian(this.spo2Samples);
  }

  private getMedianPressure(): string {
    if (this.pressureSamples.length < 2) return "--/--";
    const sorted = [...this.pressureSamples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return `${Math.round(sorted[mid - 1])}/${Math.round(sorted[mid])}`;
  }

  private getMedianGlucose(): number {
    if (this.glucoseSamples.length === 0) return 0;
    return this.calculateMedian(this.glucoseSamples);
  }

  private getMedianCholesterol(): number {
    if (this.lipidSamples.length === 0) return 0;
    return this.calculateMedian(this.lipidSamples);
  }

  private getMedianTriglycerides(): number {
    if (this.lipidSamples.length === 0) return 0;
    return this.calculateMedian(this.lipidSamples);
  }

  private getMedianHemoglobin(): number {
    if (this.heartRateSamples.length === 0) return 0;
    return this.calculateMedian(this.heartRateSamples);
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Crear una copia y ordenarla para no modificar el original
    const sortedValues = [...values].sort((a, b) => a - b);
    
    const mid = Math.floor(sortedValues.length / 2);
    
    // Si hay un número impar de elementos, la mediana es el valor central
    if (sortedValues.length % 2 === 1) {
      return sortedValues[mid];
    }
    
    // Si hay un número par de elementos, la mediana es el promedio de los dos centrales
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }

  /**
   * Resetea el procesador de signos vitales
   */
  public reset(): VitalSignsResult | null {
    // Guardar resultados válidos antes de resetear
    const savedResults = this.lastValidResults;
    
    // Resetear procesadores individuales
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    // Resetear buffers de mediana
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
    
    // Resetear estado de calibración
    this.isCalibrating = false;
    
    return savedResults;
  }
  
  /**
   * Obtener los últimos resultados válidos
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Reseteo completo incluyendo resultados guardados
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
}
