import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import gsap from 'gsap';

@Injectable({
  providedIn: 'root'
})
export class FrameParallaxService {
  private doc = inject(DOCUMENT);

  private readonly totalFrames = 750;
  
  public preloadedImages: HTMLImageElement[] = [];
  public framesLoaded = signal<boolean>(false);
  public loadingProgress = signal<number>(0);

  // Callback to notify when preloading completes
  public onFramesLoaded?: () => void;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  
  // Continuous playback state
  private currentFrame = 0;
  private direction = 1; // 1 = forward, -1 = backward
  private baseSpeed = 15; // base frames per second
  private activeSpeedBoost = 0;
  private lastScrollTop = 0;
  private isPlaying = false;
  private lastFrameTime = 0;

  private parallaxCleanup?: () => void;
  private resizeListener?: () => void;

  constructor() {
    // Start preloading frames immediately on service initialization
    this.startPreloading();
  }

  private startPreloading(): void {
    let loadedCount = 0;
    const total = this.totalFrames;

    for (let i = 1; i <= total; i++) {
      const img = new Image();
      const paddedIndex = String(i).padStart(4, '0');
      const src = `assets/frames/frame_${paddedIndex}.webp`;

      img.onload = img.onerror = () => {
        loadedCount++;
        const progress = Math.round((loadedCount / total) * 100);
        this.loadingProgress.set(progress);

        // Update DOM elements for the loader directly
        const percentEl = this.doc.getElementById('loader-percentage');
        if (percentEl) {
          percentEl.textContent = `${progress}%`;
        }
        const barEl = this.doc.getElementById('loader-progress-bar');
        if (barEl) {
          barEl.style.width = `${progress}%`;
        }

        if (loadedCount === total) {
          this.framesLoaded.set(true);
          if (this.onFramesLoaded) {
            this.onFramesLoaded();
          }
        }
      };

      img.src = src;
      this.preloadedImages.push(img);
    }
  }

  public initCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Initial sizing and resize handler setup
    this.resizeCanvas();
    
    this.resizeListener = () => this.resizeCanvas();
    window.addEventListener('resize', this.resizeListener);

    // Setup mouse parallax effect
    this.setupMouseParallax();

    // Start continuous animation loop
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.lastScrollTop = window.scrollY;
    requestAnimationFrame((time) => this.animateLoop(time));
  }

  private animateLoop(now: number): void {
    if (!this.isPlaying) return;
    requestAnimationFrame((time) => this.animateLoop(time));

    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1); // cap dt to 100ms
    this.lastFrameTime = now;

    // 1. Scroll modulation logic
    const scrollTop = window.scrollY;
    const deltaScroll = scrollTop - this.lastScrollTop;

    if (deltaScroll !== 0) {
      // Set play direction based on last scroll direction
      this.direction = deltaScroll > 0 ? 1 : -1;

      // Calculate instantaneous scroll velocity (pixels per second)
      const instantVelocity = Math.abs(deltaScroll) / dt;

      // Map scroll velocity to a speed boost (tuned for highly visible scrollytelling)
      const targetBoost = Math.min(instantVelocity * 0.16, 200); // cap max boost

      // Blend in the new speed boost smoothly
      this.activeSpeedBoost = Math.max(this.activeSpeedBoost, targetBoost);
    }

    this.lastScrollTop = scrollTop;

    // Decay the speed boost exponentially back to 0
    this.activeSpeedBoost += (0 - this.activeSpeedBoost) * (1 - Math.exp(-4.5 * dt));

    // Total speed is base play speed + temporary speed boost
    const totalSpeed = this.baseSpeed + this.activeSpeedBoost;

    // Advance frame position
    this.currentFrame += this.direction * totalSpeed * dt;

    // Wrap frame position (looping background video)
    this.currentFrame = (this.currentFrame + this.totalFrames) % this.totalFrames;

    // Render the frame on canvas
    this.drawFrame(Math.floor(this.currentFrame));
  }

  private setupMouseParallax(): void {
    if (!this.canvas) return;

    // Apply scale slightly larger than 1 to hide edges during shift
    gsap.set(this.canvas, { scale: 1.05 });

    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;

      // Animate canvas position in opposite direction to create 3D parallax depth
      gsap.to(this.canvas, {
        x: nx * -15,
        y: ny * -15,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    };

    window.addEventListener('mousemove', onMouseMove);

    const originalCleanup = this.parallaxCleanup;
    this.parallaxCleanup = () => {
      if (originalCleanup) originalCleanup();
      window.removeEventListener('mousemove', onMouseMove);
    };
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    this.drawFrame(Math.floor(this.currentFrame));
  }

  private drawFrame(index: number): void {
    if (!this.ctx || !this.canvas || this.preloadedImages.length === 0) return;

    const img = this.preloadedImages[index];
    if (!img || !img.complete) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Frame size aspect ratio logic (Original: 3840x2160)
    const imgWidth = 3840;
    const imgHeight = 2160;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;

    if (canvasRatio < imgRatio) {
      drawWidth = canvasHeight * imgRatio;
    } else {
      drawHeight = canvasWidth / imgRatio;
    }

    // Calculate scroll fraction to interpolate ZOOM_FACTOR from 1.6 (top) to 2.0 (bottom)
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const scrollFraction = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0;
    const ZOOM_FACTOR = 1.6 + scrollFraction * 0.4;

    drawWidth *= ZOOM_FACTOR;
    drawHeight *= ZOOM_FACTOR;

    // Align to the left (offsetX = 0) and center vertically
    const offsetX = 0;
    const offsetY = (canvasHeight - drawHeight) / 2;

    this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  public destroy(): void {
    this.isPlaying = false;
    if (this.parallaxCleanup) {
      this.parallaxCleanup();
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  getCurrentFrameIndex(): number {
    return Math.floor(this.currentFrame);
  }
}
