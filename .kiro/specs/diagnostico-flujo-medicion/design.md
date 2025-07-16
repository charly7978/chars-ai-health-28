# Documento de Diseño - Diagnóstico y Solución del Flujo de Medición

## Resumen

Después de analizar el código de la aplicación, se ha identificado que el problema principal radica en la cadena de procesamiento de señales PPG. Aunque la cámara se activa correctamente y la linterna se enciende, existe una desconexión en el flujo de datos entre la captura de frames de la cámara y el procesamiento de señales que debería generar las mediciones de signos vitales.

## Arquitectura

### Flujo de Datos Actual (Problemático)

```mermaid
graph TD
    A[Usuario presiona "Iniciar Medición"] --> B[CameraView se activa]
    B --> C[Cámara y linterna se encienden]
    C --> D[handleStreamReady se ejecuta]
    D --> E[processImage captura frames]
    E --> F[processFrame en useSignalProcessor]
    F --> G[PPGSignalProcessor.processFrame]
    G --> H[onSignalReady callback]
    H --> I{¿Callback configurado correctamente?}
    I -->|NO| J[Datos se pierden - NO HAY MEDICIÓN]
    I -->|SÍ| K[useSignalProcessor actualiza lastSignal]
    K --> L[useEffect procesa lastSignal]
    L --> M[Actualiza UI con mediciones]
```

### Problemas Identificados

1. **Callback Chain Interruption**: Los callbacks `onSignalReady` pueden no estar correctamente configurados en la cadena de procesamiento
2. **Frame Processing Rate**: La tasa de procesamiento de frames puede ser demasiado alta o baja para dispositivos móviles
3. **Signal Threshold Issues**: Los umbrales de detección pueden ser demasiado estrictos para condiciones reales
4. **Initialization Timing**: Problemas de sincronización en la inicialización de procesadores

## Componentes y Interfaces

### 1. Diagnóstico de Callback Chain

**Componente**: `CallbackDiagnostics`
- **Propósito**: Verificar que todos los callbacks estén correctamente configurados
- **Funcionalidad**: 
  - Validar que `onSignalReady` esté definido en cada nivel
  - Registrar cuando se ejecutan los callbacks
  - Detectar interrupciones en la cadena

### 2. Frame Processing Monitor

**Componente**: `FrameProcessingMonitor`
- **Propósito**: Monitorear el rendimiento del procesamiento de frames
- **Funcionalidad**:
  - Medir FPS real de procesamiento
  - Detectar frames perdidos
  - Ajustar dinámicamente la tasa de procesamiento

### 3. Signal Quality Validator

**Componente**: `SignalQualityValidator`
- **Propósito**: Validar que las señales PPG sean procesables
- **Funcionalidad**:
  - Verificar que los valores de señal estén en rangos válidos
  - Detectar señales completamente nulas
  - Proporcionar feedback sobre calidad de señal

### 4. Enhanced Error Reporting

**Componente**: `EnhancedErrorReporter`
- **Propósito**: Proporcionar información detallada sobre errores
- **Funcionalidad**:
  - Capturar stack traces completos
  - Registrar estado del sistema en momento de error
  - Proporcionar sugerencias de solución

## Modelos de Datos

### DiagnosticInfo
```typescript
interface DiagnosticInfo {
  timestamp: number;
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  data?: any;
}
```

### ProcessingMetrics
```typescript
interface ProcessingMetrics {
  framesProcessed: number;
  framesPerSecond: number;
  averageProcessingTime: number;
  signalQuality: number;
  callbackExecutions: number;
  errors: DiagnosticInfo[];
}
```

### FixedSignalProcessor
```typescript
interface FixedSignalProcessor {
  // Métodos mejorados con diagnóstico
  processFrameWithDiagnostics(imageData: ImageData): ProcessingResult;
  validateCallbackChain(): boolean;
  getProcessingMetrics(): ProcessingMetrics;
  forceCallbackExecution(): void;
}
```

## Estrategia de Manejo de Errores

### 1. Callback Validation
- Verificar que todos los callbacks estén definidos antes de procesar
- Implementar callbacks de respaldo si los principales fallan
- Registrar todas las ejecuciones de callbacks

### 2. Graceful Degradation
- Si el procesamiento avanzado falla, usar procesamiento básico
- Mantener la funcionalidad mínima incluso con errores
- Proporcionar feedback claro al usuario sobre el estado

### 3. Automatic Recovery
- Reintentar inicialización automáticamente
- Reinicializar procesadores si se detectan problemas
- Ajustar parámetros dinámicamente según el rendimiento

## Estrategia de Testing

### 1. Unit Tests
- Probar cada componente de procesamiento individualmente
- Verificar que los callbacks se ejecuten correctamente
- Validar que los datos fluyan correctamente

### 2. Integration Tests
- Probar el flujo completo de datos desde cámara hasta UI
- Verificar que las mediciones aparezcan en tiempo real
- Probar en diferentes condiciones de iluminación

### 3. Device Testing
- Probar en dispositivos Android reales
- Verificar rendimiento en diferentes especificaciones
- Validar que la linterna funcione correctamente

## Soluciones Específicas

### 1. Callback Chain Fix
```typescript
// Asegurar que los callbacks estén siempre definidos
const ensureCallbacks = () => {
  if (!this.onSignalReady) {
    console.error("onSignalReady no definido, creando callback de respaldo");
    this.onSignalReady = (signal) => {
      console.log("Callback de respaldo ejecutado:", signal);
    };
  }
};
```

### 2. Frame Rate Optimization
```typescript
// Ajustar dinámicamente la tasa de frames según el dispositivo
const optimizeFrameRate = () => {
  const devicePerformance = measureDevicePerformance();
  const targetFPS = devicePerformance > 0.8 ? 30 : 15;
  this.frameInterval = 1000 / targetFPS;
};
```

### 3. Signal Threshold Adjustment
```typescript
// Umbrales más permisivos para condiciones reales
const adjustThresholds = () => {
  this.CONFIG.MIN_RED_THRESHOLD = 0; // Más permisivo
  this.CONFIG.MIN_CONSECUTIVE_DETECTIONS = 3; // Menos estricto
  this.CONFIG.QUALITY_THRESHOLD = 20; // Umbral más bajo
};
```

### 4. Enhanced Logging
```typescript
// Logging detallado para diagnóstico
const enhancedLog = (component: string, data: any) => {
  console.log(`[${new Date().toISOString()}] ${component}:`, {
    ...data,
    stackTrace: new Error().stack
  });
};
```

## Consideraciones de Rendimiento

### 1. Memory Management
- Limpiar buffers de señal regularmente
- Evitar memory leaks en procesamiento continuo
- Optimizar uso de canvas para procesamiento de imágenes

### 2. CPU Optimization
- Reducir complejidad de algoritmos de procesamiento
- Usar Web Workers para procesamiento pesado si es necesario
- Implementar throttling inteligente

### 3. Battery Optimization
- Ajustar brillo de linterna según necesidad
- Reducir FPS cuando no hay dedo detectado
- Pausar procesamiento innecesario

## Plan de Implementación

### Fase 1: Diagnóstico
1. Implementar logging detallado en toda la cadena
2. Crear herramientas de diagnóstico en tiempo real
3. Identificar puntos exactos de falla

### Fase 2: Fixes Críticos
1. Corregir problemas de callbacks
2. Ajustar umbrales de detección
3. Optimizar tasa de procesamiento

### Fase 3: Mejoras
1. Implementar recuperación automática
2. Añadir métricas de rendimiento
3. Optimizar para diferentes dispositivos

### Fase 4: Validación
1. Testing exhaustivo en dispositivos reales
2. Validación de mediciones
3. Optimización final de rendimiento