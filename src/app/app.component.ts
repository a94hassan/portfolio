import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { ThemeService } from './shared/services/theme.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import * as THREE from 'three';
import Lenis from 'lenis';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'portfolio';
  private zone         = inject(NgZone);
  private themeService = inject(ThemeService);
  private animId       = 0;
  private lenis?: Lenis;
  private threeCleanup?: () => void;
  private cursorCleanup?: () => void;
  private scrollCleanup?: () => void;

  ngOnInit() {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
    this.themeService.init();

    gsap.set('app-header', { y: -72, opacity: 0 });
    gsap.to('app-header',  { y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', delay: 0.2 });

    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) {
        if (!this.isMobile) this.initGlobalThreeJS();
        this.initLenis();
      }
      this.initCustomCursor();
      if (!this.isMobile && !reducedMotion) this.initElementTilt();
    });

    setTimeout(() => this.initJourney(), 500);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE DETECTION
  // ════════════════════════════════════════════════════════════════════════════

  private get isMobile(): boolean {
    return window.innerWidth <= 768; // simple, standard screen width check (bypasses touch false-positives)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LENIS — butter-smooth scroll, synced with GSAP ScrollTrigger
  // ════════════════════════════════════════════════════════════════════════════

  private initLenis() {
    this.lenis = new Lenis({
      duration:            1.3,
      easing:              (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation:         'vertical',
      gestureOrientation:  'vertical',
      smoothWheel:         true,
      wheelMultiplier:     1.0,
      touchMultiplier:     2.0,
      infinite:            false,
    });

    // Sync Lenis scroll events → GSAP ScrollTrigger updates
    this.lenis.on('scroll', () => ScrollTrigger.update());

    // Drive Lenis via GSAP ticker so both share the same RAF loop
    gsap.ticker.add((time) => { this.lenis!.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEXT — character-by-character 3D write-in animation
  // Each character flips up from rotateX:-80° (face-down) to 0° (upright),
  // staggered left-to-right. Combined with Instrument Serif italic 400,
  // this creates the "being written" handwriting effect.
  // ════════════════════════════════════════════════════════════════════════════

  private splitChars(el: Element): HTMLElement[] {
    // Guard: already split — return existing spans (no double-wrapping on revisit)
    if (el.querySelector('[data-char]')) {
      return Array.from(el.querySelectorAll('[data-char]')) as HTMLElement[];
    }
    const frag = document.createDocumentFragment();
    const spans: HTMLElement[] = [];

    // Walk child nodes so <br> elements are preserved as real line breaks.
    // textContent alone collapses <br> into \n which doesn't render in inline-block spans.
    const walk = (node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) {
        for (const ch of node.textContent ?? '') {
          if (ch === '\n') continue; // <br> already handled via BR branch
          const s = document.createElement('span');
          s.setAttribute('data-char', '1');
          s.style.display = 'inline-block';
          s.textContent = ch === ' ' ? ' ' : ch;
          frag.appendChild(s);
          spans.push(s);
        }
      } else if ((node as Element).tagName === 'BR') {
        frag.appendChild(document.createElement('br'));
      }
    };

    Array.from(el.childNodes).forEach(walk);
    el.innerHTML = '';
    el.appendChild(frag);
    return spans;
  }

  private writeIn(selector: string, delay = 0): gsap.core.Timeline {
    const el = document.querySelector(selector);
    if (!el) return gsap.timeline();
    gsap.set(el, { opacity: 1, y: 0 });
    const chars = this.splitChars(el);
    return gsap.timeline().fromTo(chars,
      { opacity: 0, y: 18 },
      { opacity: 1, y:  0,
        duration: 0.55, ease: 'power2.out',
        stagger: 0.026, delay }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY — 6-beat pinned scroll, single unified depth transition
  // ════════════════════════════════════════════════════════════════════════════

  private initJourney() {
    const stages = gsap.utils.toArray<HTMLElement>('.stage');
    if (stages.length < 6) {
      // Retry robustly in case Angular router has not settled/rendered the default route yet
      setTimeout(() => this.initJourney(), 100);
      return;
    }

    if (this.isMobile) { this.initMobileScroll(); return; }

    // ── Unified "forward through space" transition DNA ───────────────────────
    // Identical parameters for EVERY beat: outgoing recedes, incoming emerges.
    // Z_OFF / SC_OFF are intentionally subtle — the depth shift is felt, not seen.

    const Z_OFF   = -200;       // reduced: was -350 (too aggressive, caused flash)
    const SC_OFF  = 0.93;       // near-1: barely visible scale — depth cue
    const BLUR_OFF = 'blur(6px)';  // cinematic out-of-focus on departing section

    // Hero (stage 0) starts in focus; others start behind, blurred, hidden
    // Note: no filter set on stage[0] — setting filter:blur(0px) creates a stacking context
    // that breaks background-clip:text on descendant headings. Stage[0] is already in focus.
    const initialOut = { z: Z_OFF, scale: SC_OFF, opacity: 0, filter: BLUR_OFF };
    gsap.set(stages[1], initialOut);
    gsap.set(stages[2], initialOut);
    gsap.set(stages[3], initialOut);
    gsap.set(stages[4], initialOut);
    gsap.set(stages[5], initialOut);

    // Pre-hide content elements for entrance animations
    gsap.set([
      '.hero-name', '.hero-status', '.hero-role-wrap',
      '.hero-tagline', '.hero-actions', '.hero-email', '.hero-photo-wrapper',
    ], { opacity: 0, y: 10 });

    gsap.set([
      '.about-heading', '.about-body', '.about-trait', '.about-photo-wrap',
    ], { opacity: 0, y: 10 });

    gsap.set([
      '.skills-text h1', '.skills-text > p', '.skills-text > div:last-of-type',
    ], { opacity: 0, y: 10 });

    gsap.set('.skill-item', { opacity: 0, scale: 0.68, y: 10 });

    gsap.set([
      '.portfolio-heading h1', '.portfolio-sub',
    ], { opacity: 0, y: 10 });

    gsap.set([
      '.contact-heading h1', '.contact-columns',
    ], { opacity: 0, y: 10 });

    gsap.set(['.footer-rule', '.footer-name-block', '.footer-social', '.footer-legal'], { opacity: 0, y: 14 });

    // ── Master timeline: OUT/IN share identical parameters ───────────────────
    // The filter blur creates a cinematic "out of focus → snap to focus" effect
    // that harmonises with the camera's spiral descent through the particle vortex.
    const OUT = { z: Z_OFF, scale: SC_OFF, opacity: 0, filter: BLUR_OFF,    duration: 1, ease: 'power2.inOut' } as const;
    const IN  = { z: 0,     scale: 1,      opacity: 1, filter: 'blur(0px)', duration: 1, ease: 'power2.out'  } as const;

    const tl = gsap.timeline()
      // Beat 0→1: Hero → About
      .to(stages[0], { ...OUT }, 0)
      .to(stages[1], { ...IN  }, 0.06)
      // Beat 1→2: About → Skills
      .to(stages[1], { ...OUT }, 1)
      .to(stages[2], { ...IN  }, 1.06)
      // Beat 2→3: Skills → Portfolio
      .to(stages[2], { ...OUT }, 2)
      .to(stages[3], { ...IN  }, 2.06)
      // Beat 3→4: Portfolio card 1 → 2
      .to('.projects-track', { xPercent: -33.333, duration: 1, ease: 'power2.inOut' }, 3)
      // Beat 4→5: Portfolio card 2 → 3
      .to('.projects-track', { xPercent: -66.667, duration: 1, ease: 'power2.inOut' }, 4)
      // Beat 5→6: Portfolio → Contact
      .to(stages[3], { ...OUT }, 5)
      .to(stages[4], { ...IN  }, 5.06)
      // Beat 6→7: Contact → Footer
      .to(stages[4], { ...OUT }, 6)
      .to(stages[5], { ...IN  }, 6.06);

    // ── ScrollTrigger: responsive scrub + eager entrance reveal ──────────────
    // scrub: 0.22 → minimal lag, standard-feeling scroll with light smoothness.
    // snap.delay: 0.38 → snaps quickly after user stops (not sluggish).
    // fireEntrance fires on EVERY beat change via onUpdate — content reveals
    // as soon as the user scrolls halfway to the next section, no waiting for
    // onSnapComplete. This fixes about/skills/contact staying invisible.
    let rawF = 0;
    let lastBeat = -1;

    const fireBeat = (beat: number, seek = false) => {
      if (beat === lastBeat) return;
      lastBeat = beat;
      if (seek) tl.seek(beat / 7 * tl.duration());
      setTimeout(() => this.fireEntrance(beat), 40);
      // Notify Three.js: section transition → emit a pulse wave through the vortex
      (window as any).__beatPulse?.();
    };

    const st = ScrollTrigger.create({
      trigger: '#journey',
      start: 'top top',
      end: 'bottom bottom',
      // With Lenis providing smooth scroll, scrub can be very tight (near-instant).
      // Lenis handles all the easing — GSAP just needs to track the position.
      scrub: 0.06,
      animation: tl,
      snap: {
        snapTo:   1 / 7,
        duration: { min: 0.42, max: 0.75 },   // more cinematic snap
        delay:    0.18,                         // quicker to commit after release
        ease:     'power3.inOut',               // sharper in, softer out = cinematic
      },
      onUpdate:       (self) => { rawF = self.progress; fireBeat(Math.round(self.progress * 7)); },
      onSnapComplete: (self) => { fireBeat(Math.round(self.progress * 7), true); },
    });

    // ── Section link navigation ──────────────────────────────────────────────
    const BEAT: Record<string, number> = {
      above_the_fold_section: 0,
      about_me_section:       1,
      my_skills_section:      2,
      portfolio_section:      3,
      contact_section:        6,
    };
    const scrollMax = () => {
      const j = document.querySelector('#journey') as HTMLElement;
      return j ? j.scrollHeight - window.innerHeight : 0;
    };
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      if (id in BEAT) {
        e.preventDefault();
        const target = (BEAT[id] / 7) * scrollMax();
        // Prefer Lenis scrollTo (smooth, consistent with scroll easing)
        if (this.lenis) {
          this.lenis.scrollTo(target, { duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
        } else {
          gsap.to(window, { scrollTo: target, duration: 1.4, ease: 'power3.inOut' });
        }
      }
    });

    (window as any).__journeyProgress = () => rawF;
    this.scrollCleanup = () => st.kill();
    setTimeout(() => { lastBeat = 0; this.fireEntrance(0); }, 120);
    // Hide loader once first beat is animating in + fonts are ready
    this.scheduleLoaderHide(180);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOADER — fades out once page is ready + fonts loaded
  // ════════════════════════════════════════════════════════════════════════════

  private scheduleLoaderHide(extraDelay = 0) {
    const fire = () => setTimeout(() => this.hideLoader(), extraDelay);
    if ('fonts' in document && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(fire).catch(fire);
    } else {
      setTimeout(fire, 400); // legacy browsers
    }
  }

  private hideLoader() {
    const loader = document.getElementById('app-loader');
    if (!loader) return;
    loader.classList.add('hidden');
    // Remove fully after the CSS transition completes (matches 800ms duration)
    setTimeout(() => loader.remove(), 900);
  }

  private fireEntrance(beat: number) {
    const idx = beat <= 2 ? beat : beat <= 5 ? 3 : beat === 6 ? 4 : 5;
    const builders = [
      () => this.heroTl(),
      () => this.aboutTl(),
      () => this.skillsTl(),
      () => this.portfolioTl(beat - 3),
      () => this.contactTl(),
      () => this.footerTl(),
    ];
    builders[idx]?.()?.restart();
  }

  // ─── Section entrance timelines ───────────────────────────────────────────

  private heroTl() {
    return gsap.timeline()
      .add(this.writeIn('.hero-name', 0.08))
      .to('.hero-status',        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.20)
      .to('.hero-role-wrap',     { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.30)
      .to('.hero-tagline',       { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.40)
      .to('.hero-actions',       { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.50)
      .to('.hero-email',         { opacity: 1, y: 0, duration: 0.40, ease: 'power2.out' }, 0.58)
      .to('.hero-photo-wrapper', { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, 0.12);
  }

  private aboutTl() {
    return gsap.timeline()
      .to('.about-photo-wrap', { opacity: 1, y: 0, duration: 0.60, ease: 'power2.out', delay: 0.10 })
      .add(this.writeIn('.about-heading', 0.15))
      .to('.about-body',  { opacity: 1, y: 0, duration: 0.50, ease: 'power2.out' }, 0.55)
      .to('.about-trait', { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.10 }, 0.65);
  }

  private skillsTl() {
    return gsap.timeline()
      .add(this.writeIn('.skills-text h1', 0.08))
      .to('.skills-text > p',               { opacity: 1, y: 0, duration: 0.50, ease: 'power2.out' }, 0.45)
      .to('.skills-text > div:last-of-type',{ opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.55)
      .to('.skill-item', {
        opacity: 1, scale: 1, y: 0,
        duration: 0.40, ease: 'back.out(1.5)',
        stagger: { amount: 0.60, from: 'start', ease: 'power2.in' },
      }, 0.30);
  }

  private portfolioTl(cardIdx: number) {
    const panels = gsap.utils.toArray<HTMLElement>('.project-panel');
    const panel  = panels[Math.max(0, cardIdx)] ?? panels[0];
    const tl = gsap.timeline();
    // First beat of portfolio (cardIdx 0): animate heading + sub
    if (cardIdx === 0) {
      tl.add(this.writeIn('.portfolio-heading h1', 0.06))
        .to('.portfolio-sub', { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.55);
    }
    return tl.to(panel ?? '.project-panel', { opacity: 1, duration: 0.55, ease: 'power2.out', delay: cardIdx === 0 ? 0.18 : 0.06 });
  }

  private contactTl() {
    return gsap.timeline()
      .add(this.writeIn('.contact-heading h1', 0.08))
      .to('.contact-columns', { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, 0.50);
  }

  private footerTl() {
    return gsap.timeline()
      .to('.footer-rule',       { opacity: 1, y: 0, duration: 0.50, ease: 'power2.out', delay: 0.05 })
      .to('.footer-name-block', { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, 0.18)
      .to('.footer-social',     { opacity: 1, y: 0, duration: 0.50, ease: 'power2.out' }, 0.42)
      .to('.footer-legal',      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.56);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE SCROLL
  // ════════════════════════════════════════════════════════════════════════════

  private initMobileScroll() {
    gsap.from(['.hero-name', '.hero-text'], {
      opacity: 0, y: 24, duration: 0.65, stagger: 0.12,
      ease: 'power2.out', delay: 0.3, clearProps: 'opacity,transform',
    });

    const groups: Array<[string, string[]]> = [
      ['.about-content',   ['.about-photo-wrap', '.about-content']],
      ['.skills-grid',     ['.skills-grid', '.skills-text']],
      ['.contact-heading', ['.contact-heading', '.contact-columns']],
    ];

    groups.forEach(([trigger, targets]) => {
      const t = document.querySelector(trigger);
      if (!t) return;
      targets.forEach((sel, i) => {
        const el = document.querySelector(sel);
        if (!el) return;
        gsap.from(el, {
          scrollTrigger: { trigger: t, start: 'top 88%', once: true },
          opacity: 0, y: 22, duration: 0.62, ease: 'power2.out',
          delay: i * 0.11, clearProps: 'opacity,transform',
        });
      });
    });

    gsap.utils.toArray<HTMLElement>('.project-panel').forEach(panel => {
      gsap.from(panel, {
        scrollTrigger: { trigger: panel, start: 'top 90%', once: true },
        opacity: 0, y: 28, duration: 0.68, ease: 'power2.out',
        clearProps: 'opacity,transform',
      });
    });

    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      e.preventDefault();
    });

    (window as any).__journeyProgress = () => 0;
    this.scheduleLoaderHide(120);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // THREE.JS — Vortex / Strudel: spiral descent with reactive billiard physics
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Core concept: the user descends through a HELIX of stars. The camera spirals
  // down along a path INSIDE the helix, looking forward. Each individual star is
  // reactive: when the mouse cursor "collides" with it (proximity sphere), the
  // star receives an IMPULSE (3D bounce, billiard-style) AND lights up with a
  // GLOW HALO that decays over time. A custom ShaderMaterial provides per-particle
  // size and glow attributes — true individual reactivity, not a global effect.

  private initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let w = window.innerWidth, h = window.innerHeight;

    // Helper: Extract CSS variable color from computed root styles
    const getCSSColor = (varName: string, fallback: string): string => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return val || fallback;
    };

    // Get theme-aware particle colors from CSS variables
    const getRootFloat = (v: string, fb: number) =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || fb;

    const particleColorStr = getCSSColor('--particle-color', '#ede9e3');
    const particleGlowStr  = getCSSColor('--particle-glow',  '#fff8e8');
    const dustColorStr     = getCSSColor('--particle-color', '#ede9e3');
    const particleFogStr   = getCSSColor('--particle-fog',   '#070608');
    const dustOpacity      = getRootFloat('--particle-opacity', 0.12);
    const dustSize         = getRootFloat('--particle-size',    2.6);

    const scene = new THREE.Scene();
    // Exponential fog: distant stars dissolve into the deep-space background.
    scene.fog = new THREE.FogExp2(new THREE.Color(particleFogStr).getHex(), 0.00018);

    const camera   = new THREE.PerspectiveCamera(65, w / h, 1, 6000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(w, h);
    const dpr = navigator.hardwareConcurrency <= 4 ? 1.0 : Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr);

    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];
    const _c = (x: number, fy: number, z: number) =>
      new THREE.Vector3(x, fy !== 0 ? h * fy : 0, z);

    // ──────────────────────────────────────────────────────────────────────────
    // SPIRAL CAMERA PATH — descent through the vortex
    // ──────────────────────────────────────────────────────────────────────────
    // The camera traces a HELIX as it descends: cos(yT * 2π * TURNS) for X,
    // sin(yT * 2π * TURNS) blended into Z. We make 1.4 full turns over the
    // whole journey — enough to feel the rotation but not dizzying.
    // The Z component also has its own gentle dive-and-rise: start far (z=900,
    // outside the swirl), plunge through (z≈170 at deepest), then rise back.
    const CAM_TURNS = 1.4;
    const TWO_PI    = Math.PI * 2;
    const camSpiral = (yT: number, zOff: number): THREE.Vector3 => {
      const ang = yT * TWO_PI * CAM_TURNS;
      // Spiral radius widens at top/bottom, narrows in middle = vortex shape
      const r = 110 + Math.sin(yT * Math.PI) * 75;
      return new THREE.Vector3(Math.cos(ang) * r, yT * SY[4], zOff);
    };

    const camCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 900),         // outside the vortex, looking down
      camSpiral(0.05, 790), camSpiral(0.13, 620),
      camSpiral(0.22, 460), camSpiral(0.31, 330),
      camSpiral(0.40, 240), camSpiral(0.48, 180),   // deepest point of dive
      camSpiral(0.56, 190), camSpiral(0.64, 245),
      camSpiral(0.72, 305), camSpiral(0.79, 365),
      camSpiral(0.86, 430), camSpiral(0.92, 510),
      camSpiral(0.97, 590),
      new THREE.Vector3(0, SY[4], 680),
    ], false, 'catmullrom', 0.42);

    // Look-ahead curve: camera looks slightly ahead+down along the spiral,
    // creating the sensation of LEANING INTO the turn (like a fighter pilot).
    const lookSpiral = (yT: number): THREE.Vector3 => {
      const ang = yT * TWO_PI * CAM_TURNS + Math.PI * 0.45;  // ahead of cam position
      const r   = 55 + Math.sin(yT * Math.PI) * 35;
      return new THREE.Vector3(Math.cos(ang) * r, yT * SY[4] - h * 0.10, -40);
    };

    const lkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      lookSpiral(0.08), lookSpiral(0.18),
      lookSpiral(0.30), lookSpiral(0.42),
      lookSpiral(0.54), lookSpiral(0.66),
      lookSpiral(0.78), lookSpiral(0.88),
      lookSpiral(0.95),
      new THREE.Vector3(0, SY[4], -40),
    ], false, 'catmullrom', 0.42);

    // ──────────────────────────────────────────────────────────────────────────
    // PARTICLE LAYERS — Strudel/Vortex helix + ambient dust
    // ──────────────────────────────────────────────────────────────────────────

    const GA      = Math.PI * (3 - Math.sqrt(5));   // golden angle
    const totalY  = Math.abs(SY[4]) * 1.15;

    // ── Layer 1: Background dust (atmosphere, no helix structure) ─────────────
    // Wide cloud, very deep. More particles + larger spread for full-page coverage.
    // Power-distributed Z: ~40% near-mid (-300 to -1200), ~60% distant (-1200 to -5000).
    const DUST_PC = 200;
    const dPos = new Float32Array(DUST_PC * 3);
    const dBX  = new Float32Array(DUST_PC), dBY = new Float32Array(DUST_PC);
    const dFX  = new Float32Array(DUST_PC), dFY = new Float32Array(DUST_PC);
    const dPX  = new Float32Array(DUST_PC), dPY = new Float32Array(DUST_PC);
    // Directional drift — each dust particle has a slow constant flow direction
    const dVX  = new Float32Array(DUST_PC), dVY = new Float32Array(DUST_PC);

    for (let i = 0; i < DUST_PC; i++) {
      const ang = GA * i;
      // Wider horizontal spread — covers full viewport width and beyond
      const r   = 300 + Math.sqrt(Math.random()) * 1800;
      dBX[i] = Math.cos(ang) * r + (Math.random() - 0.5) * 400;
      // Evenly distributed across full journey Y, with extra scatter for density feel
      dBY[i] = (i / DUST_PC) * SY[4] + (Math.random() - 0.5) * h * 0.90;
      // Power-law Z distribution: skewed toward far distances for realistic depth fog
      const zPow = Math.pow(Math.random(), 0.45);   // 0=near, 1=far
      const z    = -380 - zPow * 4600;              // -380 near-mid → -4980 deep (pushed further)
      dFX[i] = 0.05 + Math.random() * 0.10;
      dFY[i] = 0.04 + Math.random() * 0.08;
      dPX[i] = Math.random() * TWO_PI;
      dPY[i] = Math.random() * TWO_PI;
      dVX[i] = (Math.random() - 0.5) * 0.14;   // slow lateral drift
      dVY[i] = (Math.random() - 0.5) * 0.09;
      dPos[i*3] = dBX[i]; dPos[i*3+1] = dBY[i]; dPos[i*3+2] = z;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: new THREE.Color(dustColorStr), size: dustSize, sizeAttenuation: true,
      transparent: true, opacity: dustOpacity, depthWrite: false, fog: true,
    });
    scene.add(new THREE.Points(dustGeo, dustMat));

    // ── Layer 2: HELIX STARS — the reactive vortex with per-particle glow ─────
    //
    // Each particle is placed in a HELICAL arrangement around the journey's
    // Y axis. HELIX_TURNS sets how many full revolutions the vortex makes
    // from top to bottom — 5 = visible swirl without becoming a wall.
    //
    // Custom ShaderMaterial: per-particle `aSize` and `aGlow` attributes.
    // - aSize:  varies 3-9 world units per particle → natural size variation
    // - aGlow:  0-1, set to ~1 on mouse collision, decays each frame
    //   When glowing: point expands +80%, becomes a bright halo via additive
    //   blending. Result: billiard-style "lit up on impact" feel in 3D space.
    const STAR_PC      = 240;
    const HELIX_TURNS  = 5;

    const sPos  = new Float32Array(STAR_PC * 3);
    const sSize = new Float32Array(STAR_PC);    // per-particle world size
    const sGlow = new Float32Array(STAR_PC);    // per-particle glow [0,1]

    // Per-particle motion state
    const sBX = new Float32Array(STAR_PC), sBY = new Float32Array(STAR_PC), sBZ = new Float32Array(STAR_PC);
    const sFX = new Float32Array(STAR_PC), sFY = new Float32Array(STAR_PC), sFZ = new Float32Array(STAR_PC);
    const sPX = new Float32Array(STAR_PC), sPY = new Float32Array(STAR_PC), sPZ = new Float32Array(STAR_PC);
    // Velocity (billiard physics)
    const svX = new Float32Array(STAR_PC), svY = new Float32Array(STAR_PC), svZ = new Float32Array(STAR_PC);

    for (let i = 0; i < STAR_PC; i++) {
      const phase = i / STAR_PC;
      // Helix angle: phase advances around the axis as we descend.
      // Add slight golden-angle scatter so the helix doesn't look mechanical.
      const ang = phase * TWO_PI * HELIX_TURNS + (i * GA) * 0.35 + (Math.random() - 0.5) * 0.6;

      // Radius profile: wider at journey extremes, slight pinch in middle =
      // hourglass-vortex shape that's most dramatic at the entry/exit points.
      const pinch  = 1 - Math.sin(phase * Math.PI) * 0.18;
      const baseR  = 170 + Math.random() * 380;
      const r      = baseR * pinch;

      sBX[i] = Math.cos(ang) * r;
      // Z arranges along the helix — particles wrap around in 3D, not just X-Y
      sBZ[i] = -260 + Math.sin(ang) * r * 0.55 + (Math.random() - 0.5) * 380;
      sBY[i] = phase * SY[4] + (Math.random() - 0.5) * h * 0.32;

      sFX[i] = 0.08 + Math.random() * 0.14;
      sFY[i] = 0.06 + Math.random() * 0.11;
      sFZ[i] = 0.03 + Math.random() * 0.06;
      sPX[i] = Math.random() * TWO_PI;
      sPY[i] = Math.random() * TWO_PI;
      sPZ[i] = Math.random() * TWO_PI;

      sSize[i] = 3 + Math.random() * 6;          // 3-9 world units
      sGlow[i] = 0;

      sPos[i*3] = sBX[i]; sPos[i*3+1] = sBY[i]; sPos[i*3+2] = sBZ[i];
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute('aSize',    new THREE.BufferAttribute(sSize, 1));
    starGeo.setAttribute('aGlow',    new THREE.BufferAttribute(sGlow, 1));

    // ── Custom ShaderMaterial — soft circular points with glow halo ────────────
    // Vertex shader: applies sizeAttenuation manually + glow-expanded size.
    // Fragment shader: circular falloff + glow lerp + manual fog integration.
    // AdditiveBlending: glowing particles add light (magical), non-glowing
    // particles use their alpha normally.
    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor:     { value: new THREE.Color(particleColorStr) },
        uGlowCol:   { value: new THREE.Color(particleGlowStr) },
        uFogColor:  { value: new THREE.Color(particleFogStr) },
        uFogDens:   { value: 0.00018 },
        uPixelR:    { value: dpr },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aGlow;
        varying float vGlow;
        varying float vFogD;
        uniform float uPixelR;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // sizeAttenuation: world-unit size shrinks with depth.
          // Glow expands the visual point up to +80% (collision impact).
          // max(-mv.z, 1.0) prevents any division-by-zero compilation or driver crash bugs!
          gl_PointSize = aSize * (1.0 + aGlow * 0.8) * uPixelR * 300.0 / max(-mv.z, 1.0);
          gl_Position  = projectionMatrix * mv;
          vGlow = aGlow;
          vFogD = -mv.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uGlowCol;
        uniform vec3 uFogColor;
        uniform float uFogDens;
        varying float vGlow;
        varying float vFogD;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float dist = length(uv);
          if (dist > 0.5) discard;
          // Soft base falloff (gentle blur, low alpha) - base opacity increased to 0.85 for premium luminosity
          float baseA = pow(smoothstep(0.5, 0.0, dist), 1.6) * 0.85;
          // Glow has a bright tight core + softer halo
          float core  = smoothstep(0.5, 0.06, dist);
          float halo  = smoothstep(0.5, 0.22, dist) * 0.55;
          float glowA = max(core, halo);
          float alpha = mix(baseA, glowA, vGlow);
          // Color lerps toward warm white when glowing
          vec3 col = mix(uColor, uGlowCol, vGlow * 0.85);
          // Fog: highly robust, linear exponential fog to prevent squared-value explosion
          float fogF = 1.0 - exp(-0.00015 * vFogD);
          col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,    // magical bloom on glow
    });
    // Initial blending: light mode can't use AdditiveBlending (adds nothing on bright bg)
    const isInitLight = document.documentElement.classList.contains('light');
    if (isInitLight) { starMat.blending = THREE.NormalBlending; starMat.needsUpdate = true; }
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Layer 0: Ambient camera-following cloud ────────────────────────────────
    // Unlike the helix (fixed world coords + Y-wrap), this cloud tracks the camera.
    // Result: particles are ALWAYS uniformly present across every section — no gaps.
    // Motion is omnidirectional sinusoidal drift, different from the spiral helix flow.
    const AMB_PC = 120;   // reduced — fewer, more spaced ambient particles
    const ambPos = new Float32Array(AMB_PC * 3);
    const aFX = new Float32Array(AMB_PC), aFY = new Float32Array(AMB_PC);
    const aPX = new Float32Array(AMB_PC), aPY = new Float32Array(AMB_PC);
    // Directional drift velocities — create genuine flow, not just oscillation
    const aVX = new Float32Array(AMB_PC), aVY = new Float32Array(AMB_PC);
    const AMB_HX = 720, AMB_HY = 480;   // camera-relative half-extents

    for (let i = 0; i < AMB_PC; i++) {
      ambPos[i*3]   = (Math.random() - 0.5) * AMB_HX * 2;
      ambPos[i*3+1] = (Math.random() - 0.5) * AMB_HY * 2;
      // Z: pushed further from camera — no particles within arm's reach
      ambPos[i*3+2] = -170 - Math.pow(Math.random(), 0.55) * 760;   // -170 to -930
      aFX[i] = 0.04 + Math.random() * 0.09;
      aFY[i] = 0.03 + Math.random() * 0.07;
      aPX[i] = Math.random() * TWO_PI;
      aPY[i] = Math.random() * TWO_PI;
      aVX[i] = (Math.random() - 0.5) * 0.28;   // slow constant drift direction
      aVY[i] = (Math.random() - 0.5) * 0.20;
    }

    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
    const ambMat = new THREE.PointsMaterial({
      color:          new THREE.Color(particleColorStr),
      size:           1.8,
      sizeAttenuation: true,
      transparent:    true,
      opacity:        0.08,
      depthWrite:     false,
      fog:            true,
      blending:       isInitLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(ambGeo, ambMat));

    // ──────────────────────────────────────────────────────────────────────────
    // BILLIARD PHYSICS — individual collision response with glow trigger
    // ──────────────────────────────────────────────────────────────────────────
    // REPULSE_R: world-unit radius — the "cue ball" size around the cursor.
    // REPULSE_F: impulse strength when at distance 0; scales linearly down to 0
    //            at REPULSE_R. Mouse speed multiplies this for fast-swipe punch.
    // DRAG:      per-frame velocity multiplier — particles slow exponentially
    //            and drift back to their natural helix path.
    // GLOW_*:    glow attribute is set on impact, decays each frame.
    const REPULSE_R   = 105;     // collision sphere radius
    const REPULSE_F   = 2.4;     // base impulse strength
    const DRAG        = 0.875;   // velocity decay per frame
    const GLOW_HIT    = 0.85;    // glow added per direct hit
    const GLOW_DECAY  = 0.93;    // glow attribute decay per frame
    const tanHFov     = Math.tan(32.5 * Math.PI / 180);

    let mNX = 0, mNY = 0, smX = 0, smY = 0;
    let prevMX = 0, prevMY = 0, mSpeed = 0;
    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / w - 0.5) * 2;
      const ny = -((e.clientY / h) - 0.5) * 2;
      mSpeed = Math.min(Math.sqrt((nx - prevMX) ** 2 + (ny - prevMY) ** 2), 0.12);
      prevMX = mNX; prevMY = mNY;
      mNX = nx; mNY = ny;
    };

    const sCam = new THREE.Vector3(0, 0, 900);
    const sLk  = new THREE.Vector3(0, 0, 0);
    const tCam = new THREE.Vector3(), tLk = new THREE.Vector3();
    const upV  = new THREE.Vector3(0, 1, 0);
    let sFrac = 0, time = 0;

    // ── Beat-pulse system — UI section change emits a glow wave ────────────────
    // Triggered from initJourney's fireBeat. A pulse lasts ~0.7s, with strength
    // attenuated by distance from the camera's current Y. Stars near the camera
    // light up brightest; far ones get a softer touch. Visually: a shimmer
    // ripples through the vortex right when a section enters.
    const PULSE_DURATION = 0.7;
    const PULSE_REACH    = 1.0;          // multiples of viewport h
    let pulseStart       = -10;          // last beat-change time
    (window as any).__beatPulse = () => { pulseStart = time; };

    // 30fps cap — heavy math 30Hz, RAF 60Hz for scheduling smoothness
    let lastRender = 0;
    const FRAME_MS = 1000 / 30;

    const animate = (now: number) => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);
      if (now - lastRender < FRAME_MS) return;
      lastRender = now;
      time += 0.014;
      smX += (mNX - smX) * 0.036;
      smY += (mNY - smY) * 0.036;

      const rawF    = (window as any).__journeyProgress?.() ?? 0;
      const camFrac = Math.min(rawF * 7 / 6, 1.0);
      sFrac += (camFrac - sFrac) * 0.032;

      camCurve.getPoint(Math.min(sFrac, 0.9999), tCam);
      lkCurve.getPoint( Math.min(sFrac, 0.9999), tLk);
      tCam.x += smX * 6; tCam.y += smY * 3;
      sCam.lerp(tCam, 0.030); sLk.lerp(tLk, 0.030);
      camera.position.copy(sCam);
      // Slight cam roll based on spiral angle — adds organic banking feel
      const roll = Math.cos(sFrac * TWO_PI * CAM_TURNS) * 0.032;
      upV.set(roll, 1, 0).normalize();
      camera.up.lerp(upV, 0.025);
      camera.lookAt(sLk);

      const aspect = w / h;

      // Active pulse intensity for this frame (0 if no recent beat change)
      const pulseElapsed = time - pulseStart;
      const pulseActive  = pulseElapsed < PULSE_DURATION;
      const pulseStrength = pulseActive
        ? Math.pow(1 - pulseElapsed / PULSE_DURATION, 1.6)  // ease-out cubic-ish
        : 0;
      const pulseReachW  = h * PULSE_REACH;

      // ── HELIX STARS: drift + billiard physics + glow per particle ─────────
      const sp = starGeo.attributes['position'].array as Float32Array;
      const sg = starGeo.attributes['aGlow'].array as Float32Array;
      let glowDirty = false;

      for (let i = 0; i < STAR_PC; i++) {
        const ix = i*3, iy = ix+1, iz = ix+2;
        // Natural sinusoidal drift around base helix position
        const natX = sBX[i] + Math.sin(time * sFX[i] + sPX[i]) * 22;
        const natY = sBY[i] + Math.sin(time * sFY[i] + sPY[i]) * 14;
        const natZ = sBZ[i] + Math.sin(time * sFZ[i] + sPZ[i]) * 11;

        // ── Mouse collision detection ────────────────────────────────────
        // Unproject mouse NDC → world coords at this particle's Z plane.
        // dist² < R² → collision → impulse + glow.
        const dz = sCam.z - natZ;
        if (dz > 0) {
          const mwx = sCam.x + smX * dz * tanHFov * aspect;
          const mwy = sCam.y + smY * dz * tanHFov;
          const dx  = natX - mwx, dy2 = natY - mwy;
          const d2  = dx*dx + dy2*dy2;
          if (d2 < REPULSE_R * REPULSE_R && d2 > 0.25) {
            const d   = Math.sqrt(d2);
            const prox = 1 - d / REPULSE_R;
            const imp  = prox * REPULSE_F * (1 + mSpeed * 14);
            // Bounce direction: away from cursor (3D — XY plane at particle depth)
            svX[i] += (dx  / d) * imp;
            svY[i] += (dy2 / d) * imp;
            // Tiny Z impulse: particle is also pushed slightly forward/back
            svZ[i] += (Math.sign(dz - 50) || 1) * prox * 0.6;
            // GLOW: set on collision, proportional to closeness + mouse speed.
            // Brighter on direct hits and fast swipes.
            sg[i] = Math.min(1.0, sg[i] + prox * (GLOW_HIT + mSpeed * 6));
            glowDirty = true;
          }
        }

        // Exponential drag — particle bounces back, decelerates, returns to path
        svX[i] *= DRAG; svY[i] *= DRAG; svZ[i] *= DRAG;

        sp[ix] = natX + svX[i];
        sp[iy] = natY + svY[i];
        sp[iz] = natZ + svZ[i];

        // Beat pulse: particles near camera Y get a soft glow lift,
        // creating the harmony between section change and the vortex
        if (pulseActive) {
          const dYcam = Math.abs(natY - sCam.y);
          if (dYcam < pulseReachW) {
            const dProx = 1 - dYcam / pulseReachW;
            sg[i] = Math.min(1.0, sg[i] + pulseStrength * dProx * 0.22);
            glowDirty = true;
          }
        }

        // Glow decay — particles return to non-glowing over ~30 frames
        if (sg[i] > 0.002) {
          sg[i] *= GLOW_DECAY;
          glowDirty = true;
        } else if (sg[i] > 0) {
          sg[i] = 0;
          glowDirty = true;
        }

        // Y-wrap: keep helix infinitely centred on the camera as we descend
        const dyW = sp[iy] - sCam.y;
        if (dyW >  totalY * 0.52) { sp[iy] -= totalY; sBY[i] -= totalY; }
        if (dyW < -totalY * 0.52) { sp[iy] += totalY; sBY[i] += totalY; }
      }
      starGeo.attributes['position'].needsUpdate = true;
      if (glowDirty) starGeo.attributes['aGlow'].needsUpdate = true;

      // ── DUST: directional drift + atmospheric oscillation ─────────────────
      const dp = dustGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < DUST_PC; i++) {
        const ix = i*3, iy = ix+1;
        // Advance base position by directional drift each frame → genuine flow
        dBX[i] += dVX[i];
        dBY[i] += dVY[i];
        dp[ix] = dBX[i] + Math.sin(time * dFX[i] + dPX[i]) * 16;
        dp[iy] = dBY[i] + Math.sin(time * dFY[i] + dPY[i]) * 10;
        // X-wrap — keep drifting particles visible
        const dxW = dBX[i] - sCam.x;
        if (dxW >  2400) { dBX[i] -= 4800; }
        if (dxW < -2400) { dBX[i] += 4800; }
        const dyW = dp[iy] - sCam.y;
        if (dyW >  totalY * 0.52) { dp[iy] -= totalY; dBY[i] -= totalY; }
        if (dyW < -totalY * 0.52) { dp[iy] += totalY; dBY[i] += totalY; }
      }
      dustGeo.attributes['position'].needsUpdate = true;

      // ── AMBIENT CLOUD: directional drift + oscillation + camera-relative wrap
      // Each particle has a fixed drift direction (aVX/aVY) so it visibly flows,
      // plus a sin oscillation for organic variation. Wrap keeps coverage uniform.
      const ap = ambGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < AMB_PC; i++) {
        const ix = i*3, iy = ix+1;
        ap[ix] += aVX[i] + Math.sin(time * aFX[i] + aPX[i]) * 0.36;
        ap[iy] += aVY[i] + Math.cos(time * aFY[i] + aPY[i]) * 0.28;
        const relX = ap[ix] - sCam.x;
        const relY = ap[iy] - sCam.y;
        if (relX >  AMB_HX) ap[ix] -= AMB_HX * 2;
        if (relX < -AMB_HX) ap[ix] += AMB_HX * 2;
        if (relY >  AMB_HY) ap[iy] -= AMB_HY * 2;
        if (relY < -AMB_HY) ap[iy] += AMB_HY * 2;
      }
      ambGeo.attributes['position'].needsUpdate = true;

      renderer.render(scene, camera);
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      starMat.uniforms['uPixelR'].value = renderer.getPixelRatio();
    };
    const onVis = () => { if (!document.hidden && this.animId === 0) animate(performance.now()); };

    // Live theme-colour update — fires when user toggles dark/light
    const updateThemeColors = () => {
      const isLight = document.documentElement.classList.contains('light');
      const col  = getCSSColor('--particle-color', '#ede9e3');
      const glow = getCSSColor('--particle-glow',  '#fff8e8');
      const fog  = getCSSColor('--particle-fog',   '#070608');
      const op   = getRootFloat('--particle-opacity', 0.12);
      const sz   = getRootFloat('--particle-size',    2.6);

      starMat.uniforms['uColor'].value.set(col);
      starMat.uniforms['uGlowCol'].value.set(glow);
      starMat.uniforms['uFogColor'].value.set(fog);
      (scene.fog as THREE.FogExp2).color.set(fog);

      // Blending: AdditiveBlending = glowing stars on dark bg (magical).
      // NormalBlending = opaque specs on bright bg (required for visibility on light mode).
      starMat.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
      starMat.needsUpdate = true;

      dustMat.color.set(col);
      dustMat.opacity = op;
      dustMat.size    = sz;
      dustMat.needsUpdate = true;

      ambMat.color.set(col);
      ambMat.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
      ambMat.needsUpdate = true;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize',   onResize);
    window.addEventListener('themeChange', updateThemeColors);
    document.addEventListener('visibilitychange', onVis);
    animate(performance.now());

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',   onResize);
      window.removeEventListener('themeChange', updateThemeColors);
      document.removeEventListener('visibilitychange', onVis);
      delete (window as any).__beatPulse;
      renderer.dispose();
      dustGeo.dispose();  dustMat.dispose();
      starGeo.dispose();  starMat.dispose();
      ambGeo.dispose();   ambMat.dispose();
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3D TILT — premium card behaviour on skill items + project cards
  // Mouse position drives rotateX/rotateY around the card centre. Damped via
  // GSAP power2.out for smooth follow; elastic ease-out on leave for "snap back"
  // feel. Max ±9° tilt with 700px perspective = subtle but distinctly 3D.
  // ════════════════════════════════════════════════════════════════════════════

  private initElementTilt() {
    const attachTilt = () => {
      const targets = document.querySelectorAll<HTMLElement>('.skill-item, .project-info');
      targets.forEach((el) => {
        if (el.dataset['tiltBound']) return;          // idempotent — don't double-bind
        el.dataset['tiltBound'] = '1';
        let rect: DOMRect | null = null;

        el.addEventListener('mouseenter', () => { rect = el.getBoundingClientRect(); });
        el.addEventListener('mousemove', (e) => {
          if (!rect) rect = el.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;   // -1 .. 1
          const py = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
          gsap.to(el, {
            rotateY: px *  9,
            rotateX: py * -9,
            transformPerspective: 700,
            transformOrigin: '50% 50%',
            duration: 0.35,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        });
        el.addEventListener('mouseleave', () => {
          rect = null;
          gsap.to(el, {
            rotateX: 0, rotateY: 0,
            duration: 0.85,
            ease: 'elastic.out(1, 0.55)',
            overwrite: 'auto',
          });
        });
      });
    };

    // Skill items render via @for from a service — wait for the DOM to settle.
    // 950ms aligns with the custom cursor's spotlight-binding delay.
    setTimeout(attachTilt, 950);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOM CURSOR
  // ════════════════════════════════════════════════════════════════════════════

  private initCustomCursor() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const ring = document.getElementById('cursor-ring');
    const dot  = document.getElementById('cursor-dot');
    if (!ring || !dot) return;

    gsap.set(ring, { xPercent: -50, yPercent: -50 });
    gsap.set(dot,  { xPercent: -50, yPercent: -50 });

    const isLight   = () => document.documentElement.classList.contains('light');
    const ringBase  = () => isLight() ? 'rgba(17,17,17,0.32)'  : 'rgba(255,255,255,0.40)';
    const ringHover = () => isLight() ? 'rgba(17,17,17,0.72)'  : 'rgba(255,255,255,0.75)';

    let appeared = false;
    const SEL = 'app-header,.skill-item,button,a,input,textarea';
    let spotEls: HTMLElement[] = [], rects: DOMRect[] = [];
    const refresh = () => { rects = spotEls.map(el => el.getBoundingClientRect()); };
    setTimeout(() => { spotEls = Array.from(document.querySelectorAll(SEL)); refresh(); }, 900);

    const onMove = (e: MouseEvent) => {
      if (!appeared) { gsap.to([ring, dot], { opacity: 1, duration: 0.4 }); appeared = true; }
      gsap.to(dot,  { x: e.clientX, y: e.clientY, duration: 0 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.18, ease: 'power2.out' });
      rects.forEach((r, i) => {
        spotEls[i]?.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spotEls[i]?.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    const onOver  = (e: MouseEvent) => {
      if ((e.target as Element).closest('a,button,input,textarea'))
        gsap.to(ring, { scale: 1.7, borderColor: ringHover(), duration: 0.22 });
    };
    const onOut   = (e: MouseEvent) => {
      if ((e.target as Element).closest('a,button,input,textarea'))
        gsap.to(ring, { scale: 1, borderColor: ringBase(), duration: 0.22 });
    };
    const onLeave = () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    const onEnter = () => { if (appeared) gsap.to([ring, dot], { opacity: 1, duration: 0.3 }); };

    window.addEventListener('mousemove',   onMove,  { passive: true });
    window.addEventListener('scroll',      refresh, { passive: true });
    window.addEventListener('resize',      refresh, { passive: true });
    document.addEventListener('mouseover',  onOver);
    document.addEventListener('mouseout',   onOut);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    this.cursorCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll',    refresh);
      window.removeEventListener('resize',    refresh);
      document.removeEventListener('mouseover',  onOver);
      document.removeEventListener('mouseout',   onOut);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
  }

  ngOnDestroy() {
    this.threeCleanup?.();
    this.cursorCleanup?.();
    this.scrollCleanup?.();
    this.lenis?.destroy();
    ScrollTrigger.getAll().forEach(t => t.kill());
    gsap.killTweensOf(window);
  }
}
