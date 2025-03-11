
// Type definitions for browser fullscreen API
// Needed to support vendor-prefixed methods in TypeScript

interface Document {
  // Standard
  fullscreenElement: Element | null;
  fullscreenEnabled: boolean;
  exitFullscreen(): Promise<void>;
  
  // WebKit
  webkitFullscreenElement: Element | null;
  webkitFullscreenEnabled: boolean;
  webkitExitFullscreen(): Promise<void>;
  
  // Mozilla
  mozFullScreenElement: Element | null;
  mozFullScreenEnabled: boolean;
  mozCancelFullScreen(): Promise<void>;
  
  // Microsoft
  msFullscreenElement: Element | null;
  msFullscreenEnabled: boolean;
  msExitFullscreen(): Promise<void>;

  // Event handler properties
  onfullscreenchange: ((this: Document, ev: Event) => any) | null;
  onfullscreenerror: ((this: Document, ev: Event) => any) | null;
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

// This export {} is necessary to make this file a module rather than a script
export {};
