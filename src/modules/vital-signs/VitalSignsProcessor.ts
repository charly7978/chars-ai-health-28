import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
  apneaDetection: {
    isDetected: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    count: number;
  };
  concussionAssessment: {
    score: number;
    pupilResponseTime: number;
    pupilSize: number;
  };
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      apnea: number;
      concussion: number;
    };
  };
}

export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private apneaDetector: any;
  private concussionDetector: any;
  
  private lastValidResults: VitalSignsResult | null = null;
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 40;
  private readonly CALIBRATION_DURATION_MS: number = 6000;
  
  private spo2Samples: number[] = [];
  private pressureSamples: number[] = [];
  private heartRateSamples: number[] = [];
  
  private calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    apnea: 0,
    concussion: 0
  };

  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    
    // Inicializar detectores de apnea y conmoción cerebral
    const { ApneaDetector } = require('../signal-processing/ApneaDetector');
    const { ConcussionDetector } = require('../signal-processing/ConcussionDetector');
    this.apneaDetector = new ApneaDetector();
    this.concussionDetector = new ConcussionDetector();
  }

  /**
   * Inicia el proceso de calibración que analiza y optimiza los algoritmos
   * para las condiciones específicas del usuario y dispositivo
   */
  public startCalibration(): void {
    console.log("VitalSignsProcessor: Iniciando calibración avanzada");
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;
    
    // Resetear muestras de calibración
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    
    // Resetear progreso de calibración
    for (const key in this.calibrationProgress) {
      this.calibrationProgress[key as keyof typeof this.calibrationProgress] = 0;
    }
    
    // Establecer un temporizador de seguridad para finalizar la calibración
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
  
  /**
   * Finaliza el proceso de calibración y aplica los parámetros optimizados
   */
  private completeCalibration(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Completando calibración", {
      muestrasRecolectadas: this.calibrationSamples,
      muestrasRequeridas: this.CALIBRATION_REQUIRED_SAMPLES,
      duraciónMs: Date.now() - this.calibrationStartTime,
      forzado: this.forceCompleteCalibration
    });
    
    // Limpiar el temporizador de seguridad
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    // Marcar calibración como completada
    this.isCalibrating = false;
    
    console.log("VitalSignsProcessor: Calibración completada exitosamente", {
      tiempoTotal: (Date.now() - this.calibrationStartTime).toFixed(0) + "ms"
    });
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Si el valor es muy bajo, se asume que no hay dedo => no medir nada
    if (ppgValue < 0.1) {
      console.log("VitalSignsProcessor: No se detecta dedo, retornando resultados previos.");
      return this.lastValidResults || {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        apneaDetection: {
          isDetected: false,
          severity: 'none',
          count: 0
        },
        concussionAssessment: {
          score: 0,
          pupilResponseTime: 0,
          pupilSize: 0
        }
      };
    }

    if (this.isCalibrating) {
      this.calibrationSamples++;
    }
    
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los últimos valores de PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Calcular SpO2 usando datos reales de la señal
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    
    // La presión arterial se calcula usando el módulo blood-pressure-processor
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    // Procesar apnea y conmoción cerebral
    const apneaResult = this.apneaDetector ? this.apneaDetector.processAudioBlock(ppgValues) : {
      isDetected: false,
      severity: 'none',
      count: 0
    };
    const concussionResult = this.concussionDetector ? this.concussionDetector.processFrame(ppgValues) : {
      score: 0,
      pupilResponseTime: 0,
      pupilSize: 0
    };

    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      apneaDetection: apneaResult,
      concussionAssessment: concussionResult
    };
    
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    if (spo2 > 0 && bp.systolic > 0 && bp.diastolic > 0 && apneaResult && concussionResult) {
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
  }

  public reset(): VitalSignsResult | null {
    const last = this.lastValidResults;
    this.lastValidResults = null;
    return last;
  }
  
  public fullReset(): void {
    this.lastValidResults = null;
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.isCalibrating = false;
    this.calibrationSamples = 0;
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      apnea: 0,
      concussion: 0
    };
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
  }
}
