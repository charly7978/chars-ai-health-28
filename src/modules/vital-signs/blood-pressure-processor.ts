
/**
 * Procesador avanzado de presión arterial basado en señales PPG
 * Implementa técnicas avanzadas de procesamiento de señal con índices de perfusión
 * y filtrado adaptativo para obtener mediciones limpias y precisas.
 */
import { 
  calculateAmplitude, 
  findPeaksAndValleys, 
  calculateStandardDeviation, 
  calculatePerfusionIndex,
  calculateMedian,
  calculateWeightedAverage,
  removeOutliers,
  applyHampelFilter,
  applySavitzkyGolayFilter
} from './utils';

export class BloodPressureProcessor {
  // Configuración de ventanas y buffers
  private readonly WINDOW_SIZE = 250; // ~8 segundos a 30fps
  private readonly MIN_WINDOW = 30; // Mínimo de muestras para procesar
  private readonly MEASUREMENT_BUFFER_SIZE = 25; // Buffer para mediciones en tiempo real
  private readonly FINAL_BUFFER_SIZE = 20; // Buffer para cálculo final
  private readonly COMPLETION_DELAY_MS = 2000; // 2 segundos para procesamiento final
  
  // Parámetros de validación fisiológica
  private readonly MIN_SYSTOLIC = 70;
  private readonly MAX_SYSTOLIC = 230;
  private readonly MIN_DIASTOLIC = 40;
  private readonly MAX_DIASTOLIC = 140;
  private readonly MIN_PULSE_PRESSURE = 20;
  private readonly MAX_PULSE_PRESSURE = 100;
  
  // Parámetros de calidad de señal
  private readonly MIN_PERFUSION_INDEX = 0.3; // Mínimo para mediciones válidas
  private readonly GOOD_PERFUSION_INDEX = 1.2; // Umbral para buena perfusión
  private readonly EXCELLENT_PERFUSION_INDEX = 3.0; // Umbral para excelente perfusión
  private readonly MIN_SIGNAL_QUALITY = 0.4; // Mínima calidad de señal aceptable
  private readonly GOOD_SIGNAL_QUALITY = 0.7; // Umbral para buena calidad
  
  // Buffers para procesamiento
  private signalBuffer: number[] = []; // Buffer principal de señal PPG
  private systolicBuffer: number[] = []; // Valores sistólicos en tiempo real
  private diastolicBuffer: number[] = []; // Valores diastólicos en tiempo real
  private finalSystolicBuffer: number[] = []; // Valores sistólicos para cálculo final
  private finalDiastolicBuffer: number[] = []; // Valores diastólicos para cálculo final
  private perfusionIndexBuffer: number[] = []; // Índices de perfusión
  private signalQualityBuffer: number[] = []; // Calidad de señal
  
  // Estado del procesador
  private measurementActive = false;
  private measurementEndTime: number | null = null;
  private lastValidTime = 0;
  private lastValidValues: { systolic: number, diastolic: number } | null = null;
  private processingStatistics = {
    totalSamples: 0,
    validSamples: 0,
    avgPerfusionIndex: 0,
    avgSignalQuality: 0,
    lastSystolicValues: [] as number[],
    lastDiastolicValues: [] as number[],
    peakCount: 0,
    valleyCount: 0
  };

  constructor() {
    this.reset();
    console.log("[BP Processor] Procesador inicializado con configuración:", {
      ventanaPrincipal: this.WINDOW_SIZE,
      bufferMediciones: this.MEASUREMENT_BUFFER_SIZE,
      bufferFinal: this.FINAL_BUFFER_SIZE,
      delayProcesamiento: `${this.COMPLETION_DELAY_MS}ms`,
      rangoSistolica: [this.MIN_SYSTOLIC, this.MAX_SYSTOLIC],
      rangoDiastolica: [this.MIN_DIASTOLIC, this.MAX_DIASTOLIC],
      umbralesPerfusion: {
        minimo: this.MIN_PERFUSION_INDEX,
        bueno: this.GOOD_PERFUSION_INDEX,
        excelente: this.EXCELLENT_PERFUSION_INDEX
      }
    });
  }
  
  /**
   * Calcula la presión arterial a partir de la señal PPG
   * @param values Valores de la señal PPG
   * @returns Presión sistólica y diastólica estimada
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
    quality?: number;
  } {
    // Activar la medición si no está activa
    if (!this.measurementActive) {
      this.measurementActive = true;
      console.log("[BP Processor] Iniciando nueva medición de presión arterial");
    }
    
    // Actualizar buffer principal
    this.updateSignalBuffer(values);
    this.processingStatistics.totalSamples++;
    
    // Verificar que tengamos suficientes datos
    if (this.signalBuffer.length < this.MIN_WINDOW) {
      console.log("[BP Processor] Señal insuficiente para análisis", {
        longitudActual: this.signalBuffer.length,
        longitudMinima: this.MIN_WINDOW
      });
      return { systolic: 0, diastolic: 0, quality: 0 };
    }
    
    // Calcular índice de perfusión y calidad de señal
    const perfusionIndex = calculatePerfusionIndex(this.signalBuffer);
    const signalQuality = this.calculateSignalQuality(this.signalBuffer);
    
    // Actualizar buffers de calidad
    this.updateQualityBuffers(perfusionIndex, signalQuality);
    
    if (this.processingStatistics.totalSamples % 10 === 0) {
      console.log("[BP Processor] Calidad de señal:", {
        indicesPerfusion: this.perfusionIndexBuffer.slice(-3),
        calidadSeñal: this.signalQualityBuffer.slice(-3),
        mediaPerfusion: this.processingStatistics.avgPerfusionIndex.toFixed(2),
        mediaCalidad: this.processingStatistics.avgSignalQuality.toFixed(2)
      });
    }
    
    // Verificar si la señal es de calidad suficiente
    if (signalQuality < this.MIN_SIGNAL_QUALITY || perfusionIndex < this.MIN_PERFUSION_INDEX) {
      console.log("[BP Processor] Calidad insuficiente para medición precisa", {
        perfusion: perfusionIndex.toFixed(2),
        calidad: signalQuality.toFixed(2),
        umbralPerfusion: this.MIN_PERFUSION_INDEX,
        umbralCalidad: this.MIN_SIGNAL_QUALITY
      });
      
      return this.lastValidValues || { systolic: 0, diastolic: 0, quality: signalQuality };
    }
    
    // La señal es de calidad suficiente, proceder con el análisis
    this.processingStatistics.validSamples++;
    
    // Preprocesar señal para análisis
    const processedSignal = this.preprocessSignal(this.signalBuffer);
    
    // Extraer características fisiológicas
    const features = this.extractPhysiologicalFeatures(processedSignal);
    
    // Calcular presión arterial estimada
    const { systolic, diastolic } = this.estimateBloodPressure(features, perfusionIndex, signalQuality);
    
    // Verificar que los valores estén en rangos fisiológicos
    if (this.isValidBP(systolic, diastolic)) {
      // Actualizar buffer de mediciones en tiempo real (con filtrado de mediana)
      this.updateMeasurementBuffers(systolic, diastolic);
      
      // Guardar como último valor válido
      this.lastValidTime = Date.now();
      this.lastValidValues = {
        systolic: Math.round(calculateMedian(this.systolicBuffer)),
        diastolic: Math.round(calculateMedian(this.diastolicBuffer))
      };
      
      // Actualizar buffer para cálculo final con ponderación
      this.updateFinalBuffers(systolic, diastolic, perfusionIndex, signalQuality);
      
      // Guardar estadísticas
      this.processingStatistics.lastSystolicValues.push(systolic);
      this.processingStatistics.lastDiastolicValues.push(diastolic);
      if (this.processingStatistics.lastSystolicValues.length > 5) {
        this.processingStatistics.lastSystolicValues.shift();
        this.processingStatistics.lastDiastolicValues.shift();
      }
    } else {
      console.log("[BP Processor] Valores fuera de rango fisiológico", {
        sistolica: systolic,
        diastolica: diastolic,
        rangoSistolica: [this.MIN_SYSTOLIC, this.MAX_SYSTOLIC],
        rangoDiastolica: [this.MIN_DIASTOLIC, this.MAX_DIASTOLIC]
      });
    }
    
    // Calcular valores actuales usando mediana para estabilidad
    const currentSystolic = Math.round(calculateMedian(this.systolicBuffer));
    const currentDiastolic = Math.round(calculateMedian(this.diastolicBuffer));

    return {
      systolic: currentSystolic, 
      diastolic: currentDiastolic,
      quality: signalQuality
    };
  }
  
  /**
   * Completa la medición aplicando procesamiento final después del delay
   * @returns Presión arterial final con promedio ponderado
   */
  public completeMeasurement(): { systolic: number; diastolic: number } {
    if (!this.measurementActive) {
      console.log("[BP Processor] No hay medición activa para completar");
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    console.log("[BP Processor] Proceso de finalización de medición iniciado");
    
    // Si no se ha establecido tiempo de finalización, establecerlo ahora
    if (this.measurementEndTime === null) {
      this.measurementEndTime = Date.now() + this.COMPLETION_DELAY_MS;
      console.log("[BP Processor] Configurando delay para procesamiento final", {
        delayMs: this.COMPLETION_DELAY_MS,
        tiempoFinalizacion: new Date(this.measurementEndTime).toISOString()
      });
      
      // Devolver valor actual mientras esperamos
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    // Verificar si ya pasó el tiempo de delay
    if (Date.now() < this.measurementEndTime) {
      console.log("[BP Processor] Esperando finalización del delay", {
        tiempoRestante: this.measurementEndTime - Date.now()
      });
      
      // Devolver valor actual mientras esperamos
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    // El delay ha finalizado, aplicar procesamiento final
    
    console.log("[BP Processor] Aplicando procesamiento final", {
      muestrasSistolicas: this.finalSystolicBuffer.length,
      muestrasDiastolicas: this.finalDiastolicBuffer.length,
      estadisticas: {
        muestrasTotales: this.processingStatistics.totalSamples,
        muestrasValidas: this.processingStatistics.validSamples,
        perfusionMedia: this.processingStatistics.avgPerfusionIndex.toFixed(2),
        calidadMedia: this.processingStatistics.avgSignalQuality.toFixed(2)
      }
    });
    
    // Si hay muy pocas muestras, devolver la última medición válida
    if (this.finalSystolicBuffer.length < 5 || this.finalDiastolicBuffer.length < 5) {
      console.log("[BP Processor] Muestras insuficientes para cálculo final, usando mediana", {
        muestrasSistolicas: this.finalSystolicBuffer.length,
        muestrasDiastolicas: this.finalDiastolicBuffer.length
      });
      
      const result = {
        systolic: Math.round(calculateMedian(this.finalSystolicBuffer.length > 0 ? 
                 this.finalSystolicBuffer : this.systolicBuffer)),
        diastolic: Math.round(calculateMedian(this.finalDiastolicBuffer.length > 0 ? 
                  this.finalDiastolicBuffer : this.diastolicBuffer))
      };
      
      this.reset();
      return result;
    }
    
    // Eliminar outliers antes del cálculo final
    const filteredSystolic = removeOutliers(this.finalSystolicBuffer);
    const filteredDiastolic = removeOutliers(this.finalDiastolicBuffer);
    
    // Aplicar promedio ponderado para el cálculo final (más peso a mediciones recientes)
    // y con mejor calidad de señal
    const finalSystolic = calculateWeightedAverage(filteredSystolic, 1.4);
    const finalDiastolic = calculateWeightedAverage(filteredDiastolic, 1.4);
    
    console.log("[BP Processor] Resultados del procesamiento final", {
      sistolicaFinal: Math.round(finalSystolic),
      diastolicaFinal: Math.round(finalDiastolic),
      muestrasFiltradas: {
        sistolicas: filteredSystolic.length,
        diastolicas: filteredDiastolic.length
      },
      outliersFiltrados: {
        sistolicas: this.finalSystolicBuffer.length - filteredSystolic.length,
        diastolicas: this.finalDiastolicBuffer.length - filteredDiastolic.length
      },
      rangos: {
        sistolica: [Math.min(...filteredSystolic), Math.max(...filteredSystolic)],
        diastolica: [Math.min(...filteredDiastolic), Math.max(...filteredDiastolic)]
      }
    });
    
    // Reiniciar el procesador para futuras mediciones
    this.reset();
    
    // Devolver resultados finales redondeados
    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }
  
  /**
   * Actualiza el buffer principal de señal PPG
   */
  private updateSignalBuffer(newValues: number[]): void {
    // Añadir nuevos valores al buffer
    this.signalBuffer.push(...newValues);
    
    // Mantener tamaño máximo
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer = this.signalBuffer.slice(-this.WINDOW_SIZE);
    }
  }
  
  /**
   * Actualiza los buffers de calidad de señal
   */
  private updateQualityBuffers(perfusionIndex: number, signalQuality: number): void {
    // Actualizar buffer de índice de perfusión
    this.perfusionIndexBuffer.push(perfusionIndex);
    if (this.perfusionIndexBuffer.length > 10) {
      this.perfusionIndexBuffer.shift();
    }
    
    // Actualizar buffer de calidad de señal
    this.signalQualityBuffer.push(signalQuality);
    if (this.signalQualityBuffer.length > 10) {
      this.signalQualityBuffer.shift();
    }
    
    // Actualizar estadísticas
    this.processingStatistics.avgPerfusionIndex = 
      this.perfusionIndexBuffer.reduce((a, b) => a + b, 0) / this.perfusionIndexBuffer.length;
      
    this.processingStatistics.avgSignalQuality = 
      this.signalQualityBuffer.reduce((a, b) => a + b, 0) / this.signalQualityBuffer.length;
  }
  
  /**
   * Actualiza los buffers de mediciones en tiempo real
   */
  private updateMeasurementBuffers(systolic: number, diastolic: number): void {
    // Añadir valores a los buffers
    if (systolic > 0) {
      this.systolicBuffer.push(systolic);
      if (this.systolicBuffer.length > this.MEASUREMENT_BUFFER_SIZE) {
        this.systolicBuffer.shift();
      }
    }
    
    if (diastolic > 0) {
      this.diastolicBuffer.push(diastolic);
      if (this.diastolicBuffer.length > this.MEASUREMENT_BUFFER_SIZE) {
        this.diastolicBuffer.shift();
      }
    }
  }
  
  /**
   * Actualiza los buffers para cálculo final con ponderación de calidad
   */
  private updateFinalBuffers(
    systolic: number, 
    diastolic: number, 
    perfusionIndex: number, 
    signalQuality: number
  ): void {
    // Solo añadir valores de buena calidad al buffer final
    if (perfusionIndex >= this.MIN_PERFUSION_INDEX && signalQuality >= this.MIN_SIGNAL_QUALITY) {
      if (systolic > 0) {
        this.finalSystolicBuffer.push(systolic);
        if (this.finalSystolicBuffer.length > this.FINAL_BUFFER_SIZE) {
          this.finalSystolicBuffer.shift();
        }
      }
      
      if (diastolic > 0) {
        this.finalDiastolicBuffer.push(diastolic);
        if (this.finalDiastolicBuffer.length > this.FINAL_BUFFER_SIZE) {
          this.finalDiastolicBuffer.shift();
        }
      }
    }
  }
  
  /**
   * Preprocesa la señal PPG para análisis
   */
  private preprocessSignal(values: number[]): number[] {
    if (values.length < 10) return [...values];
    
    // Aplicar filtro Hampel para eliminar outliers
    const outlierFiltered = applyHampelFilter(values, 7, 2.5);
    
    // Aplicar filtro Savitzky-Golay para suavizar la señal
    return applySavitzkyGolayFilter(outlierFiltered, 9);
  }
  
  /**
   * Extrae características fisiológicas de la señal PPG
   */
  private extractPhysiologicalFeatures(values: number[]): {
    amplitude: number;
    heartRate: number;
    peakValleyRatio: number;
    pulseTransitTime: number;
    dicroticNotchRatio: number;
    waveformWidth: number;
    stiffnessIndex: number;
    augmentationIndex: number;
  } {
    // Encontrar picos y valles
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values, 3);
    
    // Actualizar estadísticas
    this.processingStatistics.peakCount = peakIndices.length;
    this.processingStatistics.valleyCount = valleyIndices.length;
    
    // Verificar que tengamos suficientes ciclos
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return {
        amplitude: 0,
        heartRate: 0,
        peakValleyRatio: 0,
        pulseTransitTime: 0,
        dicroticNotchRatio: 0,
        waveformWidth: 0,
        stiffnessIndex: 0,
        augmentationIndex: 0
      };
    }
    
    // Calcular amplitud (relacionada con presión de pulso)
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    
    // Calcular frecuencia cardíaca
    const fps = 30; // Asumiendo 30 fps de captura
    const peakIntervals: number[] = [];
    
    for (let i = 1; i < peakIndices.length; i++) {
      peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
    }
    
    // Filtrar intervalos anómalos
    const validIntervals = peakIntervals.filter(interval => 
      interval >= 15 && interval <= 90); // ~33-120 BPM a 30fps
    
    const avgPeakInterval = validIntervals.length > 0 ? 
      validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length : 0;
    
    const heartRate = avgPeakInterval > 0 ? 
      Math.round((60 * fps) / avgPeakInterval) : 0;
    
    // Calcular tiempo de tránsito de pulso (inversamente proporcional a presión)
    const pulseTransitTime = avgPeakInterval / fps * 1000; // en milisegundos
    
    // Calcular relación pico-valle (indicador de resistencia vascular)
    let peakValleyRatio = 0;
    let validPairs = 0;
    
    for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
      if (peakIndices[i] > valleyIndices[i]) {
        const peak = values[peakIndices[i]];
        const valley = values[valleyIndices[i]];
        
        if (valley > 0) {
          peakValleyRatio += peak / valley;
          validPairs++;
        }
      }
    }
    
    peakValleyRatio = validPairs > 0 ? peakValleyRatio / validPairs : 0;
    
    // Calcular anchura de forma de onda (relacionada con rigidez arterial)
    const waveformWidths: number[] = [];
    
    for (let i = 0; i < valleyIndices.length - 1; i++) {
      const cycleWidth = valleyIndices[i+1] - valleyIndices[i];
      if (cycleWidth > 0 && cycleWidth < 100) { // Filtrar valores no fisiológicos
        waveformWidths.push(cycleWidth);
      }
    }
    
    const waveformWidth = waveformWidths.length > 0 ? 
      waveformWidths.reduce((a, b) => a + b, 0) / waveformWidths.length : 0;
    
    // Buscar muesca dicrótica (relacionada con compliancia arterial)
    let dicroticNotchRatio = 0;
    let validDicroticNotches = 0;
    let augmentationIndices: number[] = [];
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const peakIdx = peakIndices[i];
      const nextValleyIdx = valleyIndices.find(v => v > peakIdx);
      
      if (nextValleyIdx) {
        // Buscar muesca dicrótica entre pico y siguiente valle
        const segment = values.slice(peakIdx, nextValleyIdx);
        
        if (segment.length > 12) {
          // Suavizar segmento para detectar mejor la muesca
          const smoothed = applySavitzkyGolayFilter(segment, 7);
          
          // Buscar el punto de inflexión después del pico (muesca dicrótica)
          let notchIdx = -1;
          let inflectionPoint = -Infinity;
          
          for (let j = 3; j < smoothed.length - 3; j++) {
            // Aproximación de segunda derivada
            const secondDerivative = (smoothed[j+1] - 2*smoothed[j] + smoothed[j-1]);
            
            if (secondDerivative > inflectionPoint) {
              inflectionPoint = secondDerivative;
              notchIdx = j;
            }
          }
          
          if (notchIdx > 0) {
            const peakValue = smoothed[0]; // Valor en el pico
            const notchValue = smoothed[notchIdx]; // Valor en la muesca
            
            if (peakValue > 0) {
              dicroticNotchRatio += notchValue / peakValue;
              validDicroticNotches++;
              
              // Calcular índice de aumentación (P2/P1)
              if (notchIdx < smoothed.length - 5) {
                const secondPeakSection = smoothed.slice(notchIdx, smoothed.length);
                const secondPeakIdx = secondPeakSection.indexOf(Math.max(...secondPeakSection));
                
                if (secondPeakIdx > 0) {
                  const secondPeakValue = smoothed[notchIdx + secondPeakIdx];
                  const augmentationIndex = secondPeakValue / peakValue;
                  
                  if (augmentationIndex > 0 && augmentationIndex < 1.5) {
                    augmentationIndices.push(augmentationIndex);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    dicroticNotchRatio = validDicroticNotches > 0 ? 
      dicroticNotchRatio / validDicroticNotches : 0;
    
    // Calcular índice de rigidez - relacionado con la velocidad de onda de pulso
    // Aproximado a partir de características de la forma de onda
    const stiffnessIndex = heartRate > 0 && waveformWidth > 0 ? 
      (heartRate / 60) * (1 / waveformWidth) * 1000 : 0;
    
    // Calcular índice de aumentación (relación entre onda reflejada y onda incidente)
    const augmentationIndex = augmentationIndices.length > 0 ? 
      augmentationIndices.reduce((a, b) => a + b, 0) / augmentationIndices.length : 0;
    
    return {
      amplitude,
      heartRate,
      peakValleyRatio,
      pulseTransitTime,
      dicroticNotchRatio,
      waveformWidth,
      stiffnessIndex,
      augmentationIndex
    };
  }
  
  /**
   * Estima la presión arterial a partir de las características fisiológicas
   */
  private estimateBloodPressure(
    features: ReturnType<typeof this.extractPhysiologicalFeatures>,
    perfusionIndex: number,
    signalQuality: number
  ): { systolic: number; diastolic: number } {
    // Valores base (población adulta normotensa)
    let systolic = 120;
    let diastolic = 80;
    
    // Factor de frecuencia cardíaca (impacta más a sistólica que a diastólica)
    if (features.heartRate > 40 && features.heartRate < 180) {
      const hrFactor = (features.heartRate - 70) * 0.5;
      systolic += hrFactor;
      diastolic += hrFactor * 0.3;
    }
    
    // Factor de amplitud (correlaciona con presión de pulso)
    if (features.amplitude > 0) {
      const amplitudeFactor = features.amplitude * 2;
      systolic += amplitudeFactor * 0.7;
      diastolic -= amplitudeFactor * 0.3;
    }
    
    // Factor de tiempo de tránsito de pulso (inversamente proporcional a la presión)
    if (features.pulseTransitTime > 150 && features.pulseTransitTime < 400) {
      // Normalizar a rango fisiológico (típicamente 180-350ms)
      const normalizedPTT = Math.min(350, Math.max(180, features.pulseTransitTime));
      const pttFactor = (270 - normalizedPTT) * 0.3;
      
      systolic += pttFactor;
      diastolic += pttFactor * 0.5;
    }
    
    // Factor de relación pico-valle (mayor relación = mayor resistencia vascular)
    if (features.peakValleyRatio > 1) {
      const pvFactor = (features.peakValleyRatio - 1.5) * 10;
      diastolic += pvFactor * 0.7; // Mayor efecto en diastólica
      systolic += pvFactor * 0.3;
    }
    
    // Factor de anchura de forma de onda (menor anchura = mayor rigidez)
    if (features.waveformWidth > 0) {
      const widthFactor = (25 - features.waveformWidth) * 0.4;
      systolic += widthFactor * 0.6;
      diastolic += widthFactor * 0.4;
    }
    
    // Factor de muesca dicrótica (refleja tono vascular)
    if (features.dicroticNotchRatio > 0) {
      const notchFactor = (0.65 - features.dicroticNotchRatio) * 20;
      systolic += notchFactor * 0.5;
      diastolic += notchFactor * 0.7; // Mayor efecto en diastólica
    }
    
    // Factor de índice de aumentación (relacionado con rigidez arterial)
    if (features.augmentationIndex > 0) {
      const aiXFactor = (features.augmentationIndex - 0.3) * 15;
      systolic += aiXFactor * 0.7;
      diastolic += aiXFactor * 0.5;
    }
    
    // Factor de rigidez (relacionado con velocidad de onda de pulso)
    if (features.stiffnessIndex > 0) {
      const stiffnessFactor = features.stiffnessIndex * 0.1;
      systolic += stiffnessFactor * 0.6;
      diastolic += stiffnessFactor * 0.8; // Mayor efecto en diastólica
    }
    
    // Ajuste basado en calidad de señal e índice de perfusión
    const qualityFactor = Math.min(1, signalQuality + perfusionIndex / 10);
    
    // Aplicar ajuste basado en calidad (más calidad = mayor confianza, menor regresión a la media)
    const baselineRegression = 1 - Math.min(0.8, qualityFactor);
    
    systolic = systolic * (1 - baselineRegression * 0.5) + 120 * (baselineRegression * 0.5);
    diastolic = diastolic * (1 - baselineRegression * 0.5) + 80 * (baselineRegression * 0.5);
    
    // Aplicar restricciones fisiológicas
    systolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    // Asegurar diferencial de presión (presión de pulso) fisiológico
    const pulsePressure = systolic - diastolic;
    
    if (pulsePressure < this.MIN_PULSE_PRESSURE) {
      // Ajustar manteniéndose dentro de los límites
      if (systolic + this.MIN_PULSE_PRESSURE > this.MAX_DIASTOLIC) {
        diastolic = Math.max(this.MIN_DIASTOLIC, systolic - this.MIN_PULSE_PRESSURE);
      } else {
        diastolic = systolic - this.MIN_PULSE_PRESSURE;
      }
    } else if (pulsePressure > this.MAX_PULSE_PRESSURE) {
      if (systolic - this.MAX_PULSE_PRESSURE < this.MIN_DIASTOLIC) {
        systolic = Math.min(this.MAX_SYSTOLIC, diastolic + this.MAX_PULSE_PRESSURE);
      } else {
        diastolic = systolic - this.MAX_PULSE_PRESSURE;
      }
    }
    
    // Verificar límites una vez más
    systolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    return {
      systolic: Math.round(systolic), 
      diastolic: Math.round(diastolic) 
    };
  }
  
  /**
   * Calcula la calidad de la señal PPG
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 30) return 0;
    
    // Calcular rango de la señal
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    // Si el rango es muy pequeño, la señal es de baja calidad
    if (range < 0.1) return 0;
    
    // Calcular desviación estándar (medida de variabilidad)
    const stdDev = calculateStandardDeviation(values);
    
    // Calcular coeficiente de variación normalizado
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 999;
    
    // Detectar picos y valles para evaluar periodicidad
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values, 3);
    
    // Evaluar periodicidad (señal regular = mejor calidad)
    let periodicityScore = 0;
    
    if (peakIndices.length > 3) {
      const peakIntervals: number[] = [];
      for (let i = 1; i < peakIndices.length; i++) {
        peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      
      // Filtrar intervalos anómalos
      const validIntervals = peakIntervals.filter(interval => interval >= 15 && interval <= 90);
      
      if (validIntervals.length > 2) {
        // Calcular variabilidad de intervalos
        const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const intervalVariation = validIntervals.reduce((a, b) => a + Math.abs(b - avgInterval), 0) / 
                                (validIntervals.length * avgInterval);
        
        // Menor variación = mayor periodicidad
        periodicityScore = Math.max(0, 1 - (intervalVariation * 2));
      }
    }
    
    // Evaluar índice de perfusión
    const perfusionIndex = calculatePerfusionIndex(values);
    const perfusionScore = Math.min(1, perfusionIndex / 5);
    
    // Evaluar suavidad de la señal (menor ruido = mejor calidad)
    const smoothed = applySavitzkyGolayFilter(values, 9);
    const residuals = values.map((v, i) => Math.pow(v - smoothed[i], 2));
    const residualMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const smoothnessScore = Math.max(0, 1 - (residualMean * 10));
    
    // Combinar factores en un score de calidad
    const cvScore = Math.max(0, 1 - Math.min(1, cv));
    
    // El score final es una combinación ponderada
    const qualityScore = 
      cvScore * 0.2 + 
      periodicityScore * 0.4 + 
      perfusionScore * 0.3 +
      smoothnessScore * 0.1;
    
    // Normalizar a 0-1
    return Math.max(0, Math.min(1, qualityScore));
  }
  
  /**
   * Verifica si los valores de presión arterial están en rangos fisiológicos
   */
  private isValidBP(systolic: number, diastolic: number): boolean {
    // Verificar rangos individuales
    if (systolic < this.MIN_SYSTOLIC || systolic > this.MAX_SYSTOLIC) return false;
    if (diastolic < this.MIN_DIASTOLIC || diastolic > this.MAX_DIASTOLIC) return false;
    
    // Verificar diferencial (presión de pulso)
    const pulsePressure = systolic - diastolic;
    if (pulsePressure < this.MIN_PULSE_PRESSURE || pulsePressure > this.MAX_PULSE_PRESSURE) return false;
    
    // Verificar relación típica (sistólica > diastólica)
    if (systolic <= diastolic) return false;
    
    return true;
  }
  
  /**
   * Resetea el procesador y prepara para nueva medición
   */
  public reset(): void {
    console.log("[BP Processor] Reseteando procesador", {
      estadisticasFinales: {
        muestrasTotales: this.processingStatistics.totalSamples,
        muestrasValidas: this.processingStatistics.validSamples,
        perfusionMedia: this.processingStatistics.avgPerfusionIndex,
        ultimasSistolicas: this.processingStatistics.lastSystolicValues,
        ultimasDiastolicas: this.processingStatistics.lastDiastolicValues
      }
    });
    
    // Resetear buffers
    this.signalBuffer = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.finalSystolicBuffer = [];
    this.finalDiastolicBuffer = [];
    this.perfusionIndexBuffer = [];
    this.signalQualityBuffer = [];
    
    // Resetear estado
    this.measurementActive = false;
    this.measurementEndTime = null;
    
    // Resetear estadísticas
    this.processingStatistics = {
      totalSamples: 0,
      validSamples: 0,
      avgPerfusionIndex: 0,
      avgSignalQuality: 0,
      lastSystolicValues: [],
      lastDiastolicValues: [],
      peakCount: 0,
      valleyCount: 0
    };
  }
  
  /**
   * Devuelve estadísticas de procesamiento para monitoreo
   */
  public getProcessingStatistics(): typeof this.processingStatistics {
    return { ...this.processingStatistics };
  }
}
