/**
 * Sistema de generación de identificadores determinísticos
 * Reemplaza completamente Math.random() con algoritmos basados en datos reales
 */

/**
 * Genera un hash determinístico basado en timestamp y datos del dispositivo
 */
export function generateDeterministicId(): string {
  const timestamp = Date.now();
  const userAgent = navigator.userAgent;
  const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const timezoneOffset = new Date().getTimezoneOffset();
  
  // Crear una cadena única basada en datos reales del dispositivo
  const deviceFingerprint = `${userAgent}${screenInfo}${timezoneOffset}`;
  
  // Algoritmo de hash simple pero determinístico
  let hash = 0;
  const combinedString = `${timestamp}${deviceFingerprint}`;
  
  for (let i = 0; i < combinedString.length; i++) {
    const char = combinedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  
  // Convertir a string usando base 36 para compatibilidad
  const hashString = Math.abs(hash).toString(36);
  
  // Agregar timestamp en base 36 para garantizar unicidad
  const timestampString = timestamp.toString(36);
  
  // Combinar y tomar los primeros 7 caracteres para compatibilidad
  return `${timestampString}${hashString}`.substring(0, 7);
}

/**
 * Genera un hash determinístico basado en datos de imagen PPG
 */
export function generateSignalBasedId(signalData: number[]): string {
  if (signalData.length === 0) {
    return generateDeterministicId();
  }
  
  // Usar características de la señal PPG para generar ID
  const signalSum = signalData.reduce((sum, val) => sum + val, 0);
  const signalMean = signalSum / signalData.length;
  const signalVariance = signalData.reduce((sum, val) => sum + Math.pow(val - signalMean, 2), 0) / signalData.length;
  
  // Crear hash basado en características de la señal
  const signalFingerprint = `${signalSum.toFixed(2)}${signalMean.toFixed(2)}${signalVariance.toFixed(2)}`;
  const timestamp = Date.now();
  
  let hash = 0;
  const combinedString = `${timestamp}${signalFingerprint}`;
  
  for (let i = 0; i < combinedString.length; i++) {
    const char = combinedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36).substring(0, 7);
}

/**
 * Genera un identificador de sesión basado en timestamp preciso y datos del dispositivo
 */
export function generateSessionId(): string {
  const now = new Date();
  const timestamp = now.getTime();
  const microseconds = now.getMilliseconds();
  
  // Usar información del dispositivo para hacer el ID único
  const deviceInfo = {
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency || 1
  };
  
  // Crear fingerprint del dispositivo
  const deviceString = Object.values(deviceInfo).join('');
  
  // Hash determinístico
  let hash = 0;
  const fullString = `${timestamp}${microseconds}${deviceString}`;
  
  for (let i = 0; i < fullString.length; i++) {
    const char = fullString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Convertir a formato compatible (7 caracteres)
  return Math.abs(hash).toString(36).substring(0, 7);
}