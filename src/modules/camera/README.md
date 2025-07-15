# AndroidCameraController

Controlador avanzado específicamente diseñado para la cámara trasera de dispositivos Android, optimizado para medición biométrica PPG (fotopletismografía).

## Características Principales

### 🎥 Control Avanzado de Cámara Trasera
- **Detección automática** de cámara trasera en dispositivos Android
- **Configuración óptima** de resolución (hasta Full HD 1920x1080)
- **Frame rate configurable** (30-120 fps) para análisis temporal preciso
- **Estabilización digital** avanzada cuando está disponible

### 💡 Control de Flash LED
- **Detección automática** de capacidades de flash
- **Control programático** del flash LED para iluminación controlada
- **Múltiples APIs** soportadas (torch, ImageCapture, constraints)
- **Estados persistentes** del flash

### ⚙️ Configuración Automática
- **Balance de blancos** automático y manual
- **Espacio de color** optimizado (sRGB, P3, Rec2020)
- **Modo de enfoque** automático y macro
- **Exposición** configurable para condiciones óptimas

### 🔧 Integración React
- **Hook personalizado** `useAndroidCamera` para fácil integración
- **Estados reactivos** para UI responsiva
- **Manejo de errores** robusto
- **Cleanup automático** de recursos

## Instalación y Uso

### Uso Básico

```typescript
import { useAndroidCamera } from '@/hooks/useAndroidCamera';

function CameraComponent() {
  const {
    isInitialized,
    mediaStream,
    initialize,
    stop,
    captureFrame,
    toggleFlash
  } = useAndroidCamera();
  
  const handleStart = async () => {
    const success = await initialize();
    if (success) {
      console.log('Cámara inicializada correctamente');
    }
  };
  
  return (
    <div>
      <button onClick={handleStart} disabled={isInitialized}>
        Inicializar Cámara
      </button>
      <button onClick={toggleFlash} disabled={!isInitialized}>
        Toggle Flash
      </button>
    </div>
  );
}
```

### Uso Avanzado

```typescript
import { AndroidCameraController } from '@/modules/camera/AndroidCameraController';

async function advancedCameraSetup() {
  const controller = new AndroidCameraController();
  
  try {
    // Inicializar cámara trasera
    const stream = await controller.initializeRearCamera();
    
    // Configurar frame rate específico
    await controller.setFrameRate(60);
    
    // Habilitar estabilización
    await controller.enableStabilization();
    
    // Obtener configuraciones
    const settings = controller.configureOptimalSettings();
    console.log('Configuraciones:', settings);
    
    // Control de flash
    const flashController = controller.enableFlashControl();
    await flashController.turnOn();
    
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## API Reference

### AndroidCameraController

#### Métodos Principales

##### `initializeRearCamera(): Promise<MediaStream>`
Inicializa la cámara trasera con configuración óptima.

**Returns:** Promise que resuelve con el MediaStream de la cámara.

**Throws:** Error si la cámara trasera no está disponible o falla la inicialización.

##### `configureOptimalSettings(): CameraSettings`
Obtiene las configuraciones actuales de la cámara.

**Returns:** Objeto con todas las configuraciones actuales.

##### `setFrameRate(fps: number): Promise<void>`
Configura la velocidad de frames de la cámara.

**Parameters:**
- `fps`: Frames por segundo deseados (30-120)

##### `enableStabilization(): Promise<void>`
Habilita la estabilización digital si está disponible.

##### `enableFlashControl(): FlashController`
Obtiene el controlador de flash LED.

**Returns:** Instancia de FlashController para control del flash.

**Throws:** Error si el flash no está disponible.

##### `stop(): Promise<void>`
Detiene la cámara y libera todos los recursos.

#### Propiedades

##### `isReady(): boolean`
Indica si la cámara está inicializada y lista para usar.

##### `getDeviceCapabilities(): DeviceCapabilities | null`
Obtiene las capacidades detectadas del dispositivo.

### FlashController

#### Métodos

##### `turnOn(): Promise<void>`
Enciende el flash LED.

##### `turnOff(): Promise<void>`
Apaga el flash LED.

##### `toggle(): Promise<void>`
Alterna el estado del flash.

##### `isSupported(): boolean`
Indica si el flash está soportado en el dispositivo.

##### `getCurrentState(): 'on' | 'off'`
Obtiene el estado actual del flash.

### useAndroidCamera Hook

#### Estados Retornados

```typescript
interface UseAndroidCameraResult {
  // Estado
  isInitialized: boolean;
  isInitializing: boolean;
  mediaStream: MediaStream | null;
  error: string | null;
  
  // Configuraciones
  settings: CameraSettings | null;
  capabilities: DeviceCapabilities | null;
  
  // Controladores
  flashController: FlashController | null;
  
  // Métodos
  initialize: () => Promise<boolean>;
  stop: () => Promise<void>;
  setFrameRate: (fps: number) => Promise<void>;
  enableStabilization: () => Promise<void>;
  captureFrame: () => ImageData | null;
  
  // Estado del flash
  flashSupported: boolean;
  flashState: 'on' | 'off';
  toggleFlash: () => Promise<void>;
}
```

## Configuraciones Óptimas

### Resoluciones Soportadas
1. **Full HD**: 1920x1080 (preferida)
2. **HD**: 1280x720 (fallback)
3. **VGA**: 640x480 (último recurso)

### Frame Rates
- **Objetivo**: 60 fps (óptimo para análisis PPG)
- **Mínimo**: 30 fps (aceptable)
- **Máximo**: 120 fps (si el dispositivo lo soporta)

### Espacios de Color
- **sRGB**: Estándar, amplia compatibilidad
- **P3**: Mayor gamut de color
- **Rec2020**: Ultra amplio (dispositivos premium)

## Manejo de Errores

### Errores Comunes

#### `CAMERA_NOT_FOUND`
```typescript
// La cámara trasera no está disponible
if (error?.code === 'CAMERA_NOT_FOUND') {
  console.log('Este dispositivo no tiene cámara trasera');
}
```

#### `PERMISSION_DENIED`
```typescript
// El usuario denegó permisos de cámara
if (error?.code === 'PERMISSION_DENIED') {
  console.log('Permisos de cámara denegados');
}
```

#### `DEVICE_NOT_SUPPORTED`
```typescript
// El dispositivo no soporta las características requeridas
if (error?.code === 'DEVICE_NOT_SUPPORTED') {
  console.log('Dispositivo no compatible');
}
```

### Estrategias de Recuperación

```typescript
async function robustCameraInit() {
  const controller = new AndroidCameraController();
  
  try {
    await controller.initializeRearCamera();
  } catch (error) {
    // Intentar con configuración reducida
    try {
      await controller.initializeRearCamera();
    } catch (fallbackError) {
      // Usar cámara frontal como último recurso
      console.warn('Usando cámara frontal como fallback');
    }
  }
}
```

## Optimizaciones para Android

### Permisos Requeridos
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.FLASHLIGHT" />
```

### Configuración Capacitor
```typescript
// capacitor.config.ts
export default {
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};
```

### Optimizaciones de Rendimiento
- **Web Workers**: Para procesamiento intensivo de frames
- **OffscreenCanvas**: Para captura sin bloquear UI
- **RequestAnimationFrame**: Para sincronización suave

## Testing

### Ejecutar Pruebas
```bash
npm test AndroidCameraController
```

### Pruebas Incluidas
- ✅ Inicialización de cámara trasera
- ✅ Detección de capacidades del dispositivo
- ✅ Configuración de frame rate
- ✅ Control de flash LED
- ✅ Estabilización digital
- ✅ Manejo de errores
- ✅ Liberación de recursos

## Compatibilidad

### Navegadores Soportados
- ✅ Chrome 88+ (Android)
- ✅ Firefox 85+ (Android)
- ✅ Samsung Internet 13+
- ✅ Edge 88+ (Android)

### APIs Utilizadas
- **MediaDevices.getUserMedia()**: Acceso a cámara
- **MediaStreamTrack.applyConstraints()**: Configuración avanzada
- **ImageCapture API**: Control de flash (cuando disponible)
- **Navigator.torch**: API de linterna (experimental)

## Roadmap

### Próximas Características
- [ ] **Zoom digital** programático
- [ ] **Detección de movimiento** para estabilización
- [ ] **Calibración automática** de exposición
- [ ] **Múltiples resoluciones** simultáneas
- [ ] **Grabación de video** optimizada para PPG

### Mejoras Planificadas
- [ ] **Mejor detección** de cámara trasera
- [ ] **Fallbacks** más robustos
- [ ] **Métricas de rendimiento** integradas
- [ ] **Soporte offline** para configuraciones