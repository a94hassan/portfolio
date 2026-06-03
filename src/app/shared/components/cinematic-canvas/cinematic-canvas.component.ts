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
  @ViewChild('overlay') overlayRef!: ElementRef<HTMLElement>;
  @ViewChild('loader') loaderRef!: ElementRef<HTMLElement>;

  loadPct = 0;
  isLoaded = false;

  private frames: HTMLImageElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  private currentFrameIndex = 0;
  private readonly TOTAL_FRAMES = 151;
  // Source frames are 1172×1764 portrait; the subject (Hassan) stands centred on
  // a black backdrop, face high in the frame.
  //   FOCUS_Y   = source vertical fraction anchored to canvas centre (≈ the face)
  //   SUBJECT_X = subject's horizontal centre within the source
  //   SLOT_X    = where to place the subject on screen (0.5=centre, >0.5=right)
  // ZOOM gives headroom so the subject sits right-of-centre without black bars and
  // crops the baked-in KlingAI watermark at the bottom.
  private readonly FOCUS_Y = 0.17;
  private readonly SUBJECT_X = 0.48;
  private readonly SLOT_X = 0.70;
  private readonly ZOOM_FACTOR = 1.35;
  private cleanup: Array<() => void> = [];
  private zone = inject(NgZone);

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d')!;
      // Set initial state — opacity:1 + scale for parallax headroom
      gsap.set(canvas, { opacity: 1, scale: 1.08, transformOrigin: 'center center' });
      this.resizeCanvas();
      this.preloadFrames();
      this.initMouseParallax();

      const onResize = () => this.resizeCanvas();
      window.addEventListener('resize', onResize);
      this.cleanup.push(() => window.removeEventListener('resize', onResize));

      (window as any).__cinema = {
        setProgress: (p: number) => this.setProgress(p),
        setOpacity:  (v: number) => this.setOpacity(v)
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
    // Horizontal: push the subject toward SLOT_X, clamp so no black bar appears.
    let ox = this.SLOT_X * cw - this.SUBJECT_X * sw;
    ox = Math.min(0, Math.max(cw - sw, ox));
    // Vertical: anchor FOCUS_Y of the source to the canvas centre, then clamp.
    let oy = ch / 2 - this.FOCUS_Y * sh;
    oy = Math.min(0, Math.max(ch - sh, oy));

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

  /** Directly set video + overlay opacity — called on every scrub tick */
  setOpacity(v: number) {
    const o = Math.max(0, Math.min(1, v));
    gsap.set([this.canvasRef.nativeElement, this.overlayRef.nativeElement], { opacity: o });
  }

  private resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    // Render at device-pixel resolution for crisp frames on HiDPI/Retina
    // displays — the CSS box stays 100%×100% while the backing store scales up.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
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
