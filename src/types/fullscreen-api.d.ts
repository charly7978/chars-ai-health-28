
// Type definitions for browser-specific fullscreen APIs

interface Document {
  // Standard properties
  fullscreenElement: Element | null;
  exitFullscreen(): Promise<void>;
  
  // Webkit (Safari, older Chrome)
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?(): Promise<void>;
  
  // Mozilla (Firefox)
  mozFullScreenElement?: Element | null;
  mozCancelFullScreen?(): Promise<void>;
  
  // Microsoft (IE/Edge)
  msFullscreenElement?: Element | null;
  msExitFullscreen?(): Promise<void>;
}

interface Element {
  // Standard methods
  requestFullscreen(options?: FullscreenOptions): Promise<void>;
  
  // Webkit (Safari, older Chrome)
  webkitRequestFullscreen?(options?: FullscreenOptions): Promise<void>;
  
  // Mozilla (Firefox)
  mozRequestFullScreen?(options?: FullscreenOptions): Promise<void>;
  
  // Microsoft (IE/Edge)
  msRequestFullscreen?(options?: FullscreenOptions): Promise<void>;
}

export {};
