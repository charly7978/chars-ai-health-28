/**
 * Tipos y interfaces para el sistema de cámara Android
 */

export interface CameraSettings {
  resolution: { width: number; height: number };
  frameRate: number;
  colorSpace: 'sRGB' | 'P3' | 'Rec2020';
  whiteBalance: 'auto' | 'manual';
  exposure: number;
  iso: number;
  focusMode: 'auto' | 'manual' | 'macro';
  flashMode: 'off' | 'on' | 'auto' | 'torch';
}

export interface FlashController {
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  toggle(): Promise<void>;
  isSupported(): boolean;
  getCurrentState(): 'on' | 'off';
}

export interface DeviceCapabilities {
  hasRearCamera: boolean;
  hasFlash: boolean;
  supportedResolutions: { width: number; height: number }[];
  maxFrameRate: number;
  supportedColorSpaces: string[];
  hasImageStabilization: boolean;
  hasAutoFocus: boolean;
}

export interface CameraError {
  code: 'CAMERA_NOT_FOUND' | 'PERMISSION_DENIED' | 'DEVICE_NOT_SUPPORTED' | 'INITIALIZATION_FAILED';
  message: string;
  timestamp: number;
}

export interface CameraInitializationResult {
  success: boolean;
  mediaStream?: MediaStream;
  settings?: CameraSettings;
  capabilities?: DeviceCapabilities;
  error?: CameraError;
}

export interface FrameCaptureOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface CapturedFrame {
  imageData: ImageData;
  timestamp: number;
  settings: CameraSettings;
  quality: number;
}