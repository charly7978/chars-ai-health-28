
/**
 * Procesador avanzado de presión arterial basado en señales PPG
 * Implementa técnicas de procesamiento de señal con énfasis en mediciones reales
 * con filtrado de mediana durante la medición y promedio ponderado al final.
 */
import { calculateAmplitude, findPeaksAndValleys, calculateStandardDeviation } from './utils';

export class BloodPressureProcessor {
  // Constantes de configuración
  private readonly WINDOW_SIZE = 180; // 6 segundos a 30 fps
  private readonly MEASUREMENT_BUFFER_SIZE = 15; // Buffer para mediciones en tiempo real
  private readonly FINAL_BUFFER_SIZE = 10; // Buffer para cálculo final
  private readonly COMPLETION_DELAY_MS = 2000; // Espera 2 segundos para procesamiento final
  
  // Límites fisiológicos
  private readonly MIN_SYSTOLIC = 90;
  private readonly MAX_SYSTOLIC = 180;
  private readonly MIN_DIASTOLIC = 60;
  private readonly MAX_DIASTOLIC = 110;
  private readonly MIN_PULSE_PRESSURE = 30;
  private readonly MAX_PULSE_PRESSURE = 60;
  
  // Buffers para procesamiento en tiempo real
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  
  // Buffers para cálculo final (después del delay)
  private finalSystolicBuffer: number[] = [];
  private finalDiastolicBuffer: number[] = [];
  
  // Estado del procesador
  private measurementActive: boolean = false;
  private measurementEndTime: number | null = null;
  private signalQuality: number = 0;
  private lastValidTime: number = 0;
  private lastValidValues: { systolic: number, diastolic: number } | null = null;

  // Constructor
  constructor() {
    this.reset();
  }
  
  /**
   * Procesa la señal PPG y calcula la presión arterial en tiempo real
   * @param values Valores PPG (ventana de señal)
   * @returns Estimación de presión sistólica y diastólica
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Activar la medición si no está activa
    if (!this.measurementActive) {
      this.measurementActive = true;
      console.log("[BP Processor] Iniciando nueva medición de presión arterial");
    }
    
    // Verificar que tengamos suficientes datos
    if (values.length < 60) {
      console.log("[BP Processor] Señal demasiado corta para análisis", {
        longitud: values.length,
        mínRequerido: 60
      });
      return { systolic: 0, diastolic: 0 };
    }
    
    // Calcular la calidad de la señal
    this.signalQuality = this.calculateSignalQuality(values);
    
    // Si la señal es de baja calidad, devolver el último valor válido o 0
    if (this.signalQuality < 0.4) {
      console.log("[BP Processor] Calidad de señal insuficiente", {
        calidad: this.signalQuality.toFixed(2),
        umbraMínimo: 0.4
      });
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    // Extraer características fisiológicas relevantes
    const features = this.extractFeatures(values);
    
    // Calcular estimación inicial basada en las características
    const { systolic, diastolic } = this.calculateBPFromFeatures(features);
    
    // Verificar si los valores están en rangos fisiológicos
    if (this.isValidBP(systolic, diastolic)) {
      // Actualizar buffer de mediana para medición en tiempo real
      this.addToBuffer(this.systolicBuffer, systolic, this.MEASUREMENT_BUFFER_SIZE);
      this.addToBuffer(this.diastolicBuffer, diastolic, this.MEASUREMENT_BUFFER_SIZE);
      
      // Actualizar último valor válido
      this.lastValidTime = Date.now();
      this.lastValidValues = { 
        systolic: this.calculateMedian(this.systolicBuffer), 
        diastolic: this.calculateMedian(this.diastolicBuffer) 
      };
      
      // Actualizar buffer para cálculo final (después del delay)
      this.addToBuffer(this.finalSystolicBuffer, systolic, this.FINAL_BUFFER_SIZE);
      this.addToBuffer(this.finalDiastolicBuffer, diastolic, this.FINAL_BUFFER_SIZE);
    } else {
      console.log("[BP Processor] Valores fuera de rango fisiológico", {
        sistólica: systolic,
        diastólica: diastolic
      });
    }
    
    // Devolver la mediana de los valores en el buffer (más estable que valores instantáneos)
    return {
      systolic: this.calculateMedian(this.systolicBuffer),
      diastolic: this.calculateMedian(this.diastolicBuffer)
    };
  }
  
  /**
   * Completa la medición aplicando procesamiento adicional después del delay
   * @returns Presión arterial final después del procesamiento ponderado
   */
  public completeMeasurement(): { systolic: number; diastolic: number } {
    if (!this.measurementActive) {
      console.log("[BP Processor] No hay medición activa para completar");
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    console.log("[BP Processor] Completando medición de presión arterial");
    
    // Si no se ha establecido tiempo de finalización, establecerlo ahora
    if (this.measurementEndTime === null) {
      this.measurementEndTime = Date.now() + this.COMPLETION_DELAY_MS;
      console.log("[BP Processor] Estableciendo delay de procesamiento final", {
        delayMs: this.COMPLETION_DELAY_MS,
        tiempoFinalización: new Date(this.measurementEndTime).toISOString()
      });
      
      // Devolvemos el valor actual mientras esperamos el delay
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    // Verificar si ya pasó el tiempo de delay
    if (Date.now() < this.measurementEndTime) {
      console.log("[BP Processor] Esperando tiempo de procesamiento final", {
        tiempoRestanteMs: this.measurementEndTime - Date.now()
      });
      
      // Devolvemos el valor actual mientras esperamos
      return this.lastValidValues || { systolic: 0, diastolic: 0 };
    }
    
    // Si llegamos aquí, el delay ha finalizado y podemos calcular el valor final
    
    // Aplicar promedio ponderado al buffer final (dando más peso a los valores más recientes)
    const finalSystolic = this.calculateWeightedAverage(this.finalSystolicBuffer);
    const finalDiastolic = this.calculateWeightedAverage(this.finalDiastolicBuffer);
    
    console.log("[BP Processor] Procesamiento final completado", {
      sistólicaFinal: finalSystolic,
      diastólicaFinal: finalDiastolic,
      muestrasProcesadas: this.finalSystolicBuffer.length
    });
    
    // Reiniciar el estado para futuras mediciones
    this.reset();
    
    // Devolver el resultado final
    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }
  
  /**
   * Extrae características fisiológicas relevantes de la señal PPG
   */
  private extractFeatures(values: number[]): any {
    // Encontrar picos y valles
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    
    // Verificar que tengamos suficientes ciclos para análisis
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return {
        amplitude: 0,
        heartRate: 0,
        pulseTransitTime: 0,
        dicroticNotchRatio: 0,
        peakValleyRatio: 0,
        waveformWidth: 0
      };
    }
    
    // Calcular amplitud (relacionada con presión de pulso)
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    
    // Calcular ritmo cardíaco (importante para ajustes)
    const fps = 30; // Asumiendo 30 fps
    const peakIntervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
    }
    
    const avgPeakInterval = peakIntervals.length > 0 ? 
      peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length : 0;
    
    const heartRate = avgPeakInterval > 0 ? 
      (60 * fps) / avgPeakInterval : 0;
    
    // Calcular tiempo de tránsito de pulso (inversamente relacionado con presión)
    const pulseTransitTime = avgPeakInterval / fps * 1000; // en ms
    
    // Calcular relación entre pico y valle (indicador de resistencia vascular)
    let peakValleyRatio = 0;
    let validPairs = 0;
    
    for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
      if (peakIndices[i] > valleyIndices[i]) {
        const peak = values[peakIndices[i]];
        const valley = values[valleyIndices[i]];
        
        if (valley > 0) { // Evitar división por cero
          peakValleyRatio += peak / valley;
          validPairs++;
        }
      }
    }
    
    peakValleyRatio = validPairs > 0 ? peakValleyRatio / validPairs : 1;
    
    // Calcular anchura de forma de onda (relacionada con rigidez arterial)
    const waveformWidths: number[] = [];
    
    for (let i = 0; i < valleyIndices.length - 1; i++) {
      const cycleWidth = valleyIndices[i+1] - valleyIndices[i];
      if (cycleWidth > 0 && cycleWidth < 60) { // Filtrar valores no fisiológicos
        waveformWidths.push(cycleWidth);
      }
    }
    
    const waveformWidth = waveformWidths.length > 0 ? 
      waveformWidths.reduce((a, b) => a + b, 0) / waveformWidths.length : 0;
    
    // Buscar muesca dicrótica (relacionada con compliancia arterial)
    let dicroticNotchRatio = 0;
    let validDicroticNotches = 0;
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const peakIdx = peakIndices[i];
      const nextValleyIdx = valleyIndices.find(v => v > peakIdx);
      
      if (nextValleyIdx) {
        // Buscar muesca dicrótica entre pico y siguiente valle
        const segment = values.slice(peakIdx, nextValleyIdx);
        
        if (segment.length > 10) {
          // Suavizar segmento para detectar mejor la muesca
          const smoothed = this.smoothSignal(segment, 3);
          
          // Encontrar punto de inflexión después del pico (muesca dicrótica)
          let notchIdx = -1;
          let maxSecondDerivative = -Infinity;
          
          for (let j = 3; j < smoothed.length - 3; j++) {
            // Aproximación de segunda derivada
            const secondDerivative = (smoothed[j+1] - 2*smoothed[j] + smoothed[j-1]);
            
            if (secondDerivative > maxSecondDerivative) {
              maxSecondDerivative = secondDerivative;
              notchIdx = j;
            }
          }
          
          if (notchIdx > 0) {
            const peakValue = smoothed[0]; // Valor en el pico
            const notchValue = smoothed[notchIdx]; // Valor en la muesca
            
            if (peakValue > 0) { // Evitar división por cero
              dicroticNotchRatio += notchValue / peakValue;
              validDicroticNotches++;
            }
          }
        }
      }
    }
    
    dicroticNotchRatio = validDicroticNotches > 0 ? 
      dicroticNotchRatio / validDicroticNotches : 0;
    
    return {
      amplitude,
      heartRate,
      pulseTransitTime,
      dicroticNotchRatio,
      peakValleyRatio,
      waveformWidth
    };
  }
  
  /**
   * Calcula la presión arterial a partir de las características extraídas
   */
  private calculateBPFromFeatures(features: any): { systolic: number; diastolic: number } {
    // Valores base para personas sanas
    let systolic = 120;
    let diastolic = 80;
    
    // Factor de amplitud (correlacionado con presión de pulso)
    if (features.amplitude > 0) {
      const amplitudeFactor = Math.min(25, features.amplitude * 3);
      systolic += amplitudeFactor * 0.6;
      diastolic -= amplitudeFactor * 0.25;
    }
    
    // Factor de tiempo de tránsito (inversamente proporcional a presión)
    if (features.pulseTransitTime > 0) {
      // Normalizar a rango fisiológico (típicamente 180-350ms)
      const normalizedPTT = Math.max(180, Math.min(350, features.pulseTransitTime));
      const pttFactor = (270 - normalizedPTT) * 0.25; // 270ms como punto medio
      
      systolic += pttFactor;
      diastolic += pttFactor * 0.6;
    }
    
    // Factor de frecuencia cardíaca
    if (features.heartRate > 40) {
      const hrFactor = (features.heartRate - 70) * 0.3; // 70 lpm como referencia
      systolic += hrFactor;
      diastolic += hrFactor * 0.5;
    }
    
    // Factor de relación pico-valle (mayor relación = mayor resistencia vascular)
    if (features.peakValleyRatio > 1) {
      const pvFactor = (features.peakValleyRatio - 1.5) * 10;
      systolic += pvFactor;
      diastolic += pvFactor * 1.2; // Mayor efecto en diastólica
    }
    
    // Factor de anchura de forma de onda (menor anchura = mayor rigidez)
    if (features.waveformWidth > 0) {
      const widthFactor = (25 - features.waveformWidth) * 0.8; // 25 como referencia
      systolic += widthFactor;
      diastolic += widthFactor * 0.6;
    }
    
    // Factor de muesca dicrótica (refleja tono vascular)
    if (features.dicroticNotchRatio > 0) {
      const notchFactor = (0.7 - features.dicroticNotchRatio) * 15; // 0.7 como referencia
      systolic += notchFactor;
      diastolic += notchFactor * 0.8;
    }
    
    // Aplicar restricciones fisiológicas
    systolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    // Asegurar diferencial de presión fisiológico
    const pulsePressure = systolic - diastolic;
    
    if (pulsePressure < this.MIN_PULSE_PRESSURE) {
      diastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (pulsePressure > this.MAX_PULSE_PRESSURE) {
      diastolic = systolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Asegurar límites diastólicos
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    return { systolic, diastolic };
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
    
    // Calcular coeficiente de variación (normalizado por la media)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 999;
    
    // Detectar picos y valles para evaluar periodicidad
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    
    // Evaluar periodicidad (señal regular = mejor calidad)
    let periodicityScore = 0;
    
    if (peakIndices.length > 2) {
      const peakIntervals: number[] = [];
      for (let i = 1; i < peakIndices.length; i++) {
        peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      
      // Calcular variabilidad de intervalos
      const avgInterval = peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length;
      const intervalVariation = peakIntervals.reduce((a, b) => a + Math.abs(b - avgInterval), 0) / 
                              (peakIntervals.length * avgInterval);
      
      // Menor variación = mayor periodicidad
      periodicityScore = Math.max(0, 1 - intervalVariation * 2);
    }
    
    // Combinar factores en un score de calidad
    const cvScore = Math.max(0, 1 - Math.min(cv, 0.5) * 2);
    
    // El score final es una combinación ponderada
    const qualityScore = cvScore * 0.4 + periodicityScore * 0.6;
    
    return Math.max(0, Math.min(1, qualityScore));
  }
  
  /**
   * Añade un valor al buffer y mantiene el tamaño máximo
   */
  private addToBuffer(buffer: number[], value: number, maxSize: number): void {
    if (value <= 0) return; // No añadir valores inválidos
    
    buffer.push(value);
    
    if (buffer.length > maxSize) {
      buffer.shift();
    }
  }
  
  /**
   * Calcula la mediana de un array de valores
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      return Math.round(sorted[mid]);
    }
  }
  
  /**
   * Calcula el promedio ponderado de un array de valores,
   * dando más peso a los valores más recientes
   */
  private calculateWeightedAverage(values: number[]): number {
    if (values.length === 0) return 0;
    
    let sum = 0;
    let weightSum = 0;
    
    // Aplicar pesos exponenciales (más peso a valores recientes)
    for (let i = 0; i < values.length; i++) {
      const weight = Math.pow(1.3, i); // Base > 1 para dar más peso a elementos más recientes
      sum += values[values.length - 1 - i] * weight;
      weightSum += weight;
    }
    
    return weightSum > 0 ? sum / weightSum : 0;
  }
  
  /**
   * Aplica suavizado a una señal mediante promedio móvil simple
   */
  private smoothSignal(signal: number[], windowSize: number): number[] {
    const result = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); 
           j <= Math.min(signal.length - 1, i + windowSize); j++) {
        sum += signal[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Resetea el procesador y prepara para nueva medición
   */
  public reset(): void {
    console.log("[BP Processor] Reseteando procesador de presión arterial");
    
    // Resetear buffers
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.finalSystolicBuffer = [];
    this.finalDiastolicBuffer = [];
    
    // Resetear estado
    this.measurementActive = false;
    this.measurementEndTime = null;
    this.signalQuality = 0;
  }
  
  /**
   * Devuelve la calidad actual de la señal
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
}
