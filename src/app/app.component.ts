import { Component, NgZone, OnDestroy, OnInit, afterNextRender, inject, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { FrameParallaxService } from './core/services/frame-parallax.service';
import { AiChatComponent } from './shared/components/ai-chat/ai-chat.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, AiChatComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'portfolio';
  private zone = inject(NgZone);
  private themeService = inject(ThemeService);
  private frameService = inject(FrameParallaxService);
  private animId = 0;
  private lenis?: Lenis;

  private cursorCleanup?: () => void;
  private feedbackCleanup?: () => void;
  private scrollCleanup?: () => void;

  constructor() {
    // Hide the loading overlay only after the frames are fully preloaded
    this.frameService.onFramesLoaded = () => {
      this.scheduleLoaderHide(150);
    };

    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion) {
          this.initLenis();
        }
        this.initCustomCursor();
        if (!this.isMobile && !reducedMotion) {
          this.initButtonFeedback();
        }

        // Initialize the WebP frames canvas player
        const globalCanvas = document.getElementById('global-canvas') as HTMLCanvasElement;
        if (globalCanvas) {
          this.frameService.initCanvas(globalCanvas);
        }

        this.initScrollSystem();

        // Handle URL hash on load
        if (window.location.hash) {
          const id = window.location.hash.slice(1);
          const target = document.getElementById(id);
          if (target) {
            setTimeout(() => {
              const headerH = 80;
              const top = target.getBoundingClientRect().top + window.scrollY - headerH;
              if (this.lenis) {
                this.lenis.scrollTo(top, { duration: 1.2 });
              } else {
                window.scrollTo({ top, behavior: 'smooth' });
              }
            }, 600);
          }
        }
      });
    });
  }

  ngOnInit() {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
    this.themeService.init();

    // Header entrance
    gsap.set('app-header', { y: -72, opacity: 0 });
    gsap.to('app-header', { y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', delay: 0.2 });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE DETECTION
  // ════════════════════════════════════════════════════════════════════════════

  private get isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LENIS — butter-smooth scroll, synced with GSAP ScrollTrigger
  // ════════════════════════════════════════════════════════════════════════════

  private initLenis() {
    this.lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 2.0,
      infinite: false,
    });

    this.lenis.on('scroll', () => ScrollTrigger.update());
    gsap.ticker.add((time) => { this.lenis!.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    // Expose for cross-component access (e.g. project.component navigate())
    window.__lenis = this.lenis;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCROLL SYSTEM — natural document scroll with section reveal animations
  // ════════════════════════════════════════════════════════════════════════════

  private initScrollSystem() {
    // ── Section link navigation ──────────────────────────────────────────────
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);

      // If we are not on the main page, redirect to home page with hash
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        e.preventDefault();
        window.location.href = '/' + a.getAttribute('href');
        return;
      }

      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();

      const headerH = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH;

      if (this.lenis) {
        this.lenis.scrollTo(top, { duration: 1.4, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
      } else {
        gsap.to(window, { scrollTo: top, duration: 1.4, ease: 'power3.inOut' });
      }
    };
    document.addEventListener('click', onLinkClick);

    this.scrollCleanup = () => {
      document.removeEventListener('click', onLinkClick);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOADER
  // ════════════════════════════════════════════════════════════════════════════

  private scheduleLoaderHide(extraDelay = 0) {
    const fire = () => setTimeout(() => this.hideLoader(), extraDelay);
    if ('fonts' in document && document.fonts?.ready) {
      document.fonts.ready.then(fire).catch(fire);
    } else {
      setTimeout(fire, 400);
    }
  }

  private hideLoader() {
    const loader = document.getElementById('app-loader');
    if (!loader) return;
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 900);
  }



  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOM CURSOR
  // ════════════════════════════════════════════════════════════════════════════

  private initCustomCursor() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const ring = document.getElementById('cursor-ring');
    const dot = document.getElementById('cursor-dot');
    if (!ring || !dot) return;

    gsap.set(ring, { xPercent: -50, yPercent: -50 });
    gsap.set(dot, { xPercent: -50, yPercent: -50 });

    const isLight = () => document.documentElement.classList.contains('light');
    const ringBase = () => isLight() ? 'rgba(17,17,17,0.32)' : 'rgba(255,255,255,0.40)';
    const ringHover = () => isLight() ? 'rgba(17,17,17,0.72)' : 'rgba(255,255,255,0.75)';

    let appeared = false;
    const SEL = 'app-header,.skill-item,button,a,input,textarea,form,.project-info,.project-img-wrap,.about-icon,.social-icon-link';
    let spotEls: HTMLElement[] = [], rects: DOMRect[] = [];
    const refresh = () => { rects = spotEls.map(el => el.getBoundingClientRect()); };
    spotEls = Array.from(document.querySelectorAll(SEL));
    refresh();

    const onMove = (e: MouseEvent) => {
      if (!appeared) { gsap.to([ring, dot], { opacity: 1, duration: 0.4 }); appeared = true; }
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.18, ease: 'power2.out' });
      rects.forEach((r, i) => {
        spotEls[i]?.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spotEls[i]?.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    const onOver = (e: MouseEvent) => {
      if ((e.target as Element).closest('a,button,input,textarea')) {
        gsap.to(ring, {
          scale: 1.8,
          borderColor: ringHover(),
          backgroundColor: isLight() ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.07)',
          boxShadow: isLight() ? '0 0 16px rgba(0, 0, 0, 0.12)' : '0 0 16px rgba(255, 255, 255, 0.22)',
          duration: 0.25,
          ease: 'power2.out'
        });
        gsap.to(dot, { scale: 1.5, duration: 0.25 });
      }
    };
    const onOut = (e: MouseEvent) => {
      if ((e.target as Element).closest('a,button,input,textarea')) {
        gsap.to(ring, {
          scale: 1,
          borderColor: ringBase(),
          backgroundColor: 'rgba(255, 255, 255, 0)',
          boxShadow: 'none',
          duration: 0.25,
          ease: 'power2.out'
        });
        gsap.to(dot, { scale: 1, duration: 0.25 });
      }
    };
    const onLeave = () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    const onEnter = () => { if (appeared) gsap.to([ring, dot], { opacity: 1, duration: 0.3 }); };
    const onClick = () => {
      if (!appeared) return;
      gsap.fromTo(ring,
        { scale: 1, opacity: 1 },
        {
          scale: 2.8, opacity: 0, duration: 0.44, ease: 'power2.out',
          onComplete: () => gsap.set(ring, { scale: 1, opacity: 1 })
        }
      );
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('click', onClick);

    this.cursorCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', refresh);
      window.removeEventListener('resize', refresh);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      document.removeEventListener('click', onClick);
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BUTTON FEEDBACK — elastic click punch + magnetic hover on nav/CTAs
  // ════════════════════════════════════════════════════════════════════════════

  private initButtonFeedback() {
    const onGlobalClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>('button, a');
      if (!el || el.closest('.skill-item, .project-info')) return;
      gsap.fromTo(el,
        { scale: 0.93 },
        { scale: 1, duration: 0.55, ease: 'elastic.out(1.1, 0.5)', overwrite: 'auto' }
      );
    };
    document.addEventListener('click', onGlobalClick);

    const attachMagnetic = () => {
      document.querySelectorAll<HTMLElement>('nav a, .nav-link, .btn-primary, .cta-btn').forEach(el => {
        if (el.dataset['magBound']) return;
        el.dataset['magBound'] = '1';
        el.addEventListener('mousemove', (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width - 0.5) * 2;
          const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
          gsap.to(el, { x: px * 7, y: py * 3.5, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        });
        el.addEventListener('mouseleave', () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
        });
      });
    };
    attachMagnetic();

    this.feedbackCleanup = () => document.removeEventListener('click', onGlobalClick);
  }

  ngOnDestroy() {
    this.cursorCleanup?.();
    this.feedbackCleanup?.();
    this.scrollCleanup?.();
    this.frameService.destroy();
    this.lenis?.destroy();
    delete window.__lenis;
    gsap.killTweensOf(window);
  }
}
