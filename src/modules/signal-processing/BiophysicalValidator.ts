
/**
 * Clase para validación de señales biofísicamente plausibles
 * Aplica restricciones fisiológicas a las señales PPG
 */
export class BiophysicalValidator {
  private lastPulsatilityValues: number[] = [];
  private readonly MAX_PULSATILITY_HISTORY = 30;
  private readonly MIN_PULSATILITY = 0.1;
  private readonly MAX_PULSATILITY = 10.0;

  // Rangos biofísicos normales para señales PPG
  private readonly PHYSIOLOGICAL_RANGES = {
    redToGreen: { min: 1.0, max: 3.0, weight: 0.4 },
    redToBlue: { min: 1.0, max: 3.5, weight: 0.3 },
    redValue: { min: 20, max: 240, weight: 0.3 }
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
    // Añadir al historial
    this.lastPulsatilityValues.push(value);
    
    // Mantener tamaño limitado
    if (this.lastPulsatilityValues.length > this.MAX_PULSATILITY_HISTORY) {
      this.lastPulsatilityValues.shift();
    }
    
    // Si no hay suficientes valores, retornar pulsatilidad media
    if (this.lastPulsatilityValues.length < 10) {
      return 0.5; // Valor neutro
    }
    
    // Calcular variabilidad (diferencia entre máximo y mínimo recientes)
    const max = Math.max(...this.lastPulsatilityValues);
    const min = Math.min(...this.lastPulsatilityValues);
    const mean = this.lastPulsatilityValues.reduce((sum, val) => sum + val, 0) / 
                 this.lastPulsatilityValues.length;
    
    // Evitar división por cero
    if (Math.abs(mean) < 0.001) {
      return 0.2; // Valor bajo pero no cero
    }
    
    // Calcular índice de pulsatilidad normalizado
    const rawPulsatility = (max - min) / Math.abs(mean);
    
    // Normalizar a rango 0-1 basado en rangos fisiológicos
    const normalizedPulsatility = Math.max(0, Math.min(1, 
      (rawPulsatility - this.MIN_PULSATILITY) / 
      (this.MAX_PULSATILITY - this.MIN_PULSATILITY)
    ));
    
    return normalizedPulsatility;
  }

  /**
   * Valida si los parámetros de la señal están dentro de rangos biofísicamente plausibles
   * @param redValue Valor medio del canal rojo
   * @param rToGRatio Ratio rojo/verde
   * @param rToBRatio Ratio rojo/azul
   * @returns Score de plausibilidad biofísica (0-1)
   */
  validateBiophysicalRange(redValue: number, rToGRatio: number, rToBRatio: number): number {
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
    
    // Validar nivel absoluto del rojo (debe estar en un rango razonable)
    const redValueScore = this.calculateRangeScore(
      redValue,
      this.PHYSIOLOGICAL_RANGES.redValue.min,
      this.PHYSIOLOGICAL_RANGES.redValue.max
    );
    
    // Calcular score ponderado
    const weightedScore = 
      rToGScore * this.PHYSIOLOGICAL_RANGES.redToGreen.weight +
      rToBScore * this.PHYSIOLOGICAL_RANGES.redToBlue.weight +
      redValueScore * this.PHYSIOLOGICAL_RANGES.redValue.weight;
    
    return weightedScore;
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
      const range = min * 0.5; // Permitir desviación de hasta 50% por debajo
      
      return Math.max(0, 1 - (distance / range));
    }
    
    // Si está por encima del máximo, calcular score con degradado
    const distance = value - max;
    const range = max * 0.5; // Permitir desviación de hasta 50% por encima
    
    return Math.max(0, 1 - (distance / range));
  }

  /**
   * Reiniciar el estado del validador
   */
  reset(): void {
    this.lastPulsatilityValues = [];
  }
}
