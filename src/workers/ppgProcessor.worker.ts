// ppgProcessor.worker.ts
export default {} as typeof Worker & { new (): Worker };

// Tipos para comunicación con el worker
type WorkerMessage = {
  frameData: Uint8ClampedArray;
  width: number;
  height: number;
};

type ProcessedResult = {
  red: number[];
  green: number[];
  ir: number[];
  timestamp: number;
};

const ctx: Worker = self as any;

// Cache para frames
const frameCache: {
  red: number[];
  green: number[];
  ir: number[];
  timestamp: number;
} = {
  red: [],
  green: [],
  ir: [],
  timestamp: 0
};

// Procesamiento optimizado de frames
const processFrame = (frameData: Uint8ClampedArray, width: number): ProcessedResult => {
  const now = Date.now();
  const pixelsPerChannel = width * 10; // Muestra cada 10px para optimizar
  
  for (let i = 0; i < frameData.length; i += 4 * pixelsPerChannel) {
    frameCache.red.push(frameData[i]);     // Canal R
    frameCache.green.push(frameData[i+1]); // Canal G
    frameCache.ir.push(frameData[i+2]);    // Canal IR (si está disponible)
  }
  
  frameCache.timestamp = now;
  
  // Enviar datos cada 10 frames para reducir carga
  if (frameCache.red.length >= 10 * width) {
    const result = { ...frameCache };
    frameCache.red = [];
    frameCache.green = [];
    frameCache.ir = [];
    return result;
  }
  
  return null;
};

// Handler de mensajes
ctx.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { frameData, width } = e.data;
  const result = processFrame(frameData, width);
  
  if (result) {
    ctx.postMessage(result);
  }
};
