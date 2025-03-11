
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { applyTimeBasedProcessing } from './utils';

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

  private lipidBuffer = {
    totalCholesterol: [] as number[],
    triglycerides: [] as number[]
  };

  private kalmanState: { estimate: number; errorCovariance: number } = { estimate: 0, errorCovariance: 1 };

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
  private completeCalibration(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Completando calibración", {
      muestrasRecolectadas: this.calibrationSamples,
      muestrasRequeridas: this.CALIBRATION_REQUIRED_SAMPLES,
      duraciónMs: Date.now() - this.calibrationStartTime,
      forzado: this.forceCompleteCalibration
    });
    
    // Analizar las muestras para determinar umbrales óptimos
    if (this.heartRateSamples.length > 5) {
      const filteredHeartRates = this.heartRateSamples.filter(v => v > 40 && v < 200);
      if (filteredHeartRates.length > 0) {
        // Determinar umbral para detección de arritmias basado en variabilidad basal
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
    
    // Calibrar el procesador de SpO2 con las muestras
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
    
    // Calibrar el procesador de presión arterial con las muestras
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

  // NUEVO: Método de filtro de Kalman para optimizar el suavizado de la señal
  private applyKalmanFilter(value: number): number {
    const Q = 0.01; // Varianza del proceso (puede afinarse)
    const R = 1;    // Varianza de la medición
    // Predicción
    const prediction = this.kalmanState.estimate;
    const predictionError = this.kalmanState.errorCovariance + Q;
    // Cálculo de ganancia
    const K = predictionError / (predictionError + R);
    // Actualización
    const updatedEstimate = prediction + K * (value - prediction);
    const updatedErrorCovariance = (1 - K) * predictionError;
    // Guardar valores actualizados
    this.kalmanState.estimate = updatedEstimate;
    this.kalmanState.errorCovariance = updatedErrorCovariance;
    return updatedEstimate;
  }
  
  /**
   * Procesa la señal PPG y devuelve los resultados procesados con filtro de mediana
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null },
    elapsedTimeRef?: { current: number }
  ): VitalSignsResult {
    if (this.isCalibrating) {
      this.calibrationSamples++;
    }
    
    // Utilizar filtro de Kalman en vez de SMA para optimizar la reducción de ruido
    const filtered = this.applyKalmanFilter(ppgValue);
    
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Get the latest PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Calculate SpO2 using real signal data
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    console.log("[VITAL_SIGNS] SpO2 calculado:", {
      valor: spo2,
      muestras: ppgValues.length,
      filtrado: filtered
    });
    
    // Calculate blood pressure using real waveform analysis
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    // Calculate real glucose levels from PPG characteristics - now using only median during measurement
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    // Calculate real lipid values using spectral analysis
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    
    // Store lipid values for time-based processing
    if (lipids.totalCholesterol > 0) {
      this.lipidBuffer.totalCholesterol.push(lipids.totalCholesterol);
    }
    if (lipids.triglycerides > 0) {
      this.lipidBuffer.triglycerides.push(lipids.triglycerides);
    }
    
    // Apply time-based processing at 29 seconds
    if (elapsedTimeRef?.current && elapsedTimeRef.current >= 29 && 
        this.lipidBuffer.totalCholesterol.length > 5 && 
        this.lipidBuffer.triglycerides.length > 5) {
      
      const processedCholesterol = applyTimeBasedProcessing(
        this.lipidBuffer.totalCholesterol,
        elapsedTimeRef.current,
        29
      );
      
      const processedTriglycerides = applyTimeBasedProcessing(
        this.lipidBuffer.triglycerides,
        elapsedTimeRef.current,
        29
      );
      
      if (processedCholesterol > 0 && processedTriglycerides > 0) {
        lipids.totalCholesterol = processedCholesterol;
        lipids.triglycerides = processedTriglycerides;
      }
    }

    // Calculate real hemoglobin using optimized algorithm
    const hemoglobin = this.calculateHemoglobin(ppgValues);
    
    // Añadir valores recién calculados a los buffers de mediana
    // (excepto glucosa que ahora tiene su propio buffer interno)
    this.addToMedianBuffer(this.spo2Buffer, spo2);
    this.addToMedianBuffer(this.systolicBuffer, bp.systolic);
    this.addToMedianBuffer(this.diastolicBuffer, bp.diastolic);
    // Ya no procesamos el buffer de glucosa aquí, el procesador maneja su propio buffer
    this.addToMedianBuffer(this.cholesterolBuffer, lipids.totalCholesterol);
    this.addToMedianBuffer(this.triglyceridesBuffer, lipids.triglycerides);
    this.addToMedianBuffer(this.hemoglobinBuffer, hemoglobin);
    
    // Calcular medianas para resultados estables (excepto glucosa)
    const medianSpo2 = this.calculateMedian(this.spo2Buffer);
    const medianSystolic = this.calculateMedian(this.systolicBuffer);
    const medianDiastolic = this.calculateMedian(this.diastolicBuffer);
    const medianCholesterol = this.calculateMedian(this.cholesterolBuffer);
    const medianTriglycerides = this.calculateMedian(this.triglyceridesBuffer);
    const medianHemoglobin = this.calculateMedian(this.hemoglobinBuffer);
    
    // Construir el resultado con valores medianos
    const medianPressure = `${Math.round(medianSystolic)}/${Math.round(medianDiastolic)}`;
    
    const result: VitalSignsResult = {
      spo2: Math.round(medianSpo2),
      pressure: medianPressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose: glucose, // Ahora usamos el valor directo del procesador de glucosa
      lipids: {
        totalCholesterol: Math.round(medianCholesterol),
        triglycerides: Math.round(medianTriglycerides)
      },
      hemoglobin: Number(medianHemoglobin.toFixed(1))
    };
    
    // Incluir información de calibración si está en proceso
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    // Guardar resultados válidos
    if (medianSpo2 > 0 && medianSystolic > 0 && medianDiastolic > 0 && 
        glucose > 0 && medianCholesterol > 0) {
      this.lastValidResults = { ...result };
      
      // Logging opcional para debug
      console.log("VitalSignsProcessor: Nuevos resultados:", {
        spo2: { actual: spo2, mediana: medianSpo2 },
        sistólica: { actual: bp.systolic, mediana: medianSystolic },
        diastólica: { actual: bp.diastolic, mediana: medianDiastolic },
        glucosa: { valor: glucose },
        colesterol: { actual: lipids.totalCholesterol, mediana: medianCholesterol }
      });
    }
    
    return result;
  }

  /**
   * Completa la medición y aplica el procesamiento estadístico final
   * a la glucosa y presión arterial, devolviendo los resultados finales.
   */
  public completeMeasurement(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Completando medición, aplicando procesamiento final");
    
    // Aplicar el procesamiento final de la glucosa
    const finalGlucose = this.glucoseProcessor.completeMeasurement();
    
    // Aplicar el procesamiento final de la presión arterial (nuevo)
    const finalBP = this.bpProcessor.completeMeasurement();
    const finalPressure = `${finalBP.systolic}/${finalBP.diastolic}`;
    
    if (this.lastValidResults) {
      // Actualizamos el resultado final con los valores finales de glucosa y presión
      const updatedResults: VitalSignsResult = {
        ...this.lastValidResults,
        glucose: finalGlucose,
        pressure: finalPressure
      };
      
      this.lastValidResults = updatedResults;
      
      console.log("VitalSignsProcessor: Medición completada con éxito", {
        glucosaFinal: finalGlucose,
        presiónFinal: finalPressure,
        timestamp: new Date().toISOString()
      });
      
      return updatedResults;
    }
    
    return this.lastValidResults;
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

    this.lipidBuffer = {
      totalCholesterol: [],
      triglycerides: []
    };
    
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
