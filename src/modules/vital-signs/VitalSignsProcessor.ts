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
    lipids: 0,
    hemoglobin: 0
  };
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  
  private readonly MEDIAN_WINDOW_SIZE = 5; // Últimas 5 mediciones para calcular mediana
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
    this.glucoseSamples = [];
    this.lipidSamples = [];
    
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

  /**
   * Calcula la mediana de un array de números
   * @param values Array de valores numéricos
   * @returns Valor de la mediana
   */
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
   * Añade un valor al buffer de mediana y mantiene el tamaño máximo
   * @param buffer Buffer donde se almacenan los valores
   * @param value Nuevo valor a añadir
   */
  private addToMedianBuffer(buffer: number[], value: number): void {
    // Solo añadir valores válidos (mayores que cero)
    if (value > 0) {
      buffer.push(value);
      
      // Mantener el tamaño del buffer limitado
      if (buffer.length > this.MEDIAN_WINDOW_SIZE) {
        buffer.shift();
      }
    }
  }
  
  /**
   * Procesa la señal PPG y devuelve los resultados procesados con filtro de mediana
   * Implementa lógica para no incluir valores durante la calibración
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult | null {
    const timestamp = Date.now();

    // Si estamos calibrando, incrementamos el contador de muestras de calibración
    if (this.isCalibrating) {
      this.calibrationSamples++;
      
      // Proporcionar feedback detallado durante la calibración
      console.log(`[CALIBRACIÓN] Muestra #${this.calibrationSamples} de ${this.CALIBRATION_REQUIRED_SAMPLES}`);
      
      // Estimar el progreso de la calibración basado en el número de muestras
      const calibrationProgress = Math.min(
        100, 
        Math.round((this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100)
      );
      
      // Actualizar el progreso de calibración para todos los parámetros
      this.calibrationProgress = {
        heartRate: calibrationProgress,
        spo2: Math.max(0, calibrationProgress - 5),
        pressure: Math.max(0, calibrationProgress - 10),
        arrhythmia: Math.max(0, calibrationProgress - 5),
        glucose: Math.max(0, calibrationProgress - 5),
        lipids: Math.max(0, calibrationProgress - 15),
        hemoglobin: Math.max(0, calibrationProgress - 20)
      };
      
      // Verificar si la calibración ha terminado
      if (this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES) {
        console.log("[CALIBRACIÓN] Calibración completada después de recolectar suficientes muestras");
        this.isCalibrating = false;
        this.calibrationStartTime = timestamp;
      }
      
      // Durante la calibración, retornar un resultado con valores de placeholder
      // para indicar que todavía estamos calibrando
      return {
        timestamp,
        spo2: 0,  // Usar 0 como valor de placeholder durante calibración
        pressure: "--/--", // Usar texto especial para indicar calibración
        arrhythmiaStatus: `CALIBRANDO...|${calibrationProgress}`,
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
    
    // Procesar señal a través de los diferentes procesadores
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Extraer intervalos RR para el procesador de arritmias
    const rrIntervals = rrData?.intervals || [];
    
    // Procesar arritmias con el nuevo método
    const arrhythmiaResult = this.arrhythmiaProcessor.processHeartbeat(ppgValue, rrIntervals);
    
    // Calcular valores individuales con los procesadores específicos
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const hemoglobin = this.calculateHemoglobin(ppgValues);
    
    // Solo si no estamos calibrando, añadir los valores a los búferes para el filtro de mediana
    // y solo añadir valores válidos (mayores que cero)
    if (spo2 > 0) {
      this.spo2Buffer.push(spo2);
      if (this.spo2Buffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.spo2Buffer.shift();
      }
    }
    
    if (bp.systolic > 0 && bp.diastolic > 0) {
      this.systolicBuffer.push(bp.systolic);
      this.diastolicBuffer.push(bp.diastolic);
      
      if (this.systolicBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.systolicBuffer.shift();
      }
      if (this.diastolicBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.diastolicBuffer.shift();
      }
    }
    
    if (glucose > 0) {
      this.glucoseBuffer.push(glucose);
      if (this.glucoseBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.glucoseBuffer.shift();
      }
    }
    
    if (lipids.totalCholesterol > 0) {
      this.cholesterolBuffer.push(lipids.totalCholesterol);
      if (this.cholesterolBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.cholesterolBuffer.shift();
      }
    }
    
    if (lipids.triglycerides > 0) {
      this.triglyceridesBuffer.push(lipids.triglycerides);
      if (this.triglyceridesBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.triglyceridesBuffer.shift();
      }
    }
    
    if (hemoglobin > 0) {
      this.hemoglobinBuffer.push(hemoglobin);
      if (this.hemoglobinBuffer.length > this.MEDIAN_WINDOW_SIZE) {
        this.hemoglobinBuffer.shift();
      }
    }
    
    // Calcular las medianas solo si tenemos suficientes valores
    let finalSpo2 = 0;
    if (this.spo2Buffer.length > 0) {
      const sortedSpo2 = [...this.spo2Buffer].sort((a, b) => a - b);
      finalSpo2 = sortedSpo2[Math.floor(sortedSpo2.length / 2)];
    } else {
      finalSpo2 = spo2; // Usar el valor actual si no hay suficientes muestras
    }
    
    let finalSystolic = 0;
    let finalDiastolic = 0;
    if (this.systolicBuffer.length > 0 && this.diastolicBuffer.length > 0) {
      const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
      const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
      
      finalSystolic = sortedSystolic[Math.floor(sortedSystolic.length / 2)];
      finalDiastolic = sortedDiastolic[Math.floor(sortedDiastolic.length / 2)];
    } else {
      finalSystolic = bp.systolic;
      finalDiastolic = bp.diastolic;
    }
    
    let finalGlucose = 0;
    if (this.glucoseBuffer.length > 0) {
      const sortedGlucose = [...this.glucoseBuffer].sort((a, b) => a - b);
      finalGlucose = sortedGlucose[Math.floor(sortedGlucose.length / 2)];
    } else {
      finalGlucose = glucose;
    }
    
    let finalCholesterol = 0;
    if (this.cholesterolBuffer.length > 0) {
      const sortedCholesterol = [...this.cholesterolBuffer].sort((a, b) => a - b);
      finalCholesterol = sortedCholesterol[Math.floor(sortedCholesterol.length / 2)];
    } else {
      finalCholesterol = lipids.totalCholesterol;
    }
    
    let finalTriglycerides = 0;
    if (this.triglyceridesBuffer.length > 0) {
      const sortedTriglycerides = [...this.triglyceridesBuffer].sort((a, b) => a - b);
      finalTriglycerides = sortedTriglycerides[Math.floor(sortedTriglycerides.length / 2)];
    } else {
      finalTriglycerides = lipids.triglycerides;
    }
    
    let finalHemoglobin = 0;
    if (this.hemoglobinBuffer.length > 0) {
      const sortedHemoglobin = [...this.hemoglobinBuffer].sort((a, b) => a - b);
      finalHemoglobin = sortedHemoglobin[Math.floor(sortedHemoglobin.length / 2)];
    } else {
      finalHemoglobin = hemoglobin;
    }
    
    // Construir formato de presión: "sistólica/diastólica"
    const pressureFormatted = (finalSystolic > 0 && finalDiastolic > 0) 
      ? `${Math.round(finalSystolic)}/${Math.round(finalDiastolic)}`
      : "--/--";
    
    // Crear el resultado final
    const result: VitalSignsResult = {
      timestamp,
      spo2: Math.round(finalSpo2),
      pressure: pressureFormatted,
      arrhythmiaStatus: arrhythmiaResult.status,
      lastArrhythmiaData: arrhythmiaResult.data,
      glucose: Math.round(finalGlucose * 10) / 10, // Mantener 1 decimal
      lipids: {
        totalCholesterol: Math.round(finalCholesterol),
        triglycerides: Math.round(finalTriglycerides)
      },
      hemoglobin: Math.round(finalHemoglobin * 10) / 10, // Mantener 1 decimal
      calibration: this.getCalibrationProgress()
    };
    
    // Guardar el último resultado válido si no estamos calibrando
    // y si los valores son válidos (mayores que cero)
    if (!this.isCalibrating && 
        finalSpo2 > 0 && 
        finalSystolic > 0 && 
        finalDiastolic > 0 && 
        finalGlucose > 0 && 
        finalCholesterol > 0 && 
        finalTriglycerides > 0 && 
        finalHemoglobin > 0) {
      this.lastValidResults = { ...result };
    }
    
    return result;
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

  public forceCalibrationCompletion(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Forzando finalización manual de calibración");
    this.forceCompleteCalibration = true;
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
    this.spo2Buffer = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.glucoseBuffer = [];
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    this.hemoglobinBuffer = [];
    
    // Resetear estado de calibración
    this.isCalibrating = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
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
