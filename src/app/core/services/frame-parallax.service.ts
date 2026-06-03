import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FrameParallaxService {
  private doc = inject(DOCUMENT);

  private readonly totalFrames = 750;
  private currentFrameIndex = signal<number>(0);
  private isDarkMode = signal<boolean>(true);
  private frameCache = new Map<number, string>();

  constructor() {
    // Listen to scroll events
    this.setupScrollListener();

    // Listen to theme changes
    this.setupThemeListener();

    // Effect to update background when frame changes
    effect(() => {
      this.updateBackgroundFrame(this.currentFrameIndex(), this.isDarkMode());
    });
  }

  private setupScrollListener(): void {
    window.addEventListener('scroll', () => {
      this.updateFrameFromScroll();
    }, { passive: true });

    // Initial update
    this.updateFrameFromScroll();
  }

  private updateFrameFromScroll(): void {
    const scrollHeight = this.doc.documentElement.scrollHeight - window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const frameIndex = Math.floor(scrollProgress * (this.totalFrames - 1));

    this.currentFrameIndex.set(frameIndex);
  }

  private setupThemeListener(): void {
    // Check initial theme
    const isDark = !this.doc.documentElement.classList.contains('light');
    this.isDarkMode.set(isDark);

    // Listen for theme changes (MutationObserver on class changes)
    const observer = new MutationObserver(() => {
      const isDark = !this.doc.documentElement.classList.contains('light');
      this.isDarkMode.set(isDark);
    });

    observer.observe(this.doc.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  private updateBackgroundFrame(frameIndex: number, isDarkMode: boolean): void {
    const framePath = this.getFramePath(frameIndex, isDarkMode);
    const canvas = this.doc.getElementById('global-canvas') as HTMLElement;

    if (canvas) {
      canvas.style.backgroundImage = `url('${framePath}')`;
      canvas.style.backgroundSize = 'cover';
      canvas.style.backgroundPosition = 'center';
      canvas.style.backgroundRepeat = 'no-repeat';
      canvas.style.backgroundAttachment = 'fixed';

      // Apply invert filter for light mode to create light theme frames
      if (!isDarkMode) {
        canvas.style.filter = 'invert(1)';
      } else {
        canvas.style.filter = 'none';
      }
    }
  }

  private getFramePath(frameIndex: number, isDarkMode: boolean): string {
    // Pad frame number to 4 digits
    const paddedIndex = String(frameIndex).padStart(4, '0');
    return `assets/frames/frame_${paddedIndex}.webp`;
  }

  /**
   * Preload frames around current position for smoother scrolling
   */
  private preloadFrames(centerIndex: number, radius: number = 5): void {
    const start = Math.max(0, centerIndex - radius);
    const end = Math.min(this.totalFrames - 1, centerIndex + radius);

    for (let i = start; i <= end; i++) {
      this.preloadFrame(i);
    }
  }

  private preloadFrame(frameIndex: number): void {
    const cacheKey = `frame_${frameIndex}`;

    if (this.frameCache.has(cacheKey)) {
      return;
    }

    const img = new Image();
    const framePath = this.getFramePath(frameIndex, true);
    img.src = framePath;
    this.frameCache.set(cacheKey, framePath);
  }

  /**
   * Get current frame index (for debugging/monitoring)
   */
  getCurrentFrameIndex(): number {
    return this.currentFrameIndex();
  }

  /**
   * Get total frames count
   */
  getTotalFrames(): number {
    return this.totalFrames;
  }

  /**
   * Get current theme mode
   */
  isDark(): boolean {
    return this.isDarkMode();
  }
}
