
/**
 * Clase para validación de señales biofísicamente plausibles
 * Aplica restricciones fisiológicas a las señales PPG
 */
export class BiophysicalValidator {
  private lastPulsatilityValues: number[] = [];
  private readonly MAX_PULSATILITY_HISTORY = 30;
  private readonly MIN_PULSATILITY = 0.05; // Reducido para detectar pulsatilidad más débil
  private readonly MAX_PULSATILITY = 10.0;
  private lastRawValues: number[] = []; // Nuevos valores brutos para análisis de tendencia
  private lastTimeStamps: number[] = []; // Marcas de tiempo para análisis temporal

  // Rangos biofísicos normales para señales PPG
  private readonly PHYSIOLOGICAL_RANGES = {
    redToGreen: { min: 0.8, max: 4.0, weight: 0.4 }, // Ampliado para más sensibilidad
    redToBlue: { min: 0.8, max: 4.5, weight: 0.3 }, // Ampliado para más sensibilidad
    redValue: { min: 15, max: 250, weight: 0.3 } // Umbral mínimo reducido
  };

  constructor() {
    // Inicializar el histórico de pulsatilidad
    this.reset();
  }

  /**
   * Calcula el índice de pulsatilidad de la señal basado en las variaciones recientes
   * @param value Valor actual de la señal filtrada
   * @returns Índice de pulsatilidad normalizado entre 0-1
   */
  calculatePulsatilityIndex(value: number): number {
    const currentTime = Date.now();
    
    // Añadir al historial
    this.lastPulsatilityValues.push(value);
    this.lastRawValues.push(value);
    this.lastTimeStamps.push(currentTime);
    
    // Mantener tamaño limitado
    if (this.lastPulsatilityValues.length > this.MAX_PULSATILITY_HISTORY) {
      this.lastPulsatilityValues.shift();
      this.lastRawValues.shift();
      this.lastTimeStamps.shift();
    }
    
    // Si no hay suficientes valores, retornar pulsatilidad media
    if (this.lastPulsatilityValues.length < 10) {
      return 0.4; // Valor inicial ligeramente inferior para evitar falsos positivos
    }
    
    // Calcular variabilidad (diferencia entre máximo y mínimo recientes)
    const max = Math.max(...this.lastPulsatilityValues);
    const min = Math.min(...this.lastPulsatilityValues);
    const mean = this.lastPulsatilityValues.reduce((sum, val) => sum + val, 0) / 
                 this.lastPulsatilityValues.length;
    
    // Evitar división por cero
    if (Math.abs(mean) < 0.001) {
      return 0.1; // Valor bajo
    }
    
    // MEJORA 1: Calcular índice de pulsatilidad basado en variaciones
    const rawPulsatility = (max - min) / Math.abs(mean);
    
    // MEJORA 2: Agregar análisis de frecuencia para detectar pulsaciones reales
    const freqScore = this.analyzeSignalFrequency();
    
    // MEJORA 3: Normalizar a rango 0-1 con mayor sensibilidad a señales débiles
    let normalizedPulsatility = Math.max(0, Math.min(1, 
      (rawPulsatility - this.MIN_PULSATILITY) / 
      (this.MAX_PULSATILITY - this.MIN_PULSATILITY)
    ));
    
    // Combinar con puntuación de frecuencia para mejorar precisión
    normalizedPulsatility = normalizedPulsatility * 0.7 + freqScore * 0.3;
    
    return normalizedPulsatility;
  }
  
  /**
   * Analiza la frecuencia de la señal para detectar ritmos compatibles con pulso cardiaco
   * @returns Puntuación de 0-1 basada en compatibilidad con ritmo cardíaco
   */
  private analyzeSignalFrequency(): number {
    if (this.lastTimeStamps.length < 15 || this.lastRawValues.length < 15) {
      return 0.3; // No hay suficientes datos para analizar
    }
    
    // Detectar cruces por cero para estimar frecuencia
    let crossings = 0;
    const diffs = [];
    let lastCrossingTime = 0;
    let lastSign = Math.sign(this.lastRawValues[0] - this.lastRawValues[0]);
    
    for (let i = 1; i < this.lastRawValues.length; i++) {
      const diff = this.lastRawValues[i] - this.lastRawValues[i-1];
      const currentSign = Math.sign(diff);
      
      diffs.push(Math.abs(diff));
      
      // Detectar cambio de signo (cruce por cero en la derivada)
      if (currentSign !== 0 && lastSign !== 0 && currentSign !== lastSign) {
        if (lastCrossingTime > 0) {
          const interval = this.lastTimeStamps[i] - lastCrossingTime;
          // Convertir a BPM equivalente
          const equivalentBPM = 60000 / interval;
          
          // Verificar si está en el rango fisiológico (40-180 BPM)
          if (equivalentBPM >= 40 && equivalentBPM <= 180) {
            crossings++;
          }
        }
        lastCrossingTime = this.lastTimeStamps[i];
      }
      
      if (currentSign !== 0) {
        lastSign = currentSign;
      }
    }
    
    // Calcular magnitud promedio de los cambios
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    
    // Normalizar número de cruces a un score
    // Idealmente, veremos aproximadamente 1-3 cruces por segundo en una señal PPG
    const timeSpan = (this.lastTimeStamps[this.lastTimeStamps.length - 1] - this.lastTimeStamps[0]) / 1000;
    const crossingsPerSecond = crossings / timeSpan;
    
    // Puntuación basada en cruces por segundo (óptimo: 1-2.5 cruces/s)
    let freqScore = 0;
    if (crossingsPerSecond >= 0.8 && crossingsPerSecond <= 3) {
      freqScore = Math.min(1.0, (crossingsPerSecond - 0.5) / 2);
    } else if (crossingsPerSecond > 3 && crossingsPerSecond <= 5) {
      freqScore = Math.max(0, 1 - (crossingsPerSecond - 3) / 2);
    } else {
      freqScore = Math.max(0, Math.min(0.3, crossingsPerSecond / 2));
    }
    
    // Combinar con magnitud de cambio para evitar ruido de baja amplitud
    const magnitudeScore = Math.min(1.0, avgDiff / 0.5);
    
    return freqScore * 0.7 + magnitudeScore * 0.3;
  }

  /**
   * Valida si los parámetros de la señal están dentro de rangos biofísicamente plausibles
   * @param redValue Valor medio del canal rojo
   * @param rToGRatio Ratio rojo/verde
   * @param rToBRatio Ratio rojo/azul
   * @returns Score de plausibilidad biofísica (0-1)
   */
  validateBiophysicalRange(redValue: number, rToGRatio: number, rToBRatio: number): number {
    // Validar nivel absoluto del rojo (debe estar en un rango razonable)
    const redValueScore = this.calculateRangeScore(
      redValue,
      this.PHYSIOLOGICAL_RANGES.redValue.min,
      this.PHYSIOLOGICAL_RANGES.redValue.max
    );
    
    // Validar relación rojo/verde (característica clave de la hemoglobina)
    const rToGScore = this.calculateRangeScore(
      rToGRatio,
      this.PHYSIOLOGICAL_RANGES.redToGreen.min,
      this.PHYSIOLOGICAL_RANGES.redToGreen.max
    );
    
    // Validar relación rojo/azul (otra característica de la hemoglobina)
    const rToBScore = this.calculateRangeScore(
      rToBRatio,
      this.PHYSIOLOGICAL_RANGES.redToBlue.min,
      this.PHYSIOLOGICAL_RANGES.redToBlue.max
    );
    
    // MEJORA: Añadir penalización por ratios extremos (valores no fisiológicos)
    let ratioBalanceScore = 1.0;
    if (rToGRatio > 5.0 || rToBRatio > 5.0 || rToGRatio < 0.5 || rToBRatio < 0.5) {
      ratioBalanceScore = 0.5;
    }
    
    // Calcular score ponderado con nueva componente de balance
    const weightedScore = 
      redValueScore * this.PHYSIOLOGICAL_RANGES.redValue.weight +
      rToGScore * this.PHYSIOLOGICAL_RANGES.redToGreen.weight +
      rToBScore * this.PHYSIOLOGICAL_RANGES.redToBlue.weight;
    
    // Aplicar penalización por desbalance extremo
    return weightedScore * ratioBalanceScore;
  }

  /**
   * Calcula un score basado en si un valor está dentro de un rango
   * con transición suave en los límites
   */
  private calculateRangeScore(value: number, min: number, max: number): number {
    // Si está en el rango óptimo
    if (value >= min && value <= max) {
      return 1.0;
    }
    
    // Si está por debajo del mínimo, calcular score con degradado
    if (value < min) {
      const distance = min - value;
      const range = min * 0.7; // Permitir desviación de hasta 70% por debajo
      
      return Math.max(0, 1 - (distance / range));
    }
    
    // Si está por encima del máximo, calcular score con degradado
    const distance = value - max;
    const range = max * 0.7; // Permitir desviación de hasta 70% por encima
    
    return Math.max(0, 1 - (distance / range));
  }

  /**
   * Reiniciar el estado del validador
   */
  reset(): void {
    this.lastPulsatilityValues = [];
    this.lastRawValues = [];
    this.lastTimeStamps = [];
  }
}
