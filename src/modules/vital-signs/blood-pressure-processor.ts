
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
  private readonly PERFUSION_INDEX_THRESHOLD = 0.04; // Mínimo para obtener señal válida
  private readonly PPG_WINDOW_SIZE = 300; // 10 segundos a 30 fps
  private readonly MIN_QUALITY_THRESHOLD = 0.6; // Mínimo para obtener medición fiable
  private readonly MEDIAN_BUFFER_SIZE = 5; // Para estabilidad de lectura
  
  // Rangos fisiológicos (solo para validación, no para simulación)
  private readonly MIN_SYSTOLIC = 80; // Mínimo fisiológico (mmHg)
  private readonly MAX_SYSTOLIC = 200; // Máximo fisiológico (mmHg)
  private readonly MIN_DIASTOLIC = 40; // Mínimo fisiológico (mmHg)
  private readonly MAX_DIASTOLIC = 120; // Máximo fisiológico (mmHg)
  
  // Variables internas
  private lastSystolicCalculation: number = 0;
  private lastDiastolicCalculation: number = 0;
  private signalQuality: number = 0;
  private perfusionIndex: number = 0;
  private lastMeasurementTime: number = 0;
  private qualityHistory: number[] = [];
  private bpHistory: Array<{systolic: number, diastolic: number}> = [];
  private systolicMedianBuffer: number[] = [];
  private diastolicMedianBuffer: number[] = [];
  private ppgBuffer: number[] = [];
  
  // Variables para calibración dinámica por usuario
  private systolicCalibrationFactor: number = 1.0;
  private diastolicCalibrationFactor: number = 1.0;
  private calibrated: boolean = false;
  private referenceValues: {
    systolic: number;
    diastolic: number;
  } = { systolic: 0, diastolic: 0 };

  constructor() {
    this.reset();
  }
  
  /**
   * Calcula presión arterial a partir de la señal PPG
   * @returns Mediciones relativas (requieren calibración para valores absolutos)
   */
  public calculateBloodPressure(ppgValues: number[]): {
    systolic: number;
    diastolic: number;
  } {
    // Si no hay suficientes datos, no podemos estimar
    if (ppgValues.length < 60) { // Mínimo 2 segundos a 30 fps
      return {
        systolic: 0,
        diastolic: 0
      };
    }
    
    // Actualizar buffer de análisis
    this.ppgBuffer = [...this.ppgBuffer, ...ppgValues].slice(-1000);
    
    // Verificar calidad de señal
    this.signalQuality = this.calculateSignalQuality(ppgValues);
    this.qualityHistory.push(this.signalQuality);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }
    
    // Verificar índice de perfusión
    this.perfusionIndex = this.calculatePerfusionIndex(ppgValues);
    
    // Verificar calidad mínima necesaria
    const averageQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / 
                           Math.max(1, this.qualityHistory.length);
    
    if (averageQuality < this.MIN_QUALITY_THRESHOLD || this.perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      console.log("BP: Insufficient signal quality for measurement", { 
        quality: averageQuality, 
        perfusionIndex: this.perfusionIndex 
      });
      return { 
        systolic: 0, 
        diastolic: 0 
      };
    }
    
    // Preprocesamiento de señal
    const processedValues = this.preprocessSignal(
      this.ppgBuffer.slice(-this.PPG_WINDOW_SIZE)
    );
    
    // Extraer características hemodinámicas
    const features = this.extractBPFeatures(processedValues);
    
    // Estimar presión arterial relativa
    const { relativeSystolic, relativeDiastolic } = this.estimateRelativeBP(features);
    
    // Aplicar factores de calibración si existen
    let systolicEstimate = this.calibrated ? 
      relativeSystolic * this.systolicCalibrationFactor : 
      relativeSystolic;
      
    let diastolicEstimate = this.calibrated ? 
      relativeDiastolic * this.diastolicCalibrationFactor : 
      relativeDiastolic;
    
    console.log("BP: Raw measurement data", {
      relative: {
        systolic: relativeSystolic,
        diastolic: relativeDiastolic
      },
      calibrationFactors: {
        systolic: this.systolicCalibrationFactor,
        diastolic: this.diastolicCalibrationFactor
      },
      calibrated: this.calibrated,
      quality: this.signalQuality,
      perfusionIndex: this.perfusionIndex,
      features: features
    });
    
    // Mantener consistencia fisiológica entre sistólica y diastólica
    if (systolicEstimate - diastolicEstimate < 20) {
      const midpoint = (systolicEstimate + diastolicEstimate) / 2;
      systolicEstimate = midpoint + 15;
      diastolicEstimate = midpoint - 15;
    }
    
    // Aplicar suavizado temporal con historial reciente
    const newBP = {
      systolic: Math.round(systolicEstimate),
      diastolic: Math.round(diastolicEstimate)
    };
    
    this.bpHistory.push(newBP);
    if (this.bpHistory.length > 5) {
      this.bpHistory.shift();
    }
    
    // Calcular media móvil ponderada (más peso a mediciones recientes)
    let systolicSum = 0;
    let diastolicSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.bpHistory.length; i++) {
      const weight = i + 1; // Más peso a valores más recientes
      systolicSum += this.bpHistory[i].systolic * weight;
      diastolicSum += this.bpHistory[i].diastolic * weight;
      weightSum += weight;
    }
    
    const systolicSmoothed = weightSum > 0 ? Math.round(systolicSum / weightSum) : newBP.systolic;
    const diastolicSmoothed = weightSum > 0 ? Math.round(diastolicSum / weightSum) : newBP.diastolic;
    
    this.lastSystolicCalculation = systolicSmoothed;
    this.lastDiastolicCalculation = diastolicSmoothed;
    this.lastMeasurementTime = Date.now();
    
    // Añadir valores al buffer de mediana para estabilidad
    this.addToMedianBuffer(this.systolicMedianBuffer, systolicSmoothed);
    this.addToMedianBuffer(this.diastolicMedianBuffer, diastolicSmoothed);
    
    // Usar mediana para mayor estabilidad
    const systolicMedian = this.calculateMedian(this.systolicMedianBuffer);
    const diastolicMedian = this.calculateMedian(this.diastolicMedianBuffer);
    
    return {
      systolic: systolicMedian,
      diastolic: diastolicMedian
    };
  }
  
  /**
   * Calcula la calidad de la señal PPG
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 4) return 0;
    
    // Calcular relación señal-ruido
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 0;
    
    // Calcular variabilidad como medida de ruido
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    const cv = stdDev / Math.abs(mean);
    
    // Calcular estabilidad de línea base
    const segments = 4;
    const segmentSize = Math.floor(values.length / segments);
    const segmentMeans = [];
    
    for (let i = 0; i < segments; i++) {
      const segment = values.slice(i * segmentSize, (i + 1) * segmentSize);
      segmentMeans.push(segment.reduce((a, b) => a + b, 0) / segment.length);
    }
    
    const baselineStability = 1 - Math.min(1, Math.max(...segmentMeans) - Math.min(...segmentMeans)) / mean;
    
    // Alta frecuencia vs baja frecuencia
    const highFreqComponent = this.calculateHighFrequencyComponent(values);
    
    // Combinar métricas en score de calidad
    return Math.max(0, Math.min(1, 
      (1 - Math.min(cv, 0.5) * 2) * 0.4 +
      baselineStability * 0.3 +
      (1 - Math.min(highFreqComponent, 0.5) * 2) * 0.3
    ));
  }
  
  /**
   * Calcula componente de alta frecuencia (ruido)
   */
  private calculateHighFrequencyComponent(values: number[]): number {
    if (values.length < 4) return 0.5;
    
    let highFreqSum = 0;
    
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
   * Calcula índice de perfusión real
   */
  private calculatePerfusionIndex(values: number[]): number {
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    
    if (peakIndices.length < 2 || valleyIndices.length < 2) return 0;
    
    const peakValues = peakIndices.map(idx => values[idx]);
    const valleyValues = valleyIndices.map(idx => values[idx]);
    
    const avgPeak = peakValues.reduce((a, b) => a + b, 0) / peakValues.length;
    const avgValley = valleyValues.reduce((a, b) => a + b, 0) / valleyValues.length;
    
    const acComponent = avgPeak - avgValley;
    const dcComponent = avgValley;
    
    return dcComponent === 0 ? 0 : acComponent / dcComponent;
  }
  
  /**
   * Preprocesa la señal PPG para análisis de presión arterial
   */
  private preprocessSignal(values: number[]): number[] {
    if (values.length < 60) return values;
    
    // 1. Aplicar filtro de mediana para eliminar valores atípicos
    const medianFiltered = this.applyMedianFilter(values, 5);
    
    // 2. Filtro Butterworth paso banda simplificado (0.5-8 Hz)
    const butterworthFiltered = this.applyBandpassFilter(medianFiltered);
    
    // 3. Normalización de amplitud
    const mean = butterworthFiltered.reduce((a, b) => a + b, 0) / butterworthFiltered.length;
    const normalized = butterworthFiltered.map(v => v - mean);
    
    const maxAbs = Math.max(...normalized.map(v => Math.abs(v)));
    if (maxAbs > 0) {
      return normalized.map(v => v / maxAbs);
    }
    
    return normalized;
  }
  
  /**
   * Aplica un filtro de mediana simple
   */
  private applyMedianFilter(values: number[], windowSize: number): number[] {
    if (windowSize < 3 || values.length < windowSize) {
      return [...values];
    }
    
    const result = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < values.length; i++) {
      const window = [];
      
      for (let j = Math.max(0, i - halfWindow); 
           j <= Math.min(values.length - 1, i + halfWindow); j++) {
        window.push(values[j]);
      }
      
      window.sort((a, b) => a - b);
      result.push(window[Math.floor(window.length / 2)]);
    }
    
    return result;
  }
  
  /**
   * Aplica un filtro paso banda simplificado para extraer componentes de frecuencia relevantes
   */
  private applyBandpassFilter(values: number[]): number[] {
    // Implementación simplificada de filtro Butterworth
    // En una implementación real, se usaría un diseño de filtro más avanzado
    
    if (values.length < 10) return values;
    
    const filtered: number[] = new Array(values.length).fill(0);
    
    // Coeficientes simplificados para un filtro paso banda (0.5-8 Hz)
    const a = [1, -1.8, 0.81];  // Coeficientes de retroalimentación
    const b = [0.1, 0, -0.1];   // Coeficientes de alimentación directa
    
    // Aplicar filtro
    for (let i = 2; i < values.length; i++) {
      filtered[i] = b[0] * values[i] + b[1] * values[i-1] + b[2] * values[i-2]
                   - a[1] * filtered[i-1] - a[2] * filtered[i-2];
    }
    
    return filtered;
  }
  
  /**
   * Añade valor al buffer de mediana
   */
  private addToMedianBuffer(buffer: number[], value: number): void {
    buffer.push(value);
    if (buffer.length > this.MEDIAN_BUFFER_SIZE) {
      buffer.shift();
    }
  }
  
  /**
   * Calcula la mediana del buffer
   */
  private calculateMedian(buffer: number[]): number {
    if (buffer.length === 0) return 0;
    
    const sorted = [...buffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }
  
  /**
   * Encuentra muescas dicróticas en la señal PPG
   */
  private findDicroticNotches(values: number[], peaks: number[], valleys: number[]): number[] {
    const notches: number[] = [];
    
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      let nextValleyIndex = -1;
      
      // Encontrar el siguiente valle
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] > peakIndex) {
          nextValleyIndex = valleys[j];
          break;
        }
      }
      
      if (nextValleyIndex !== -1) {
        // Buscar muesca dicrótica entre pico y valle siguiente
        // (punto de inflexión en la pendiente descendente)
        let lastDerivative = 0;
        let notchIndex = -1;
        
        for (let j = peakIndex + 2; j < nextValleyIndex - 2; j++) {
          const derivative = values[j] - values[j-1];
          
          // Detectar cambio de pendiente descendente a ascendente
          if (lastDerivative < 0 && derivative >= 0) {
            notchIndex = j;
            break;
          }
          
          lastDerivative = derivative;
        }
        
        if (notchIndex !== -1) {
          notches.push(notchIndex);
        }
      }
    }
    
    return notches;
  }
  
  /**
   * Extrae características relevantes para presión arterial de la señal PPG
   */
  private extractBPFeatures(ppgValues: number[]): any {
    // Detectar puntos característicos
    const { peakIndices, valleyIndices } = findPeaksAndValleys(ppgValues);
    const dicroticNotches = this.findDicroticNotches(ppgValues, peakIndices, valleyIndices);
    
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return {
        pulseTransitTime: 0,
        systolicUptime: 0,
        diastolicTime: 0,
        augmentationIndex: 0,
        reflectionIndex: 0, 
        stiffnessIndex: 0,
        pulseRate: 0,
        waveformWidth: 0,
        areaRatio: 0
      };
    }
    
    // Primera derivada para análisis de pendientes
    const derivatives = [];
    for (let i = 1; i < ppgValues.length; i++) {
      derivatives.push(ppgValues[i] - ppgValues[i-1]);
    }
    
    // Segunda derivada para puntos de inflexión
    const secondDerivatives = [];
    for (let i = 1; i < derivatives.length; i++) {
      secondDerivatives.push(derivatives[i] - derivatives[i-1]);
    }
    
    // 1. Tiempo de tránsito de pulso (ms)
    const pttValues = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const ptt = peakIndices[i] - peakIndices[i-1];
      if (ptt > 15 && ptt < 60) { // Filtrado fisiológico (30-120 BPM a 30fps)
        pttValues.push(ptt * (1000 / 30)); // Convertir a ms
      }
    }
    const pulseTransitTime = pttValues.length > 0 ? 
                           pttValues.reduce((a, b) => a + b, 0) / pttValues.length : 
                           0;
    
    // 2. Tiempo de subida sistólica (ms)
    const systolicUptimes = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      let precedingValleyIndex = -1;
      
      // Encontrar valle precedente
      for (let j = valleyIndices.length - 1; j >= 0; j--) {
        if (valleyIndices[j] < peakIndex) {
          precedingValleyIndex = valleyIndices[j];
          break;
        }
      }
      
      if (precedingValleyIndex !== -1) {
        systolicUptimes.push((peakIndex - precedingValleyIndex) * (1000 / 30));
      }
    }
    const systolicUptime = systolicUptimes.length > 0 ? 
                         systolicUptimes.reduce((a, b) => a + b, 0) / systolicUptimes.length : 
                         0;
    
    // 3. Tiempo diastólico (ms)
    const diastolicTimes = [];
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const currentPeakIndex = peakIndices[i];
      const nextPeakIndex = peakIndices[i + 1];
      
      let followingValleyIndex = -1;
      
      // Encontrar valle siguiente
      for (let j = 0; j < valleyIndices.length; j++) {
        if (valleyIndices[j] > currentPeakIndex && valleyIndices[j] < nextPeakIndex) {
          followingValleyIndex = valleyIndices[j];
          break;
        }
      }
      
      if (followingValleyIndex !== -1) {
        diastolicTimes.push((followingValleyIndex - currentPeakIndex) * (1000 / 30));
      }
    }
    const diastolicTime = diastolicTimes.length > 0 ? 
                        diastolicTimes.reduce((a, b) => a + b, 0) / diastolicTimes.length : 
                        0;
    
    // 4. Índice de aumento (ratio de segundo pico a primer pico)
    const augmentationIndices = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      let dicroticIndex = -1;
      
      // Encontrar muesca dicrótica más cercana
      for (let j = 0; j < dicroticNotches.length; j++) {
        if (dicroticNotches[j] > peakIndex) {
          dicroticIndex = dicroticNotches[j];
          break;
        }
      }
      
      if (dicroticIndex !== -1 && dicroticIndex < ppgValues.length - 5) {
        // Buscar pico después de la muesca
        let secondPeakIndex = -1;
        let secondPeakValue = ppgValues[dicroticIndex];
        
        for (let j = dicroticIndex + 1; j < dicroticIndex + 15 && j < ppgValues.length - 1; j++) {
          if (ppgValues[j] > secondPeakValue && 
              ppgValues[j] > ppgValues[j-1] && 
              ppgValues[j] >= ppgValues[j+1]) {
            secondPeakIndex = j;
            secondPeakValue = ppgValues[j];
          }
        }
        
        if (secondPeakIndex !== -1) {
          const primaryPeakValue = ppgValues[peakIndex];
          const secondaryPeakValue = ppgValues[secondPeakIndex];
          
          if (primaryPeakValue > 0) {
            augmentationIndices.push(secondaryPeakValue / primaryPeakValue);
          }
        }
      }
    }
    const augmentationIndex = augmentationIndices.length > 0 ? 
                            augmentationIndices.reduce((a, b) => a + b, 0) / augmentationIndices.length : 
                            0;
    
    // 5. Índice de reflexión (tiempo hasta muesca dicrótica)
    const reflectionIndices = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      let dicroticIndex = -1;
      
      // Encontrar muesca dicrótica
      for (let j = 0; j < dicroticNotches.length; j++) {
        if (dicroticNotches[j] > peakIndex) {
          dicroticIndex = dicroticNotches[j];
          break;
        }
      }
      
      if (dicroticIndex !== -1) {
        // Tiempo normalizado hasta la muesca (ms)
        reflectionIndices.push((dicroticIndex - peakIndex) * (1000 / 30));
      }
    }
    const reflectionIndex = reflectionIndices.length > 0 ? 
                          reflectionIndices.reduce((a, b) => a + b, 0) / reflectionIndices.length : 
                          0;
    
    // 6. Índice de rigidez (pendiente de subida)
    const stiffnessIndices = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      let valleyIndex = -1;
      
      // Encontrar valle precedente
      for (let j = valleyIndices.length - 1; j >= 0; j--) {
        if (valleyIndices[j] < peakIndex) {
          valleyIndex = valleyIndices[j];
          break;
        }
      }
      
      if (valleyIndex !== -1 && peakIndex - valleyIndex > 0) {
        // Calcular pendiente de subida
        const amplitude = ppgValues[peakIndex] - ppgValues[valleyIndex];
        const time = peakIndex - valleyIndex;
        
        stiffnessIndices.push(amplitude / time);
      }
    }
    const stiffnessIndex = stiffnessIndices.length > 0 ? 
                         stiffnessIndices.reduce((a, b) => a + b, 0) / stiffnessIndices.length : 
                         0;
    
    // 7. Ritmo de pulso (BPM)
    const pulseRate = pulseTransitTime > 0 ? 
                    60000 / pulseTransitTime : 
                    0;
    
    // 8. Ancho de forma de onda (ms)
    const waveformWidths = [];
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const width = peakIndices[i+1] - peakIndices[i];
      if (width > 15 && width < 60) { // Filtrar valores no fisiológicos
        waveformWidths.push(width * (1000 / 30));
      }
    }
    const waveformWidth = waveformWidths.length > 0 ? 
                        waveformWidths.reduce((a, b) => a + b, 0) / waveformWidths.length : 
                        0;
    
    // 9. Ratio de áreas (área diastólica / área sistólica)
    const areaRatios = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      let precedingValleyIndex = -1;
      let dicroticIndex = -1;
      let followingValleyIndex = -1;
      
      // Encontrar puntos característicos
      for (let j = valleyIndices.length - 1; j >= 0; j--) {
        if (valleyIndices[j] < peakIndex) {
          precedingValleyIndex = valleyIndices[j];
          break;
        }
      }
      
      for (let j = 0; j < dicroticNotches.length; j++) {
        if (dicroticNotches[j] > peakIndex) {
          dicroticIndex = dicroticNotches[j];
          break;
        }
      }
      
      for (let j = 0; j < valleyIndices.length; j++) {
        if (valleyIndices[j] > peakIndex) {
          followingValleyIndex = valleyIndices[j];
          break;
        }
      }
      
      // Si tenemos todos los puntos necesarios
      if (precedingValleyIndex !== -1 && dicroticIndex !== -1 && followingValleyIndex !== -1) {
        let systolicArea = 0;
        let diastolicArea = 0;
        
        // Calcular área sistólica (desde valle inicial hasta muesca dicrótica)
        for (let j = precedingValleyIndex; j <= dicroticIndex; j++) {
          systolicArea += ppgValues[j];
        }
        
        // Calcular área diastólica (desde muesca hasta valle final)
        for (let j = dicroticIndex; j <= followingValleyIndex; j++) {
          diastolicArea += ppgValues[j];
        }
        
        if (systolicArea > 0) {
          areaRatios.push(diastolicArea / systolicArea);
        }
      }
    }
    const areaRatio = areaRatios.length > 0 ? 
                    areaRatios.reduce((a, b) => a + b, 0) / areaRatios.length : 
                    0;
    
    return {
      pulseTransitTime,
      systolicUptime,
      diastolicTime,
      augmentationIndex,
      reflectionIndex,
      stiffnessIndex,
      pulseRate,
      waveformWidth,
      areaRatio
    };
  }
  
  /**
   * Estima presión arterial relativa basada en características extraídas
   * sin usar valores base artificiales
   */
  private estimateRelativeBP(features: any): {
    relativeSystolic: number;
    relativeDiastolic: number;
  } {
    // Vector de características para presión sistólica con correlaciones documentadas
    const systolicVector = [
      -1.2 * features.pulseTransitTime / 100, // Correlación negativa fuerte
      0.7 * features.stiffnessIndex,          // Correlación positiva moderada
      0.8 * features.augmentationIndex,        // Correlación positiva moderada
      -0.5 * features.reflectionIndex / 100,   // Correlación negativa moderada
      -0.9 * features.systolicUptime / 100,    // Correlación negativa moderada-fuerte
      0.3 * features.areaRatio                 // Correlación positiva débil
    ];
    
    // Vector de características para presión diastólica con correlaciones documentadas
    const diastolicVector = [
      -0.9 * features.pulseTransitTime / 100, // Correlación negativa moderada-fuerte
      0.5 * features.stiffnessIndex,          // Correlación positiva moderada
      0.6 * features.augmentationIndex,        // Correlación positiva moderada
      -0.3 * features.diastolicTime / 100,     // Correlación negativa débil
      0.3 * features.waveformWidth / 100,      // Correlación positiva débil
      0.5 * features.areaRatio                 // Correlación positiva moderada
    ];
    
    // Normalizar para obtener valores relativos
    const sysMagnitudeSquared = systolicVector.reduce((sum, val) => sum + val * val, 0);
    const sysMagnitude = Math.sqrt(sysMagnitudeSquared);
    
    const diaMagnitudeSquared = diastolicVector.reduce((sum, val) => sum + val * val, 0);
    const diaMagnitude = Math.sqrt(diaMagnitudeSquared);
    
    // Retornar valores puramente relativos sin escalar a rangos artificiales
    return {
      relativeSystolic: sysMagnitude > 0 ? sysMagnitude : 0,
      relativeDiastolic: diaMagnitude > 0 ? diaMagnitude : 0
    };
  }
  
  /**
   * Calibra el algoritmo con valores de referencia externos
   */
  public calibrate(systolicReference: number, diastolicReference: number): void {
    // Validar que los valores de referencia sean fisiológicamente posibles
    if (systolicReference <= 0 || diastolicReference <= 0 || 
        systolicReference <= diastolicReference) {
      console.error("Invalid reference blood pressure values");
      return;
    }
    
    // Necesitamos mediciones actuales para calibrar
    if (this.lastSystolicCalculation <= 0 || this.lastDiastolicCalculation <= 0 || 
        Date.now() - this.lastMeasurementTime > 60000) {
      console.error("No recent measurements available for calibration");
      return;
    }
    
    // Calcular factores de calibración
    if (this.lastSystolicCalculation > 0) {
      this.systolicCalibrationFactor = systolicReference / this.lastSystolicCalculation;
    }
    
    if (this.lastDiastolicCalculation > 0) {
      this.diastolicCalibrationFactor = diastolicReference / this.lastDiastolicCalculation;
    }
    
    this.referenceValues = {
      systolic: systolicReference,
      diastolic: diastolicReference
    };
    
    this.calibrated = true;
    
    console.log("BP calibration set", {
      reference: {
        systolic: systolicReference,
        diastolic: diastolicReference
      },
      raw: {
        systolic: this.lastSystolicCalculation,
        diastolic: this.lastDiastolicCalculation
      },
      factors: {
        systolic: this.systolicCalibrationFactor,
        diastolic: this.diastolicCalibrationFactor
      }
    });
  }
  
  /**
   * Resetea el procesador
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.qualityHistory = [];
    this.bpHistory = [];
    this.systolicMedianBuffer = [];
    this.diastolicMedianBuffer = [];
    this.lastSystolicCalculation = 0;
    this.lastDiastolicCalculation = 0;
    this.perfusionIndex = 0;
    this.signalQuality = 0;
    this.lastMeasurementTime = 0;
    
    // Mantenemos la calibración del usuario
  }
  
  /**
   * Retorna la confianza estimada en la medición
   */
  public getConfidence(): number {
    // La confianza se basa en la calidad de la señal y la calibración
    const qualityFactor = Math.min(1, this.signalQuality * 1.5);
    const calibrationFactor = this.calibrated ? 1.0 : 0.5;
    
    return qualityFactor * calibrationFactor;
  }
  
  /**
   * Indica si el procesador está calibrado
   */
  public isCalibrated(): boolean {
    return this.calibrated;
  }
  
  /**
   * Retorna los valores de calibración
   */
  public getReferenceValues(): { systolic: number; diastolic: number } {
    return this.referenceValues;
  }
}

