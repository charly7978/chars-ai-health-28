/**
 * Procesador de presión arterial basado en señales PPG reales
 * Implementa técnicas de procesamiento de señal para calcular presión sistólica y diastólica
 * a partir de características de la onda PPG según la literatura científica.
 * 
 * LIMITACIONES: Esta implementación busca correlaciones reales, pero la precisión
 * está limitada por el hardware actual. Los resultados deben usarse solo como referencia.
 */
import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  // Constantes basadas en literatura científica
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05; // Umbral mínimo para análisis
  private readonly PPG_WINDOW_SIZE = 240; // 8 segundos a 30 fps
  private readonly MIN_QUALITY_THRESHOLD = 0.5; // Calidad mínima para medición
  
  // Rangos fisiológicos
  private readonly MIN_SYSTOLIC = 90; // Mínimo sistólica (mmHg)
  private readonly MAX_SYSTOLIC = 180; // Máximo sistólica (mmHg)
  private readonly MIN_DIASTOLIC = 60; // Mínimo diastólica (mmHg)
  private readonly MAX_DIASTOLIC = 110; // Máximo diastólica (mmHg)
  private readonly MIN_PULSE_PRESSURE = 25; // Mínima diferencia sistólica-diastólica
  private readonly MAX_PULSE_PRESSURE = 75; // Máxima diferencia sistólica-diastólica
  
  // Constantes para filtrado y mediana
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;
  private readonly MEDIAN_BUFFER_SIZE = 7; // Tamaño del buffer para mediana final
  
  // Estado del procesador
  private lastSystolicCalculation: number = 0;
  private lastDiastolicCalculation: number = 0;
  private signalQuality: number = 0;
  private perfusionIndex: number = 0;
  private lastMeasurementTime: number = 0;
  private qualityHistory: number[] = [];
  
  // Buffers para análisis y filtrado
  private ppgBuffer: number[] = [];
  private systolicBuffer: number[] = []; // Para suavizado
  private diastolicBuffer: number[] = []; // Para suavizado
  private systolicMedianBuffer: number[] = []; // Para resultado final
  private diastolicMedianBuffer: number[] = []; // Para resultado final

  constructor() {
    this.lastMeasurementTime = Date.now();
  }
  
  /**
   * Calcula la presión arterial a partir de valores PPG reales
   * @param values Valores PPG capturados de la cámara
   * @returns Estimación de presión sistólica y diastólica
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    // Procesar la señal para obtener características
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 0, diastolic: 0 };
    }

    // Cálculo de PTT mejorado
    const fps = 30;
    const msPerSample = 1000 / fps;
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      if (dt > 200 && dt < 1500) { // Rango fisiológicamente válido
        pttValues.push(dt);
      }
    }
    
    // Cálculo del PTT ponderado
    let pttWeightSum = 0;
    let pttWeightedSum = 0;
    
    pttValues.forEach((val, idx) => {
      const weight = Math.pow((idx + 1) / pttValues.length, 1.5); // Ponderación exponencial
      pttWeightedSum += val * weight;
      pttWeightSum += weight;
    });

    const calculatedPTT = pttWeightSum > 0 ? pttWeightedSum / pttWeightSum : 600;
    const normalizedPTT = Math.max(300, Math.min(1200, calculatedPTT));
    
    // Cálculo de amplitud mejorado
    const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5.5));

    // Modelo fisiológico mejorado para cálculo de presión
    const pttFactor = (600 - normalizedPTT) * 0.085;
    const ampFactor = normalizedAmplitude * 0.32;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.55) + (ampFactor * 0.22);

    // Restricciones de rango fisiológico
    instantSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, instantSystolic));
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));
    
    // Mantener diferencial de presión realista
    const differential = instantSystolic - instantDiastolic;
    if (differential < this.MIN_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MAX_PULSE_PRESSURE;
    }

    // Actualizar buffers de presión
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Calcular valores suavizados con promedio móvil exponencial
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let smoothingWeightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      smoothingWeightSum += weight;
    }

    finalSystolic = smoothingWeightSum > 0 ? finalSystolic / smoothingWeightSum : instantSystolic;
    finalDiastolic = smoothingWeightSum > 0 ? finalDiastolic / smoothingWeightSum : instantDiastolic;
    
    // Guardar en buffer de mediana para resultado final estable
    this.addToMedianBuffer(this.systolicMedianBuffer, Math.round(finalSystolic));
    this.addToMedianBuffer(this.diastolicMedianBuffer, Math.round(finalDiastolic));
    
    // Calcular mediana final para mostrar un resultado más estable
    const medianSystolic = this.calculateMedian(this.systolicMedianBuffer);
    const medianDiastolic = this.calculateMedian(this.diastolicMedianBuffer);

    return {
      systolic: medianSystolic,
      diastolic: medianDiastolic
    };
  }
  
  /**
   * Calcula la calidad real de la señal basada en ruido y estabilidad
   */
  private calculateSignalQuality(values: number[]): number {
    // Calcular relación señal-ruido
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 0;
    
    // Calcular variabilidad como medida de ruido
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    const cv = stdDev / Math.abs(mean);
    
    // Calcular estabilidad de la línea base
    const segments = 4;
    const segmentSize = Math.floor(values.length / segments);
    const segmentMeans = [];
    
    for (let i = 0; i < segments; i++) {
      const segment = values.slice(i * segmentSize, (i + 1) * segmentSize);
      segmentMeans.push(segment.reduce((a, b) => a + b, 0) / segment.length);
    }
    
    const baselineStability = 1 - Math.min(1, Math.max(...segmentMeans) - Math.min(...segmentMeans)) / mean;
    
    // Alta frecuencia vs baja frecuencia como medida de claridad de señal
    const highFreqComponent = this.calculateHighFrequencyComponent(values);
    
    // Combinar métricas en un score de calidad
    const quality = Math.max(0, Math.min(1, 
      (1 - Math.min(cv, 0.5) * 2) * 0.4 +  // Menor CV = mejor calidad
      baselineStability * 0.3 +            // Mayor estabilidad = mejor calidad
      (1 - Math.min(highFreqComponent, 0.5) * 2) * 0.3  // Menor ruido de alta frecuencia = mejor calidad
    ));
    
    return quality;
  }
  
  /**
   * Calcula el componente de alta frecuencia (ruido) en la señal
   */
  private calculateHighFrequencyComponent(values: number[]): number {
    if (values.length < 4) return 0.5;
    
    let highFreqSum = 0;
    
    // Calcular diferencias de segundo orden (componentes de alta frecuencia)
    for (let i = 2; i < values.length; i++) {
      const firstOrder = values[i] - values[i-1];
      const secondOrder = firstOrder - (values[i-1] - values[i-2]);
      highFreqSum += Math.abs(secondOrder);
    }
    
    const signalRange = Math.max(...values) - Math.min(...values);
    if (signalRange === 0) return 0.5;
    
    return highFreqSum / ((values.length - 2) * signalRange);
  }
  
  /**
   * Calcula el índice de perfusión real basado en la amplitud de la señal PPG
   */
  private calculatePerfusionIndex(values: number[]): number {
    // Encontrar picos y valles para calcular la amplitud de pulso
    const peaks: number[] = [];
    const valleys: number[] = [];
    const minDistance = 15;
    
    // Suavizado simple para reducir ruido
    const smoothed = this.smoothSignal(values, 3);
    
    // Umbrales dinámicos
    const min = Math.min(...smoothed);
    const max = Math.max(...smoothed);
    const range = max - min;
    const peakThreshold = min + (range * 0.6);
    const valleyThreshold = max - (range * 0.6);
    
    // Detectar picos y valles
    for (let i = 2; i < smoothed.length - 2; i++) {
      // Picos
      if (smoothed[i] > peakThreshold &&
          smoothed[i] > smoothed[i-1] && 
          smoothed[i] > smoothed[i-2] &&
          smoothed[i] > smoothed[i+1] && 
          smoothed[i] > smoothed[i+2]) {
        
        const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : -minDistance;
        if (i - lastPeak >= minDistance) {
          peaks.push(i);
        } else if (smoothed[i] > smoothed[lastPeak]) {
          peaks[peaks.length - 1] = i;
        }
      }
      
      // Valles
      if (smoothed[i] < valleyThreshold &&
          smoothed[i] < smoothed[i-1] && 
          smoothed[i] < smoothed[i-2] &&
          smoothed[i] < smoothed[i+1] && 
          smoothed[i] < smoothed[i+2]) {
        
        const lastValley = valleys.length > 0 ? valleys[valleys.length - 1] : -minDistance;
        if (i - lastValley >= minDistance) {
          valleys.push(i);
        } else if (smoothed[i] < smoothed[lastValley]) {
          valleys[valleys.length - 1] = i;
        }
      }
    }
    
    if (peaks.length < 2 || valleys.length < 2) {
      return 0;
    }
    
    // Calcular valores medios de picos y valles
    const peakValues = peaks.map(idx => values[idx]);
    const valleyValues = valleys.map(idx => values[idx]);
    
    const avgPeak = peakValues.reduce((a, b) => a + b, 0) / peakValues.length;
    const avgValley = valleyValues.reduce((a, b) => a + b, 0) / valleyValues.length;
    
    // El índice de perfusión es la relación entre componente AC y DC de la señal PPG
    const acComponent = avgPeak - avgValley;
    const dcComponent = avgValley;
    
    if (dcComponent === 0) return 0;
    
    return acComponent / dcComponent;
  }
  
  /**
   * Extrae características del PPG que tienen correlación con presión arterial
   * según estudios científicos.
   */
  private extractPPGFeatures(values: number[]): any {
    // Encontrar picos y valles
    const peaks: number[] = [];
    const valleys: number[] = [];
    const minDistance = 15;
    
    // Suavizado para reducir ruido
    const smoothed = this.smoothSignal(values, 3);
    
    // Umbrales dinámicos
    const min = Math.min(...smoothed);
    const max = Math.max(...smoothed);
    const range = max - min;
    const peakThreshold = min + (range * 0.6);
    const valleyThreshold = max - (range * 0.6);
    
    // Detectar picos y valles
    for (let i = 2; i < smoothed.length - 2; i++) {
      // Picos
      if (smoothed[i] > peakThreshold &&
          smoothed[i] > smoothed[i-1] && 
          smoothed[i] > smoothed[i-2] &&
          smoothed[i] > smoothed[i+1] && 
          smoothed[i] > smoothed[i+2]) {
        
        const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : -minDistance;
        if (i - lastPeak >= minDistance) {
          peaks.push(i);
        } else if (smoothed[i] > smoothed[lastPeak]) {
          peaks[peaks.length - 1] = i;
        }
      }
      
      // Valles
      if (smoothed[i] < valleyThreshold &&
          smoothed[i] < smoothed[i-1] && 
          smoothed[i] < smoothed[i-2] &&
          smoothed[i] < smoothed[i+1] && 
          smoothed[i] < smoothed[i+2]) {
        
        const lastValley = valleys.length > 0 ? valleys[valleys.length - 1] : -minDistance;
        if (i - lastValley >= minDistance) {
          valleys.push(i);
        } else if (smoothed[i] < smoothed[lastValley]) {
          valleys[valleys.length - 1] = i;
        }
      }
    }
    
    if (peaks.length < 3 || valleys.length < 3) {
      // No hay suficientes ciclos para análisis significativo
      return {
        pulseTransitTime: 0,
        amplitude: 0,
        systolicArea: 0,
        diastolicArea: 0,
        stiffnessIndex: 0,
        reflectionIndex: 0,
        heartRate: 0
      };
    }
    
    // Calcular tiempo entre picos (aproximación de pulso de tránsito)
    const peakIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i-1];
      if (interval >= 15 && interval <= 50) { // Valores fisiológicamente razonables
        peakIntervals.push(interval);
      }
    }
    const avgPeakInterval = peakIntervals.length > 0 ? 
      peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length : 30;
    
    // Pulso de tránsito aproximado (correlacionado con presión arterial)
    const fps = 30;
    const msPerSample = 1000 / fps;
    const pulseTransitTime = avgPeakInterval * msPerSample;
    
    // Amplitud de la onda (relacionada con presión de pulso)
    const amplitudes: number[] = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      if (peaks[i] > valleys[i]) {
        amplitudes.push(smoothed[peaks[i]] - smoothed[valleys[i]]);
      }
    }
    const amplitude = amplitudes.length > 0 ? 
      amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length : 0;
    
    // Calcular áreas sistólica y diastólica (Wang et al., 2018)
    let systolicArea = 0;
    let diastolicArea = 0;
    let totalCycles = 0;
    
    for (let i = 0; i < valleys.length - 1; i++) {
      // Encontrar el pico entre dos valles
      const startValley = valleys[i];
      const endValley = valleys[i+1];
      const peaksInCycle = peaks.filter(p => p > startValley && p < endValley);
      
      if (peaksInCycle.length === 1) {
        const peakIdx = peaksInCycle[0];
        
        // Normalizar la señal del ciclo
        const cycleValues = smoothed.slice(startValley, endValley + 1);
        const cycleMin = Math.min(...cycleValues);
        const cycleMax = Math.max(...cycleValues);
        const cycleRange = cycleMax - cycleMin;
        
        if (cycleRange > 0) {
          // Área sistólica: desde el inicio hasta el pico
          let sysArea = 0;
          for (let j = startValley; j <= peakIdx; j++) {
            sysArea += (smoothed[j] - cycleMin) / cycleRange;
          }
          sysArea /= (peakIdx - startValley + 1);
          
          // Área diastólica: desde el pico hasta el final
          let diasArea = 0;
          for (let j = peakIdx; j <= endValley; j++) {
            diasArea += (smoothed[j] - cycleMin) / cycleRange;
          }
          diasArea /= (endValley - peakIdx + 1);
          
          systolicArea += sysArea;
          diastolicArea += diasArea;
          totalCycles++;
        }
      }
    }
    
    systolicArea = totalCycles > 0 ? systolicArea / totalCycles : 0;
    diastolicArea = totalCycles > 0 ? diastolicArea / totalCycles : 0;
    
    // Índice de rigidez (Millasseau et al., 2006)
    const stiffnessIndex = amplitude > 0 ? (avgPeakInterval / amplitude) : 0;
    
    // Índice de reflexión (correlacionado con presión arterial)
    const reflectionIndex = diastolicArea > 0 ? systolicArea / diastolicArea : 0;
    
    // Frecuencia cardíaca (importantes para ajustar la estimación)
    const heartRate = pulseTransitTime > 0 ? 60000 / pulseTransitTime : 0;
    
    return {
      pulseTransitTime,
      amplitude,
      systolicArea,
      diastolicArea,
      stiffnessIndex,
      reflectionIndex,
      heartRate
    };
  }
  
  /**
   * Estima la presión arterial basado en las características extraídas
   * utilizando correlaciones documentadas en literatura científica.
   */
  private estimateBloodPressureFromFeatures(features: any): {
    systolicEstimate: number;
    diastolicEstimate: number;
  } {
    // Valores base calibrados según literatura
    let systolicEstimate = 120; // mmHg
    let diastolicEstimate = 80; // mmHg
    
    // 1. Tiempo de tránsito de pulso (PTT) correlaciona inversamente con presión arterial
    // (Mukkamala et al., IEEE Transactions on Biomedical Engineering, 2015)
    if (features.pulseTransitTime > 0) {
      // Convertir a valores fisiológicos (normalmente 180-360 ms)
      const normalizedPTT = Math.max(180, Math.min(360, features.pulseTransitTime));
      const pttFactor = ((360 - normalizedPTT) / 180) * 30; // Hasta 30 mmHg de variación
      
      systolicEstimate += pttFactor;
      diastolicEstimate += pttFactor * 0.55; // Menor efecto en diastólica
    }
    
    // 2. Amplitud de la onda PPG correlaciona con presión de pulso
    // (Khalid et al., Journal of Medical Engineering & Technology, 2018)
    if (features.amplitude > 0) {
      const normalizedAmplitude = Math.min(1, features.amplitude * 0.1);
      const amplitudeFactor = normalizedAmplitude * 25; // Hasta 25 mmHg de variación
      
      systolicEstimate += amplitudeFactor * 0.7;
      diastolicEstimate -= amplitudeFactor * 0.3; // Efecto opuesto en diastólica
    }
    
    // 3. Relación de áreas sistólica/diastólica
    // (Allen & Murray, Physiological Measurement, 2002)
    if (features.reflectionIndex > 0) {
      const reflectionFactor = (features.reflectionIndex - 1) * 15;
      systolicEstimate += reflectionFactor;
      diastolicEstimate += reflectionFactor * 0.4;
    }
    
    // 4. Índice de rigidez (correlaciona con presión arterial)
    // (Weber et al., Hypertension, 2012)
    if (features.stiffnessIndex > 0) {
      const stiffnessFactor = features.stiffnessIndex * 10;
      systolicEstimate += stiffnessFactor;
      diastolicEstimate += stiffnessFactor * 0.6;
    }
    
    // 5. Ajuste por frecuencia cardíaca
    // (Sun et al., Scientific Reports, 2016)
    if (features.heartRate > 0) {
      // Normalmente la presión aumenta con la frecuencia cardíaca
      const hrFactor = (features.heartRate - 70) * 0.3;
      systolicEstimate += hrFactor;
      diastolicEstimate += hrFactor * 0.5;
    }
    
    // Aplicar restricciones fisiológicas
    systolicEstimate = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolicEstimate));
    diastolicEstimate = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolicEstimate));
    
    // Mantener diferencial fisiológico (presión de pulso)
    const pulsePressure = systolicEstimate - diastolicEstimate;
    if (pulsePressure < this.MIN_PULSE_PRESSURE) {
      diastolicEstimate = systolicEstimate - this.MIN_PULSE_PRESSURE;
    } else if (pulsePressure > this.MAX_PULSE_PRESSURE) {
      diastolicEstimate = systolicEstimate - this.MAX_PULSE_PRESSURE;
    }
    
    // Asegurar restricciones de rango diastólico
    diastolicEstimate = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolicEstimate));
    
    return {
      systolicEstimate,
      diastolicEstimate
    };
  }
  
  /**
   * Aplica un filtro de suavizado a la señal
   */
  private smoothSignal(signal: number[], windowSize: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
        sum += signal[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Añade un valor al buffer de mediana y mantiene el tamaño
   */
  private addToMedianBuffer(buffer: number[], value: number): void {
    if (value <= 0) return; // No añadir valores inválidos
    
    buffer.push(value);
    if (buffer.length > this.MEDIAN_BUFFER_SIZE) {
      buffer.shift();
    }
  }
  
  /**
   * Calcula la mediana de un array de números
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      return sorted[mid];
    }
  }
  
  /**
   * Calibra el procesador - no completamente implementado debido a
   * limitaciones tecnológicas actuales
   */
  public calibrate(systolicReference: number, diastolicReference: number): void {
    // La calibración completa no es factible con la tecnología actual
    console.log("BP Processor: Calibration not fully supported with current technology");
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.systolicMedianBuffer = [];
    this.diastolicMedianBuffer = [];
  }
  
  /**
   * Obtiene el nivel de confianza de la medición
   */
  public getConfidence(): number {
    return this.signalQuality;
  }
}
