import Lenis from 'lenis';

declare global {
  interface Window {
    __lenis?: Lenis;
    __journeyProgress?: () => number;
    __beatPulse?: () => void;
    __updateProjectSlide?: (progress: number) => void;
  }

  interface Document {
    fonts: {
      ready: Promise<void>;
    };
  }
}
