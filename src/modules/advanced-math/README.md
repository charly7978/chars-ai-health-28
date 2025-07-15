# AdvancedMathEngine

Motor de cálculos matemáticos complejos diseñado específicamente para análisis biométrico y procesamiento de señales biomédicas. Implementa algoritmos matemáticos avanzados con precisión científica y optimizaciones para rendimiento en tiempo real.

## Características Principales

### 🔢 Algoritmos Matemáticos Implementados

#### 1. Transformada Rápida de Fourier (FFT)
- **Algoritmo Cooley-Tukey** recursivo optimizado
- **Múltiples tipos de ventana**: Hanning, Hamming, Blackman, Rectangular
- **Análisis espectral completo** con detección de armónicos
- **Cálculo de pureza espectral** y SNR
- **Densidad espectral de potencia** para análisis de energía

**Fórmula implementada:**
```
X(k) = Σ(n=0 to N-1) x(n) × e^(-j2πkn/N)
```

#### 2. Filtro de Kalman Extendido
- **Predicción de estado**: `x̂(k|k-1) = F × x̂(k-1|k-1) + B × u(k)`
- **Actualización de estado**: `x̂(k|k) = x̂(k|k-1) + K(k) × [z(k) - H × x̂(k|k-1)]`
- **Gestión de múltiples estados** independientes
- **Adaptación automática** de ruido de proceso y medición

#### 3. Filtro Savitzky-Golay
- **Suavizado polinomial** preservando características de la señal
- **Cálculo de derivadas** de primer y segundo orden
- **Cache de coeficientes** para optimización de rendimiento
- **Manejo de bordes** por reflexión

**Fórmula implementada:**
```
y(i) = Σ(j=-m to m) c(j) × x(i+j)
```

#### 4. Análisis de Componentes Principales (PCA)
- **Descomposición eigen** de matriz de covarianza
- **Reducción de dimensionalidad** preservando varianza
- **Transformación de datos** a espacio de componentes principales
- **Cálculo de varianza explicada** y acumulativa

**Proceso implementado:**
```
C = (1/n) × X^T × X
Eigenvalores y eigenvectores de C
```

#### 5. Detección Avanzada de Picos
- **Detección de picos locales** con validación fisiológica
- **Cálculo de prominencia** y ancho de pico
- **Filtrado por distancia mínima** entre picos
- **Validación de rangos fisiológicos** para aplicaciones médicas

### 🎯 Optimizaciones de Rendimiento
- **Cache inteligente** para coeficientes y resultados FFT
- **Gestión de memoria** eficiente con limpieza automática
- **Algoritmos vectorizados** donde es posible
- **Procesamiento en lotes** para múltiples señales

## Instalación y Uso

### Uso Básico

```typescript
import { AdvancedMathEngine } from '@/modules/advanced-math/AdvancedMathEngine';

// Crear motor con configuración por defecto
const mathEngine = new AdvancedMathEngine();

// Análisis FFT de una señal
const signal = [1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4];
const fftResult = mathEngine.performFFTAnalysis(signal);

console.log('Frecuencia dominante:', fftResult.dominantFrequency);
console.log('SNR espectral:', fftResult.snr);
console.log('Pureza espectral:', fftResult.spectralPurity);
```

### Configuración Avanzada

```typescript
const mathEngine = new AdvancedMathEngine({
  samplingRate: 60, // 60 Hz
  fftWindowType: 'hanning', // Tipo de ventana
  kalmanProcessNoise: 0.01, // Ruido del proceso Kalman
  kalmanMeasurementNoise: 0.1, // Ruido de medición Kalman
  peakDetectionMinDistance: 10, // Distancia mínima entre picos
  peakDetectionMinHeight: 0.1, // Altura mínima de picos
  physiologicalFreqRange: { min: 0.5, max: 4.0 } // Rango fisiológico (30-240 BPM)
});
```

### Análisis FFT Completo

```typescript
// Crear señal sinusoidal con ruido
const samplingRate = 30;
const duration = 10; // segundos
const frequency = 1.5; // Hz (90 BPM)

const signal = Array(samplingRate * duration).fill(0).map((_, i) => {
  const t = i / samplingRate;
  // Usar ruido determinístico basado en índice en lugar de Math.random()
  const deterministicNoise = 0.1 * Math.sin(i * 0.1) * Math.cos(i * 0.05);
  return Math.sin(2 * Math.PI * frequency * t) + deterministicNoise;
});

// Realizar análisis FFT
const spectrum = mathEngine.performFFTAnalysis(signal);

console.log('Análisis Espectral:');
console.log('- Frecuencia dominante:', spectrum.dominantFrequency, 'Hz');
console.log('- Frecuencia cardíaca:', spectrum.dominantFrequency * 60, 'BPM');
console.log('- SNR:', spectrum.snr.toFixed(2), 'dB');
console.log('- Pureza espectral:', (spectrum.spectralPurity * 100).toFixed(1), '%');
console.log('- Armónicos detectados:', spectrum.harmonics);
```

### Filtrado Kalman

```typescript
// Señal con ruido
const noisySignal = [1.1, 1.9, 3.2, 3.8, 5.1, 4.9, 3.1, 2.2, 1.0];

// Aplicar filtro Kalman
const filteredSignal = mathEngine.applyKalmanFiltering(noisySignal, 'heartRate');

console.log('Señal original:', noisySignal);
console.log('Señal filtrada:', filteredSignal);

// Continuar con más datos usando el mismo estado
const moreData = [0.9, 2.1, 2.8, 4.1, 4.8];
const continuedFiltering = mathEngine.applyKalmanFiltering(moreData, 'heartRate');
```

### Suavizado Savitzky-Golay

```typescript
// Señal con ruido de alta frecuencia
const noisySignal = Array(50).fill(0).map((_, i) => 
  Math.sin(2 * Math.PI * i / 20) + 0.2 * Math.sin(2 * Math.PI * i / 3)
);

// Suavizar señal
const smoothedSignal = mathEngine.calculateSavitzkyGolay(noisySignal, 7, 2);

// Calcular primera derivada
const firstDerivative = mathEngine.calculateSavitzkyGolay(noisySignal, 7, 2, 1);

// Calcular segunda derivada
const secondDerivative = mathEngine.calculateSavitzkyGolay(noisySignal, 7, 2, 2);

console.log('Señal suavizada:', smoothedSignal);
console.log('Primera derivada:', firstDerivative);
console.log('Segunda derivada:', secondDerivative);
```

### Análisis PCA

```typescript
// Datos multivariados (ej: múltiples señales PPG)
const multiChannelData = [
  [1.2, 2.1, 0.8, 1.5], // Muestra 1: [canal1, canal2, canal3, canal4]
  [1.1, 2.3, 0.9, 1.4], // Muestra 2
  [1.3, 1.9, 0.7, 1.6], // Muestra 3
  // ... más muestras
];

// Realizar análisis PCA
const pcaResult = mathEngine.performPCAAnalysi