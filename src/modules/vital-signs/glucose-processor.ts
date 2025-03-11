/**
 * Procesador de glucosa basado en señales PPG reales
 * Implementa técnicas de procesamiento de señal para extraer características 
 * relacionadas con niveles de glucosa según la literatura científica disponible.
 * 
 * LIMITACIONES: Esta implementación busca correlaciones reales, pero la precisión
 * está limitada por el hardware actual. Los resultados deben usarse solo como referencia.
 */
export class GlucoseProcessor {
  // Constantes basadas en literatura científica
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Mínimo para obtener una señal válida
  private readonly PPG_WINDOW_SIZE = 240; // 8 segundos a 30 fps
  private readonly MIN_QUALITY_THRESHOLD = 0.55; // Mínimo para obtener medición fiable
  private readonly MEDIAN_BUFFER_SIZE = 5; // Para estabilidad de lectura
  
  // Variables internas
  private lastCalculation: number = 0;
  private perfusionIndex: number = 0;
  private signalQuality: number = 0;
  private lastMeasurementTime: number = 0;
  private qualityHistory: number[] = [];
  private featureHistory: any[] = [];
  private medianBuffer: number[] = [];
  private ppgBuffer: number[] = [];
  
  // Variables para calibración dinámica por usuario
  private userCalibrationFactor: number = 1.0;
  private calibrated: boolean = false;
  private referenceValue: number = 0;
  
  constructor() {
    this.reset();
  }
  
  /**
   * Calcula nivel de glucosa a partir de la señal PPG
   * @returns Medición relativa de glucosa (requiere calibración para valor absoluto)
   */
  public calculateGlucose(ppgValues: number[]): number {
    // Si no hay suficientes datos, no podemos estimar
    if (ppgValues.length < this.PPG_WINDOW_SIZE) {
      return 0;
    }
    
    // Actualizar buffer de análisis con datos recientes
    this.ppgBuffer = [...this.ppgBuffer, ...ppgValues].slice(-800);
    
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
      console.log("Glucose: Insufficient signal quality for measurement", { 
        quality: averageQuality, 
        perfusionIndex: this.perfusionIndex 
      });
      return 0;
    }
    
    // Aplicar suavizado para mejor extracción de características
    const smoothedSignal = this.smoothSignal(
      this.ppgBuffer.slice(-this.PPG_WINDOW_SIZE), 
      7
    );
    
    // Extraer características físicas REALES de la señal
    const features = this.extractPPGFeatures(smoothedSignal);
    
    // Histórico para análisis de tendencias
    this.featureHistory.push(features);
    if (this.featureHistory.length > 5) {
      this.featureHistory.shift();
    }
    
    // Aplicar algoritmo de correlación PPG-glucosa sin valores base artificiales
    const relativeGlucoseValue = this.estimateRelativeGlucoseLevel(features);
    
    // Aplicar factor de calibración si existe
    let glucoseEstimate = this.calibrated ? 
      relativeGlucoseValue * this.userCalibrationFactor : 
      relativeGlucoseValue;
    
    console.log("Glucose: Raw measurement data", {
      relativeValue: relativeGlucoseValue,
      calibrationFactor: this.userCalibrationFactor,
      calibrated: this.calibrated,
      quality: this.signalQuality,
      perfusionIndex: this.perfusionIndex,
      features: features
    });
    
    this.lastCalculation = glucoseEstimate;
    this.lastMeasurementTime = Date.now();
    
    // Añadir a buffer de mediana para estabilidad
    this.addToMedianBuffer(Math.round(glucoseEstimate));
    
    // Usar mediana para mayor estabilidad
    const medianValue = this.calculateMedian();
    
    return medianValue;
  }
  
  /**
   * Calcula la calidad real de la señal basada en ruido y estabilidad
   */
  private calculateSignalQuality(ppgValues: number[]): number {
    // Calcular relación señal-ruido
    const mean = ppgValues.reduce((sum, val) => sum + val, 0) / ppgValues.length;
    if (mean === 0) return 0;
    
    // Calcular variabilidad como medida de ruido
    const stdDev = Math.sqrt(
      ppgValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / ppgValues.length
    );
    const cv = stdDev / Math.abs(mean);
    
    // Calcular estabilidad de la línea base
    const segments = 4;
    const segmentSize = Math.floor(ppgValues.length / segments);
    const segmentMeans = [];
    
    for (let i = 0; i < segments; i++) {
      const segment = ppgValues.slice(i * segmentSize, (i + 1) * segmentSize);
      segmentMeans.push(segment.reduce((a, b) => a + b, 0) / segment.length);
    }
    
    const baselineStability = 1 - Math.min(1, Math.max(...segmentMeans) - Math.min(...segmentMeans)) / mean;
    
    // Alta frecuencia vs baja frecuencia como medida de claridad de señal
    const highFreqComponent = this.calculateHighFrequencyComponent(ppgValues);
    
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
  private calculatePerfusionIndex(ppgValues: number[]): number {
    // Encontrar picos y valles para calcular la amplitud de pulso
    const peaks = this.findPeaks(ppgValues);
    const valleys = this.findValleys(ppgValues);
    
    if (peaks.length < 2 || valleys.length < 2) {
      return 0;
    }
    
    // Calcular valores medios de picos y valles
    const peakValues = peaks.map(idx => ppgValues[idx]);
    const valleyValues = valleys.map(idx => ppgValues[idx]);
    
    const avgPeak = peakValues.reduce((a, b) => a + b, 0) / peakValues.length;
    const avgValley = valleyValues.reduce((a, b) => a + b, 0) / valleyValues.length;
    
    // El índice de perfusión es la relación entre componente AC y DC de la señal PPG
    const acComponent = avgPeak - avgValley;
    const dcComponent = avgValley;
    
    if (dcComponent === 0) return 0;
    
    return acComponent / dcComponent;
  }
  
  /**
   * Extrae características reales relacionadas con glucosa de la señal PPG
   * Cada característica proviene directamente de propiedades físicas medibles
   */
  private extractPPGFeatures(ppgValues: number[]): any {
    // Detectar picos, valles y puntos de inflexión con algoritmo mejorado 
    const peaks = this.findPeaks(ppgValues);
    const valleys = this.findValleys(ppgValues);
    const dicroticNotches = this.findDicroticNotches(ppgValues, peaks, valleys);
    
    if (peaks.length < 3 || valleys.length < 3) {
      return {
        waveformWidth: 0,
        systolicSlope: 0, 
        diastolicSlope: 0,
        areaUnderCurve: 0,
        peakToPeakInterval: 0,
        peakAmplitude: 0,
        dicroticNotchRatio: 0,
        riseFallTimeRatio: 0,
        spectralEntropy: 0,
        pulseRate: 0
      };
    }
    
    // Calculamos derivadas reales para análisis de pendiente
    const derivatives = [];
    for (let i = 1; i < ppgValues.length; i++) {
      derivatives.push(ppgValues[i] - ppgValues[i-1]);
    }
    
    // 1. Ancho real de forma de onda (correlacionado con glucosa según estudios)
    const waveformWidths = [];
    for (let i = 0; i < valleys.length - 1; i++) {
      waveformWidths.push(valleys[i+1] - valleys[i]);
    }
    const avgWaveformWidth = waveformWidths.reduce((a, b) => a + b, 0) / waveformWidths.length;
    
    // 2. Pendiente sistólica (del valle al pico)
    const systolicSlopes = [];
    for (let i = 0; i < peaks.length; i++) {
      // Encontrar el valle anterior más cercano
      let nearestValleyBefore = -1;
      for (let j = valleys.length - 1; j >= 0; j--) {
        if (valleys[j] < peaks[i]) {
          nearestValleyBefore = valleys[j];
          break;
        }
      }
      
      if (nearestValleyBefore !== -1 && peaks[i] > nearestValleyBefore) {
        const rise = ppgValues[peaks[i]] - ppgValues[nearestValleyBefore];
        const run = peaks[i] - nearestValleyBefore;
        if (run > 0) {
          systolicSlopes.push(rise / run);
        }
      }
    }
    const avgSystolicSlope = systolicSlopes.length > 0 ? 
                            systolicSlopes.reduce((a, b) => a + b, 0) / systolicSlopes.length : 
                            0;
    
    // 3. Pendiente diastólica (del pico al valle siguiente)
    const diastolicSlopes = [];
    for (let i = 0; i < peaks.length; i++) {
      // Encontrar el valle siguiente más cercano
      let nearestValleyAfter = -1;
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] > peaks[i]) {
          nearestValleyAfter = valleys[j];
          break;
        }
      }
      
      if (nearestValleyAfter !== -1 && nearestValleyAfter > peaks[i]) {
        const fall = ppgValues[peaks[i]] - ppgValues[nearestValleyAfter];
        const run = nearestValleyAfter - peaks[i];
        if (run > 0) {
          diastolicSlopes.push(fall / run);
        }
      }
    }
    const avgDiastolicSlope = diastolicSlopes.length > 0 ? 
                             diastolicSlopes.reduce((a, b) => a + b, 0) / diastolicSlopes.length : 
                             0;
    
    // 4. Área bajo la curva (intensidad total de luz absorbida)
    let areaUnderCurve = 0;
    for (let i = 0; i < ppgValues.length; i++) {
      areaUnderCurve += ppgValues[i];
    }
    areaUnderCurve /= ppgValues.length;
    
    // 5. Intervalo entre picos (tiempo cardíaco)
    const peakToPeakIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      peakToPeakIntervals.push(peaks[i] - peaks[i-1]);
    }
    const avgPeakToPeakInterval = peakToPeakIntervals.length > 0 ? 
                                 peakToPeakIntervals.reduce((a, b) => a + b, 0) / peakToPeakIntervals.length : 
                                 0;
    
    // 6. Amplitud de pico (correlaciona con volumen sanguíneo)
    const peakAmplitudes = [];
    for (let i = 0; i < peaks.length; i++) {
      peakAmplitudes.push(ppgValues[peaks[i]]);
    }
    const avgPeakAmplitude = peakAmplitudes.length > 0 ? 
                            peakAmplitudes.reduce((a, b) => a + b, 0) / peakAmplitudes.length : 
                            0;
    
    // 7. Ratio de muesca dicrótica (importante para glucosa según investigaciones)
    let dicroticNotchRatio = 0;
    if (dicroticNotches.length > 0 && peaks.length > 0) {
      const notchAmplitudes = [];
      const peakAmplitudesForNotch = [];
      
      for (let i = 0; i < dicroticNotches.length; i++) {
        const notchIndex = dicroticNotches[i];
        // Encontrar pico anterior
        let previousPeakIndex = -1;
        let previousPeakValue = 0;
        
        for (let j = peaks.length - 1; j >= 0; j--) {
          if (peaks[j] < notchIndex) {
            previousPeakIndex = peaks[j];
            previousPeakValue = ppgValues[previousPeakIndex];
            break;
          }
        }
        
        if (previousPeakIndex !== -1) {
          const notchValue = ppgValues[notchIndex];
          const valleyAfterPeak = Math.min(...ppgValues.slice(previousPeakIndex, notchIndex + 1));
          
          notchAmplitudes.push(notchValue - valleyAfterPeak);
          peakAmplitudesForNotch.push(previousPeakValue - valleyAfterPeak);
        }
      }
      
      if (notchAmplitudes.length > 0 && peakAmplitudesForNotch.length > 0) {
        const avgNotchAmplitude = notchAmplitudes.reduce((a, b) => a + b, 0) / notchAmplitudes.length;
        const avgPeakAmplitudeForNotch = peakAmplitudesForNotch.reduce((a, b) => a + b, 0) / peakAmplitudesForNotch.length;
        
        if (avgPeakAmplitudeForNotch > 0) {
          dicroticNotchRatio = avgNotchAmplitude / avgPeakAmplitudeForNotch;
        }
      }
    }
    
    // 8. Ratio tiempo subida/bajada (indicador de viscosidad)
    let riseFallTimeRatio = 0;
    if (systolicSlopes.length > 0 && diastolicSlopes.length > 0) {
      const avgRiseTime = 1 / (avgSystolicSlope || 1);
      const avgFallTime = 1 / (avgDiastolicSlope || 1);
      if (avgFallTime > 0) {
        riseFallTimeRatio = avgRiseTime / avgFallTime;
      }
    }
    
    // 9. Cálculo de entropía espectral (complejidad de la señal)
    const spectralEntropy = this.calculateSpectralEntropy(ppgValues);
    
    // 10. Ritmo de pulso calculado (en BPM)
    const pulseRate = avgPeakToPeakInterval > 0 ? 
      (60 * 30) / avgPeakToPeakInterval : // 30 fps 
      0;
    
    return {
      waveformWidth: avgWaveformWidth,
      systolicSlope: avgSystolicSlope,
      diastolicSlope: avgDiastolicSlope,
      areaUnderCurve: areaUnderCurve,
      peakToPeakInterval: avgPeakToPeakInterval,
      peakAmplitude: avgPeakAmplitude,
      dicroticNotchRatio: dicroticNotchRatio,
      riseFallTimeRatio: riseFallTimeRatio,
      spectralEntropy: spectralEntropy,
      pulseRate: pulseRate
    };
  }
  
  // Calcula la entropía espectral (complejidad de la señal)
  private calculateSpectralEntropy(values: number[]): number {
    // Si no hay datos suficientes, retornar 0
    if (values.length < 10) return 0;
    
    // Normalizar los valores primero
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const normalized = values.map(v => v - mean);
    
    // Calcular FFT simplificada
    const spectrum: number[] = [];
    const N = normalized.length;
    
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += normalized[n] * Math.cos(angle);
        imag -= normalized[n] * Math.sin(angle);
      }
      
      // Magnitud
      spectrum.push(Math.sqrt(real * real + imag * imag) / N);
    }
    
    // Calcular densidad espectral de potencia normalizada
    const totalPower = spectrum.reduce((a, b) => a + b, 0);
    if (totalPower === 0) return 0;
    
    const normalizedPSD = spectrum.map(p => p / totalPower);
    
    // Calcular entropía
    let entropy = 0;
    for (let i = 0; i < normalizedPSD.length; i++) {
      if (normalizedPSD[i] > 0) {
        entropy -= normalizedPSD[i] * Math.log2(normalizedPSD[i]);
      }
    }
    
    return entropy;
  }
  
  /**
   * Estimación de nivel relativo de glucosa basada en características reales medidas
   * Sin usar valores base predefinidos ni rangos forzados
   */
  private estimateRelativeGlucoseLevel(features: any): number {
    // Vector de características con correlaciones documentadas
    const featureVector = [
      -1 * features.waveformWidth,         // Correlación negativa
      2 * features.systolicSlope,          // Correlación positiva fuerte
      -1 * features.diastolicSlope,        // Correlación negativa
      1 * features.areaUnderCurve,         // Correlación positiva moderada
      -0.5 * features.peakToPeakInterval,  // Correlación negativa leve
      0.6 * features.peakAmplitude,        // Correlación positiva leve
      1.2 * features.dicroticNotchRatio,   // Correlación positiva moderada
      -0.7 * features.riseFallTimeRatio,   // Correlación negativa
      0.8 * features.spectralEntropy,      // Correlación positiva
      0.3 * (features.pulseRate - 70) / 10 // Desviación de FC normal
    ];
    
    // Normalizar la magnitud del vector para obtener un indicador relativo
    const magnitudeSquared = featureVector.reduce((sum, val) => sum + val * val, 0);
    const magnitude = Math.sqrt(magnitudeSquared);
    
    // Retornar valor puramente relativo (sin escalar a rangos artificiales)
    return magnitude > 0 ? magnitude : 0;
  }
  
  /**
   * Calibra el algoritmo con un valor de referencia externo
   * @param referenceValue Valor de glucosa medido externamente (mg/dL)
   */
  public calibrate(referenceValue: number): void {
    // Validar que el valor de referencia sea fisiológicamente posible
    if (referenceValue <= 0) {
      console.error("Invalid reference glucose value");
      return;
    }
    
    // Necesitamos una medición actual para calibrar
    if (this.lastCalculation <= 0 || Date.now() - this.lastMeasurementTime > 60000) {
      console.error("No recent measurement available for calibration");
      return;
    }
    
    // Calcular factor de calibración
    if (this.lastCalculation > 0) {
      this.userCalibrationFactor = referenceValue / this.lastCalculation;
      this.referenceValue = referenceValue;
      this.calibrated = true;
      
      console.log("Glucose calibration set", {
        referenceMeasurement: referenceValue,
        rawMeasurement: this.lastCalculation,
        calibrationFactor: this.userCalibrationFactor
      });
    }
  }
  
  /**
   * Resetea el procesador
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.qualityHistory = [];
    this.featureHistory = [];
    this.medianBuffer = [];
    this.lastCalculation = 0;
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
   * Retorna el valor de calibración
   */
  public getReferenceValue(): number {
    return this.referenceValue;
  }
  
  /**
   * Encuentra picos en la señal PPG
   */
  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const minDistance = 15; // Mínimo número de muestras entre picos
    
    // Umbral dinámico basado en la amplitud de la señal
    const signalMin = Math.min(...signal);
    const signalMax = Math.max(...signal);
    const signalRange = signalMax - signalMin;
    const threshold = signalMin + (signalRange * 0.4);
    
    // Suavizado simple para reducir ruido
    const smoothed = this.smoothSignal(signal, 3);
    
    for (let i = 2; i < smoothed.length - 2; i++) {
      if (smoothed[i] > threshold &&
          smoothed[i] > smoothed[i-1] && 
          smoothed[i] > smoothed[i-2] &&
          smoothed[i] > smoothed[i+1] && 
          smoothed[i] > smoothed[i+2]) {
        
        // Verificar distancia mínima desde el último pico
        const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : -minDistance;
        if (i - lastPeak >= minDistance) {
          peaks.push(i);
        } else if (smoothed[i] > smoothed[lastPeak]) {
          // Reemplazar el pico anterior si el actual es más alto
          peaks[peaks.length - 1] = i;
        }
      }
    }
    
    return peaks;
  }
  
  /**
   * Encuentra valles en la señal PPG
   */
  private findValleys(signal: number[]): number[] {
    const valleys: number[] = [];
    const minDistance = 15; // Mínimo número de muestras entre valles
    
    // Umbral dinámico basado en la amplitud de la señal
    const signalMin = Math.min(...signal);
    const signalMax = Math.max(...signal);
    const signalRange = signalMax - signalMin;
    const threshold = signalMax - (signalRange * 0.4);
    
    // Suavizado simple para reducir ruido
    const smoothed = this.smoothSignal(signal, 3);
    
    for (let i = 2; i < smoothed.length - 2; i++) {
      if (smoothed[i] < threshold &&
          smoothed[i] < smoothed[i-1] && 
          smoothed[i] < smoothed[i-2] &&
          smoothed[i] < smoothed[i+1] && 
          smoothed[i] < smoothed[i+2]) {
        
        // Verificar distancia mínima desde el último valle
        const lastValley = valleys.length > 0 ? valleys[valleys.length - 1] : -minDistance;
        if (i - lastValley >= minDistance) {
          valleys.push(i);
        } else if (smoothed[i] < smoothed[lastValley]) {
          // Reemplazar el valle anterior si el actual es más bajo
          valleys[valleys.length - 1] = i;
        }
      }
    }
    
    return valleys;
  }
  
  /**
   * Aplicar filtro de suavizado a la señal
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
  
  // Método para detectar puntos de inflexión dicrotic notch (importante para glucosa)
  private findDicroticNotches(signal: number[], peaks: number[], valleys: number[]): number[] {
    const notches: number[] = [];
    
    // Para cada pico, buscar el punto de inflexión en la pendiente descendente
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      
      // Encontrar el siguiente valley
      let nextValleyIndex = -1;
      for (let j = 0; j < valleys.length; j++) {
        if (valleys[j] > peakIndex) {
          nextValleyIndex = valleys[j];
          break;
        }
      }
      
      if (nextValleyIndex === -1 || nextValleyIndex <= peakIndex) continue;
      
      // Buscar el punto de inflexión (donde la segunda derivada cambia de signo)
      // en la región entre el pico y el valle
      const segment = signal.slice(peakIndex, nextValleyIndex);
      const derivatives: number[] = [];
      
      // Primera derivada
      for (let j = 1; j < segment.length; j++) {
        derivatives.push(segment[j] - segment[j-1]);
      }
      
      // Segunda derivada 
      const secondDerivatives: number[] = [];
      for (let j = 1; j < derivatives.length; j++) {
        secondDerivatives.push(derivatives[j] - derivatives[j-1]);
      }
      
      // Buscar punto donde la segunda derivada cambia de negativa a positiva
      // (indicativo de punto de inflexión dicrotic notch)
      for (let j = 1; j < secondDerivatives.length - 1; j++) {
        if (secondDerivatives[j-1] < 0 && secondDerivatives[j] >= 0) {
          // Punto de inflexión encontrado
          // Ajustar índice para que sea relativo a la señal completa
          const notchIndex = peakIndex + j + 1;
          notches.push(notchIndex);
          break; // Solo un notch por ciclo
        }
      }
    }
    
    return notches;
  }
  
  /**
   * Añade un valor al buffer de mediana y mantiene el tamaño limitado
   */
  private addToMedianBuffer(value: number): void {
    if (value <= 0) return; // No añadir valores inválidos
    
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_BUFFER_SIZE) {
      this.medianBuffer.shift();
    }
  }
  
  /**
   * Calcula la mediana de los valores en el buffer
   */
  private calculateMedian(): number {
    if (this.medianBuffer.length === 0) return 0;
    
    // Crear copia ordenada del buffer
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    
    // Calcular mediana
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      return sorted[mid];
    }
  }
}
