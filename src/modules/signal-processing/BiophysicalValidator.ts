
/**
 * Sistema de detección multiespectral de tejido vivo
 * basado en características de la piel humana y patrones PPG
 */
export class BiophysicalValidator {
  private readonly MIN_R_TO_G_RATIO = 1.15;
  private readonly MIN_R_TO_B_RATIO = 1.15;
  private readonly MIN_PULSATILITY = 0.8;
  private readonly MAX_PULSATILITY = 4.5;
  private readonly MIN_TEXTURE_SCORE = 0.45;
  private perfusionHistory: number[] = [];
  private colorRatioHistory: { rToG: number, rToB: number }[] = [];

  addSample(pixelData: { 
    r: number, 
    g: number, 
    b: number, 
    perfusionIdx?: number,
    textureScore?: number 
  }): { isValidTissue: boolean; confidence: number; metrics: Record<string, number> } {
    const { r, g, b, perfusionIdx = 0, textureScore: inputTextureScore = 0 } = pixelData;
    
    // 1. Validar dominancia de canal rojo (característica de hemoglobina)
    const rToGRatio = r / Math.max(1, g);
    const rToBRatio = r / Math.max(1, b);
    
    // Guardar historiales
    this.colorRatioHistory.push({ rToG: rToGRatio, rToB: rToBRatio });
    if (this.colorRatioHistory.length > 10) this.colorRatioHistory.shift();
    
    if (perfusionIdx > 0) {
      this.perfusionHistory.push(perfusionIdx);
      if (this.perfusionHistory.length > 10) this.perfusionHistory.shift();
    }
    
    // 2. Calcular métricas promediadas
    const avgRToG = this.colorRatioHistory.reduce((sum, item) => sum + item.rToG, 0) / 
                   this.colorRatioHistory.length;
    const avgRToB = this.colorRatioHistory.reduce((sum, item) => sum + item.rToB, 0) / 
                   this.colorRatioHistory.length;
    
    // 3. Calcular puntuaciones individuales
    const colorRatioScore = (
      (avgRToG > this.MIN_R_TO_G_RATIO ? avgRToG / this.MIN_R_TO_G_RATIO : 0) +
      (avgRToB > this.MIN_R_TO_B_RATIO ? avgRToB / this.MIN_R_TO_B_RATIO : 0)
    ) / 2;
    
    // Limitar a máximo 1.0
    const normalizedColorScore = Math.min(1.0, colorRatioScore);
    
    // 4. Evaluar perfusión (si está disponible)
    let perfusionScore = 0;
    if (this.perfusionHistory.length > 0) {
      const avgPerfusion = this.perfusionHistory.reduce((sum, val) => sum + val, 0) / 
                          this.perfusionHistory.length;
      
      perfusionScore = avgPerfusion > this.MIN_PULSATILITY && avgPerfusion < this.MAX_PULSATILITY ?
                      1.0 : 0;
    }
    
    // 5. Evaluar textura (si está disponible)
    const processedTextureScore = inputTextureScore > this.MIN_TEXTURE_SCORE ? 
                       inputTextureScore : 0;
    
    // 6. Combinar puntuaciones
    const availableMetrics = [
      normalizedColorScore > 0 ? 1 : 0,
      perfusionScore > 0 ? 1 : 0,
      processedTextureScore > 0 ? 1 : 0
    ].filter(Boolean).length;
    
    // Calcular confianza basada en métricas disponibles
    const totalScore = (normalizedColorScore + perfusionScore + processedTextureScore) / 
                      Math.max(1, availableMetrics);
    
    // Umbral para considerar tejido vivo
    const isValidTissue = totalScore > 0.6;
    
    return {
      isValidTissue,
      confidence: totalScore,
      metrics: {
        colorRatio: normalizedColorScore,
        perfusion: perfusionScore,
        texture: processedTextureScore
      }
    };
  }

  reset(): void {
    this.perfusionHistory = [];
    this.colorRatioHistory = [];
  }
}
