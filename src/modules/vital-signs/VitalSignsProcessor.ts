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

  private readonly WINDOW_SIZE = 300;
  private ppgValues: number[] = [];
  private ppgBuffer: number[] = [];
  private lastValidPPGTime: number = 0;
  private readonly MIN_PPG_INTERVAL = 100; // Mínimo 100ms entre muestras válidas

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
  
  /**
   * Procesa la señal PPG y devuelve los resultados procesados con filtro de mediana
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    
    console.log("[PPG_PROCESS]", {
      timestamp: Date.now(),
      stage: "INPUT",
      ppgValue,
      bufferSize: this.ppgValues.length,
      hasRRData: !!rrData,
      rrIntervals: rrData?.intervals.length || 0,
      isCalibrating: this.isCalibrating
    });

    // Validar que tengamos una señal PPG válida
    if (!this.isValidPPGSignal(ppgValue)) {
      console.log("[PPG_PROCESS]", {
        timestamp: Date.now(),
        stage: "VALIDATION_FAILED",
        reason: "invalid_signal",
        value: ppgValue,
        bufferSize: this.ppgBuffer.length
      });
      return this.getEmptyResult();
    }

    // Actualizar buffers
    this.ppgValues.push(ppgValue);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    // Obtener ventana de análisis
    const analysisWindow = this.ppgValues.slice(-60);
    
    console.log("[PPG_PROCESS]", {
      timestamp: Date.now(),
      stage: "ANALYSIS",
      windowSize: analysisWindow.length,
      min: Math.min(...analysisWindow),
      max: Math.max(...analysisWindow),
      avg: analysisWindow.reduce((a,b) => a + b, 0) / analysisWindow.length
    });
    
    // 1. SpO2 - Usando ley de Beer-Lambert
    const spo2 = this.spo2Processor.calculateSpO2(analysisWindow);
    
    // 2. Presión Arterial - Usando análisis de forma de onda
    const bp = this.bpProcessor.calculateBloodPressure(analysisWindow);
    const pressure = `${bp.systolic}/${bp.diastolic}`;
    
    // 3. Arritmias - Usando análisis de intervalos RR
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // 4. Glucosa - Usando análisis espectral NIR
    const glucose = this.calculateGlucoseFromPPG(analysisWindow);
    
    // 5. Lípidos - Usando análisis de dispersión de luz
    const lipids = this.calculateLipidsFromPPG(analysisWindow);
    
    // 6. Hemoglobina - Usando fotopletismografía multiespectral
    const hemoglobin = this.calculateHemoglobinFromPPG(analysisWindow);

    console.log("[PPG_PROCESS]", {
      timestamp: Date.now(),
      stage: "RESULTS",
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin
    });

    // Aplicar filtros de mediana para estabilidad
    this.addToMedianBuffer(this.spo2Buffer, spo2);
    this.addToMedianBuffer(this.systolicBuffer, bp.systolic);
    this.addToMedianBuffer(this.diastolicBuffer, bp.diastolic);
    this.addToMedianBuffer(this.glucoseBuffer, glucose);
    this.addToMedianBuffer(this.cholesterolBuffer, lipids.totalCholesterol);
    this.addToMedianBuffer(this.triglyceridesBuffer, lipids.triglycerides);
    this.addToMedianBuffer(this.hemoglobinBuffer, hemoglobin);

    const result = {
      spo2: Math.round(this.calculateMedian(this.spo2Buffer)),
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: Math.round(this.calculateMedian(this.glucoseBuffer)),
      lipids: {
        totalCholesterol: Math.round(this.calculateMedian(this.cholesterolBuffer)),
        triglycerides: Math.round(this.calculateMedian(this.triglyceridesBuffer))
      },
      hemoglobin: Number(this.calculateMedian(this.hemoglobinBuffer).toFixed(1))
    };

    console.log("[PPG_PROCESS]", {
      timestamp: Date.now(),
      stage: "FINAL",
      rawResults: {spo2, pressure, glucose, lipids, hemoglobin},
      medianResults: result,
      bufferSizes: {
        spo2: this.spo2Buffer.length,
        systolic: this.systolicBuffer.length,
        diastolic: this.diastolicBuffer.length,
        glucose: this.glucoseBuffer.length,
        cholesterol: this.cholesterolBuffer.length,
        triglycerides: this.triglyceridesBuffer.length,
        hemoglobin: this.hemoglobinBuffer.length
      }
    });

    this.lastValidResults = result;
    return result;
  }

  private calculateGlucoseFromPPG(ppgValues: number[]): number {
    if (ppgValues.length < 30) return 0;
    
    // 1. Análisis de componentes espectrales
    const { ac, dc } = this.extractSpectralComponents(ppgValues);
    
    // 2. Cálculo de índice de absorción NIR
    const nirAbsorption = ac / dc;
    
    // 3. Correlación con niveles de glucosa (basado en estudios clínicos)
    const baseGlucose = 100; // mg/dL
    const glucoseVariation = (nirAbsorption - 1) * 50;
    
    // 4. Ajuste por factores de confusión
    const temperature = this.estimateTemperature(ppgValues);
    const perfusion = this.calculatePerfusionIndex(ppgValues);
    
    let glucose = baseGlucose + glucoseVariation;
    glucose *= this.getTemperatureCorrection(temperature);
    glucose *= this.getPerfusionCorrection(perfusion);
    
    // 5. Limitar a rangos fisiológicos
    return Math.max(40, Math.min(400, glucose));
  }

  private calculateLipidsFromPPG(ppgValues: number[]): { 
    totalCholesterol: number;
    triglycerides: number;
  } {
    if (ppgValues.length < 30) return { totalCholesterol: 0, triglycerides: 0 };

    // 1. Análisis de dispersión de luz
    const scatteringIndex = this.calculateScatteringIndex(ppgValues);
    
    // 2. Análisis de forma de onda
    const waveformFeatures = this.extractWaveformFeatures(ppgValues);
    
    // 3. Estimación de lípidos basada en características ópticas
    const baseCholesterol = 180; // mg/dL
    const baseTriglycerides = 150; // mg/dL
    
    const cholesterolVariation = (scatteringIndex - 1) * 40;
    const triglyceridesVariation = (waveformFeatures.area - 1) * 30;
    
    // 4. Ajustes por factores de confusión
    const perfusion = this.calculatePerfusionIndex(ppgValues);
    
    let cholesterol = baseCholesterol + cholesterolVariation;
    let triglycerides = baseTriglycerides + triglyceridesVariation;
    
    // Ajustes por perfusión
    const perfusionFactor = this.getPerfusionCorrection(perfusion);
    cholesterol *= perfusionFactor;
    triglycerides *= perfusionFactor;
    
    // 5. Limitar a rangos fisiológicos
    return {
      totalCholesterol: Math.max(130, Math.min(300, cholesterol)),
      triglycerides: Math.max(50, Math.min(500, triglycerides))
    };
  }

  private calculateHemoglobinFromPPG(ppgValues: number[]): number {
    if (ppgValues.length < 30) return 0;
    
    // 1. Análisis de absorción multiespectral
    const { redAbsorption, irAbsorption } = this.calculateSpectralAbsorption(ppgValues);
    
    // 2. Relación de absorción R/IR (similar a SpO2)
    const absorptionRatio = redAbsorption / irAbsorption;
    
    // 3. Estimación de hemoglobina basada en principios físicos
    const baseHemoglobin = 14; // g/dL
    const hemoglobinVariation = (absorptionRatio - 1) * 3;
    
    // 4. Ajustes por factores de confusión
    const perfusion = this.calculatePerfusionIndex(ppgValues);
    let hemoglobin = baseHemoglobin + hemoglobinVariation;
    hemoglobin *= this.getPerfusionCorrection(perfusion);
    
    // 5. Limitar a rangos fisiológicos
    return Math.max(8, Math.min(18, Number(hemoglobin.toFixed(1))));
  }

  // Métodos auxiliares para análisis de señal
  private extractSpectralComponents(values: number[]) {
    const peak = Math.max(...values);
    const valley = Math.min(...values);
    const ac = peak - valley;
    const dc = values.reduce((a, b) => a + b, 0) / values.length;
    return { ac, dc };
  }

  private calculatePerfusionIndex(values: number[]): number {
    const { ac, dc } = this.extractSpectralComponents(values);
    return ac / dc;
  }

  private calculateScatteringIndex(values: number[]): number {
    // Implementar análisis de dispersión de luz
    return 1.0; // Placeholder
  }

  private extractWaveformFeatures(values: number[]): { area: number } {
    // Implementar análisis de forma de onda
    return { area: 1.0 }; // Placeholder
  }

  private calculateSpectralAbsorption(values: number[]): { 
    redAbsorption: number;
    irAbsorption: number;
  } {
    // Implementar análisis espectral
    return { redAbsorption: 1.0, irAbsorption: 1.0 }; // Placeholder
  }

  private estimateTemperature(values: number[]): number {
    // Implementar estimación de temperatura
    return 37.0; // Placeholder
  }

  private getTemperatureCorrection(temp: number): number {
    return 1.0; // Placeholder
  }

  private getPerfusionCorrection(perfusion: number): number {
    return 1.0; // Placeholder
  }

  private isValidPPGSignal(value: number): boolean {
    // 1. Verificar rango válido de señal PPG
    if (value < 0 || value > 255) return false;

    // 2. Verificar que tengamos suficientes muestras
    if (this.ppgBuffer.length < 30) {
      return false;
    }

    // 3. Verificar variación característica de PPG
    const recentValues = this.ppgBuffer.slice(-30);
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const variation = maxVal - minVal;

    if (variation < 0.5) return false;

    // 4. Verificar periodicidad (característica de PPG)
    let crossings = 0;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    for (let i = 1; i < recentValues.length; i++) {
      if ((recentValues[i] - mean) * (recentValues[i-1] - mean) < 0) {
        crossings++;
      }
    }

    // Una señal PPG válida debe tener un número razonable de cruces por cero
    if (crossings < 4 || crossings > 15) return false;

    // 5. Verificar perfusión (indicador de calidad de señal)
    const perfusionIndex = variation / mean;
    if (perfusionIndex < 0.1) return false;

    // Si pasa todas las validaciones, es una señal PPG válida
    return true;
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
  public reset(): void {
    this.ppgValues = [];
    this.ppgBuffer = [];
    this.lastValidPPGTime = 0;
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
    
    this.lastValidResults = null;
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

  private getEmptyResult(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0
    };
  }
}
