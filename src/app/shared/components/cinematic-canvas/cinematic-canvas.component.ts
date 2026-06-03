import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone, inject } from '@angular/core';
import gsap from 'gsap';

@Component({
  selector: 'app-cinematic-canvas',
  standalone: true,
  imports: [],
  templateUrl: './cinematic-canvas.component.html',
  styleUrl: './cinematic-canvas.component.scss'
})
export class CinematicCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('loader') loaderRef!: ElementRef<HTMLElement>;

  loadPct = 0;
  isLoaded = false;

  private frames: HTMLImageElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  private currentFrameIndex = 0;
  private currentlyVisible = true;
  private readonly TOTAL_FRAMES = 151;
  private readonly ZOOM_FACTOR = 1.08;
  private cleanup: Array<() => void> = [];
  private zone = inject(NgZone);

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d')!;
      // Set scale via GSAP so parallax x/y animations don't reset it
      gsap.set(canvas, { scale: 1.08, transformOrigin: 'center center' });
      this.resizeCanvas();
      this.preloadFrames();
      this.initMouseParallax();

      const onResize = () => this.resizeCanvas();
      window.addEventListener('resize', onResize);
      this.cleanup.push(() => window.removeEventListener('resize', onResize));

      (window as any).__cinema = {
        setProgress: (p: number) => this.setProgress(p),
        setOpacity:  (v: number) => this.setOpacity(v),
        setVisible:  (v: boolean) => this.setVisible(v)
      };
    });
  }

  private preloadFrames() {
    let loaded = 0;
    this.frames = new Array(this.TOTAL_FRAMES);

    for (let i = 0; i < this.TOTAL_FRAMES; i++) {
      const img = new Image();
      const num  = String(i + 1).padStart(3, '0');
      img.src    = `assets/frames/ezgif-frame-${num}.jpg`;

      img.onload = () => {
        loaded++;
        this.zone.run(() => {
          this.loadPct = Math.round((loaded / this.TOTAL_FRAMES) * 100);
        });

        if (i === 0) this.drawFrame(0); // show first frame ASAP

        if (loaded === this.TOTAL_FRAMES) {
          this.zone.run(() => { this.isLoaded = true; });
          // Fade out loader overlay
          const loader = this.loaderRef?.nativeElement;
          if (loader) {
            gsap.to(loader, { opacity: 0, duration: 0.7, ease: 'power2.inOut',
              onComplete: () => { loader.style.display = 'none'; }
            });
          }
        }
      };

      this.frames[i] = img;
    }
  }

  private drawFrame(index: number) {
    const idx = Math.max(0, Math.min(index, this.TOTAL_FRAMES - 1));
    const img = this.frames[idx];
    if (!img?.complete || !img.naturalWidth) return;

    const canvas = this.canvasRef.nativeElement;
    const { width: cw, height: ch } = canvas;
    const { naturalWidth: iw, naturalHeight: ih } = img;

    const scale = Math.max(cw / iw, ch / ih) * this.ZOOM_FACTOR;
    const sw = iw * scale;
    const sh = ih * scale;
    const ox = (cw - sw) / 2;
    const oy = (ch - sh) / 2;

    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, ox, oy, sw, sh);
  }

  setProgress(p: number) {
    const idx = Math.round(Math.max(0, Math.min(1, p)) * (this.TOTAL_FRAMES - 1));
    if (idx !== this.currentFrameIndex) {
      this.currentFrameIndex = idx;
      this.drawFrame(idx);
    }
  }

  /** Directly set canvas opacity — called on every scrub tick, no tween needed */
  setOpacity(v: number) {
    gsap.set(this.canvasRef.nativeElement, { opacity: Math.max(0, Math.min(1, v)) });
  }

  setVisible(visible: boolean) {
    if (visible === this.currentlyVisible) return;
    this.currentlyVisible = visible;
    gsap.to(this.canvasRef.nativeElement, {
      opacity: visible ? 1 : 0,
      duration: 0.55,
      ease: 'power2.inOut'
    });
  }

  private resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    this.drawFrame(this.currentFrameIndex);
  }

  private initMouseParallax() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const canvas = this.canvasRef.nativeElement;

    const handler = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      gsap.to(canvas, {
        x: -nx * 20,
        y: -ny * 12,
        duration: 1.5,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    };
    window.addEventListener('mousemove', handler);
    this.cleanup.push(() => window.removeEventListener('mousemove', handler));
  }

  ngOnDestroy() {
    this.cleanup.forEach(fn => fn());
    delete (window as any).__cinema;
  }
}
