
// Type definitions for browser fullscreen API

interface Document {
  // Standard
  readonly fullscreenElement: Element | null;
  readonly fullscreenEnabled: boolean;
  exitFullscreen(): Promise<void>;
  
  // WebKit
  readonly webkitFullscreenElement: Element | null;
  readonly webkitFullscreenEnabled: boolean;
  webkitExitFullscreen(): Promise<void>;
  
  // Mozilla
  readonly mozFullScreenElement: Element | null;
  readonly mozFullScreenEnabled: boolean;
  mozCancelFullScreen(): Promise<void>;
  
  // Microsoft
  readonly msFullscreenElement: Element | null;
  readonly msFullscreenEnabled: boolean;
  msExitFullscreen(): Promise<void>;
}

interface HTMLElement {
  // Standard
  requestFullscreen(options?: FullscreenOptions): Promise<void>;
  
  // WebKit
  webkitRequestFullscreen(options?: FullscreenOptions): Promise<void>;
  
  // Mozilla
  mozRequestFullScreen(options?: FullscreenOptions): Promise<void>;
  
  // Microsoft
  msRequestFullscreen(options?: FullscreenOptions): Promise<void>;
}
