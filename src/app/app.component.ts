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
    });

    setTimeout(() => this.initJourney(), 500);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE DETECTION
  // ════════════════════════════════════════════════════════════════════════════

  private get isMobile(): boolean {
    return window.innerWidth <= 900 || !window.matchMedia('(hover: hover)').matches;
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
    gsap.set(el, { perspective: 900, transformStyle: 'preserve-3d' });
    const chars = this.splitChars(el);
    return gsap.timeline().fromTo(chars,
      { opacity: 0, rotateX: -80, y: 18, transformOrigin: '50% 100%' },
      { opacity: 1, rotateX:   0, y:  0,
        duration: 0.52, ease: 'back.out(1.4)',
        stagger: 0.026, delay }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY — 6-beat pinned scroll, single unified depth transition
  // ════════════════════════════════════════════════════════════════════════════

  private initJourney() {
    const stages = gsap.utils.toArray<HTMLElement>('.stage');
    if (stages.length < 6) return;

    if (this.isMobile) { this.initMobileScroll(); return; }

    // ── Unified "forward through space" transition DNA ───────────────────────
    // Identical parameters for EVERY beat: outgoing recedes, incoming emerges.
    // Z_OFF / SC_OFF are intentionally subtle — the depth shift is felt, not seen.

    const Z_OFF  = -200;  // reduced: was -350 (too aggressive, caused flash)
    const SC_OFF = 0.93;  // near-1: barely visible scale — depth cue, not distortion

    // All non-hero stages start behind the viewer (far in the distance)
    gsap.set(stages[1], { z: Z_OFF, scale: SC_OFF, opacity: 0 });
    gsap.set(stages[2], { z: Z_OFF, scale: SC_OFF, opacity: 0 });
    gsap.set(stages[3], { z: Z_OFF, scale: SC_OFF, opacity: 0 });
    gsap.set(stages[4], { z: Z_OFF, scale: SC_OFF, opacity: 0 });
    gsap.set(stages[5], { z: Z_OFF, scale: SC_OFF, opacity: 0 });

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
      '.contact-heading h1', '.contact-columns',
    ], { opacity: 0, y: 10 });

    gsap.set(['.footer-rule', '.footer-name-block', '.footer-social', '.footer-legal'], { opacity: 0, y: 14 });

    // ── Master timeline: OUT/IN share identical parameters ───────────────────
    const OUT = { z: Z_OFF, scale: SC_OFF, opacity: 0, duration: 1, ease: 'power2.inOut' } as const;
    const IN  = { z: 0,     scale: 1,      opacity: 1, duration: 1, ease: 'power2.out'  } as const;

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
    return gsap.timeline()
      .to(panel ?? '.project-panel', { opacity: 1, duration: 0.55, ease: 'power2.out', delay: 0.08 });
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
  }

  // ════════════════════════════════════════════════════════════════════════════
  // THREE.JS — fish school + camera journey
  // ════════════════════════════════════════════════════════════════════════════

  private initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let w = window.innerWidth, h = window.innerHeight;

    const scene  = new THREE.Scene();
    // Exponential fog: particles in the distance fade into the deep-space background.
    // Creates true atmospheric depth — near particles crisp, far ones dissolved.
    scene.fog = new THREE.FogExp2(0x070608, 0.00016);

    const camera   = new THREE.PerspectiveCamera(65, w / h, 1, 6000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(w, h);
    const dpr = navigator.hardwareConcurrency <= 4 ? 1.0 : Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr);

    // ── Scene coordinate helpers ──────────────────────────────────────────────
    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];
    const _c  = (x: number, fy: number, z: number) =>
      new THREE.Vector3(x, fy !== 0 ? h * fy : 0, z);

    // ── Camera journey — DRAMATIC Z movement (the "spatial adventure") ─────────
    // Starts 900 units outside the nebula, dives forward to z≈150 (beat 2–3),
    // then gradually emerges, creating a "fly through deep space" sensation.
    // sizeAttenuation: true means this Z movement dramatically changes apparent
    // particle size — like truly rushing through a star field.
    const camCurve = new THREE.CatmullRomCurve3([
      _c(   0,    0,   900), _c( 270, -0.10,  740), _c( -90, -0.28,  560),
      _c( 120, -0.50,  380), _c(-220, -0.70,  240), _c(-175, -1.08,  155),
      _c( 165, -1.32,  195), _c( 350, -1.54,  305), _c(   0, -1.80,  235),
      _c(-245, -2.00,  330), _c( 225, -2.38,  410), _c(-125, -2.68,  375),
      _c(-165, -2.98,  470), _c(  80, -3.20,  395), _c( 215, -3.48,  495),
      _c(-175, -3.88,  455), _c( 205, -4.18,  515), _c(  80, -4.48,  575),
      _c(-155, -4.73,  495), _c(  52, -4.98,  615), _c(  25, -5.20,  655),
      _c(   0, -5.50,  680),
    ], false, 'catmullrom', 0.4);

    const lkCurve = new THREE.CatmullRomCurve3([
      _c(   0,    0,    0), _c(-165, -0.10,  0), _c( 185, -0.30,  0),
      _c( -75, -0.52, -65), _c( 145, -0.72,  0), _c( 155, -1.10,  0),
      _c(-175, -1.34,  0),  _c(-185, -1.58,  0), _c(   0, -1.83,-105),
      _c( 175, -2.03,  0),  _c(-175, -2.38,  0), _c( 145, -2.68,  0),
      _c( 205, -3.00,  0),  _c( -95, -3.23, -85),_c(-175, -3.50,  0),
      _c( 195, -3.88,  0),  _c(-155, -4.18,  0), _c(-110, -4.50,  0),
      _c(  98, -4.76, -92), _c(   0, -5.00,  0), _c( -62, -5.20,  0),
      _c(   0, -5.50,  0),
    ], false, 'catmullrom', 0.4);

    // ════════════════════════════════════════════════════════════════════════
    // THREE-LAYER SPATIAL NEBULA
    // ════════════════════════════════════════════════════════════════════════
    //
    // sizeAttenuation: true is the KEY change — particles obey perspective.
    // Close particles: BIG. Far particles: small. Combined with the dramatic
    // camera Z movement, this creates genuine "flying through space" sensation.
    //
    // Three layers:
    //  • DUST (background): many tiny, very deep, low opacity — creates the
    //    vast distance feeling and depth when they appear near at scroll peak
    //  • STARS (mid-field): fewer, medium, with physics repulsion — these
    //    are the particles the user "flies through"
    //  • BRIGHT (foreground): very few, large, high opacity — occasional
    //    nearby stars that rush past, creating parallax depth

    const GA      = Math.PI * (3 - Math.sqrt(5));   // golden angle
    const totalY  = Math.abs(SY[4]) * 1.15;

    // ── Layer 1: Background dust ──────────────────────────────────────────────
    const DUST_PC = 200;
    const dPos = new Float32Array(DUST_PC * 3);
    const dBX  = new Float32Array(DUST_PC), dBY = new Float32Array(DUST_PC);
    const dFX  = new Float32Array(DUST_PC), dFY = new Float32Array(DUST_PC);
    const dPX  = new Float32Array(DUST_PC), dPY = new Float32Array(DUST_PC);

    for (let i = 0; i < DUST_PC; i++) {
      const ang = GA * i;
      const r   = 120 + Math.sqrt(Math.random()) * 1000;
      dBX[i] = Math.cos(ang) * r + (Math.random() - 0.5) * 180;
      dBY[i] = (i / DUST_PC) * SY[4] + (Math.random() - 0.5) * h * 0.70;
      // Deep background: Z -350 to -2600
      const z = -350 - Math.random() * 2250;
      dFX[i]  = 0.06 + Math.random() * 0.12;
      dFY[i]  = 0.05 + Math.random() * 0.09;
      dPX[i]  = Math.random() * Math.PI * 2;
      dPY[i]  = Math.random() * Math.PI * 2;
      dPos[i*3]   = dBX[i];
      dPos[i*3+1] = dBY[i];
      dPos[i*3+2] = z;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xbcb8b2, size: 3.2, sizeAttenuation: true,
      transparent: true, opacity: 0.13, depthWrite: false,
    });
    scene.add(new THREE.Points(dustGeo, dustMat));

    // ── Layer 2: Mid stars (with physics repulsion) ───────────────────────────
    const STAR_PC = 155;
    const sPos = new Float32Array(STAR_PC * 3);
    const sBX  = new Float32Array(STAR_PC), sBY = new Float32Array(STAR_PC), sBZ = new Float32Array(STAR_PC);
    const sFX  = new Float32Array(STAR_PC), sFY = new Float32Array(STAR_PC), sFZ = new Float32Array(STAR_PC);
    const sPX  = new Float32Array(STAR_PC), sPY = new Float32Array(STAR_PC), sPZ = new Float32Array(STAR_PC);
    const svX  = new Float32Array(STAR_PC), svY = new Float32Array(STAR_PC);

    for (let i = 0; i < STAR_PC; i++) {
      const ang = GA * (i + 0.618);
      const r   = 90 + Math.sqrt(Math.random()) * 820;
      sBX[i] = Math.cos(ang) * r + (Math.random() - 0.5) * 140;
      sBY[i] = (i / STAR_PC) * SY[4] + (Math.random() - 0.5) * h * 0.62;
      // Mid range: Z -60 to -1500 — some come VERY close!
      sBZ[i] = -60 - Math.random() * 1440;
      sFX[i] = 0.09 + Math.random() * 0.17;
      sFY[i] = 0.07 + Math.random() * 0.12;
      sFZ[i] = 0.03 + Math.random() * 0.07;
      sPX[i] = Math.random() * Math.PI * 2;
      sPY[i] = Math.random() * Math.PI * 2;
      sPZ[i] = Math.random() * Math.PI * 2;
      sPos[i*3]   = sBX[i];
      sPos[i*3+1] = sBY[i];
      sPos[i*3+2] = sBZ[i];
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xede9e3, size: 5.5, sizeAttenuation: true,
      transparent: true, opacity: 0.42, depthWrite: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Layer 3: Bright foreground stars (no physics — pure parallax) ─────────
    const BRIGHT_PC = 28;
    const bPos = new Float32Array(BRIGHT_PC * 3);
    const bBX  = new Float32Array(BRIGHT_PC), bBY = new Float32Array(BRIGHT_PC), bBZ = new Float32Array(BRIGHT_PC);
    const bFX  = new Float32Array(BRIGHT_PC), bFY = new Float32Array(BRIGHT_PC);
    const bPX  = new Float32Array(BRIGHT_PC), bPY = new Float32Array(BRIGHT_PC);

    for (let i = 0; i < BRIGHT_PC; i++) {
      const ang = GA * (i * 2.618);
      const r   = 200 + Math.sqrt(Math.random()) * 600;
      bBX[i] = Math.cos(ang) * r * 1.4;
      bBY[i] = (i / BRIGHT_PC) * SY[4] + (Math.random() - 0.5) * h * 0.55;
      // Foreground: Z -30 to -400 — right in front, massive parallax
      bBZ[i] = -30 - Math.random() * 370;
      bFX[i] = 0.04 + Math.random() * 0.08;
      bFY[i] = 0.03 + Math.random() * 0.06;
      bPX[i] = Math.random() * Math.PI * 2;
      bPY[i] = Math.random() * Math.PI * 2;
      bPos[i*3]   = bBX[i];
      bPos[i*3+1] = bBY[i];
      bPos[i*3+2] = bBZ[i];
    }
    const brightGeo = new THREE.BufferGeometry();
    brightGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    const brightMat = new THREE.PointsMaterial({
      color: 0xfdfaf6, size: 8.0, sizeAttenuation: true,
      transparent: true, opacity: 0.72, depthWrite: false,
    });
    scene.add(new THREE.Points(brightGeo, brightMat));

    // ── Velocity-physics mouse repulsion ──────────────────────────────────────
    // Unproject mouse NDC → world space at each particle's depth.
    // Impulse ∝ proximity × mouse speed — fast swipe = big bounce, hover = nudge.
    // DRAG = 0.88 per frame: exponential decay, particles drift back to natural path.
    const REPULSE_R = 90;
    const REPULSE_F = 2.0;
    const DRAG      = 0.88;
    const tanHFov   = Math.tan(32.5 * Math.PI / 180); // FOV=65 → half=32.5°

    let mNX = 0, mNY = 0, smX = 0, smY = 0;
    let prevMX = 0, prevMY = 0, mSpeed = 0;
    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / w - 0.5) * 2;
      const ny = -((e.clientY / h) - 0.5) * 2;
      mSpeed = Math.min(Math.sqrt((nx - prevMX) ** 2 + (ny - prevMY) ** 2), 0.08);
      prevMX = mNX; prevMY = mNY;
      mNX = nx; mNY = ny;
    };

    const sCam = new THREE.Vector3(0, 0, 900);
    const sLk  = new THREE.Vector3(0, 0, 0);
    const tCam = new THREE.Vector3(), tLk = new THREE.Vector3();
    const upV  = new THREE.Vector3(0, 1, 0);
    let sFrac = 0, time = 0;

    // 30fps cap — heavy math only 30x/sec; RAF still at 60fps for scheduling
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
      tCam.x += smX * 8; tCam.y += smY * 4;
      sCam.lerp(tCam, 0.030); sLk.lerp(tLk, 0.030);
      camera.position.copy(sCam);
      upV.set(-Math.sin(sFrac * Math.PI * 8) * 0.022, 1, 0).normalize();
      camera.up.lerp(upV, 0.025);
      camera.lookAt(sLk);

      const aspect = w / h;

      // ── Mid stars: drift + velocity physics ──────────────────────────────
      const sp = starGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < STAR_PC; i++) {
        const ix = i*3, iy = ix+1, iz = ix+2;
        const natX = sBX[i] + Math.sin(time * sFX[i] + sPX[i]) * 22;
        const natY = sBY[i] + Math.sin(time * sFY[i] + sPY[i]) * 14;
        const natZ = sBZ[i] + Math.sin(time * sFZ[i] + sPZ[i]) * 11;

        const dz = sCam.z - natZ;
        if (dz > 0) {
          const mwx  = sCam.x + smX * dz * tanHFov * aspect;
          const mwy  = sCam.y + smY * dz * tanHFov;
          const dx   = natX - mwx, dy2 = natY - mwy;
          const d2   = dx*dx + dy2*dy2;
          if (d2 < REPULSE_R * REPULSE_R && d2 > 0.25) {
            const d  = Math.sqrt(d2);
            const imp = (1 - d / REPULSE_R) * REPULSE_F * (1 + mSpeed * 12);
            svX[i] += (dx / d) * imp;
            svY[i] += (dy2/ d) * imp;
          }
        }
        svX[i] *= DRAG; svY[i] *= DRAG;
        sp[ix] = natX + svX[i]; sp[iy] = natY + svY[i]; sp[iz] = natZ;
        const dyW = sp[iy] - sCam.y;
        if (dyW >  totalY * 0.52) { sp[iy] -= totalY; sBY[i] -= totalY; }
        if (dyW < -totalY * 0.52) { sp[iy] += totalY; sBY[i] += totalY; }
      }
      starGeo.attributes['position'].needsUpdate = true;

      // ── Dust: pure drift, no physics (perf) ──────────────────────────────
      const dp = dustGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < DUST_PC; i++) {
        const ix = i*3, iy = ix+1;
        dp[ix] = dBX[i] + Math.sin(time * dFX[i] + dPX[i]) * 16;
        dp[iy] = dBY[i] + Math.sin(time * dFY[i] + dPY[i]) * 10;
        const dyW = dp[iy] - sCam.y;
        if (dyW >  totalY * 0.52) { dp[iy] -= totalY; dBY[i] -= totalY; }
        if (dyW < -totalY * 0.52) { dp[iy] += totalY; dBY[i] += totalY; }
      }
      dustGeo.attributes['position'].needsUpdate = true;

      // ── Bright foreground: slow drift, big parallax ───────────────────────
      const bp = brightGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < BRIGHT_PC; i++) {
        const ix = i*3, iy = ix+1;
        bp[ix] = bBX[i] + Math.sin(time * bFX[i] + bPX[i]) * 14;
        bp[iy] = bBY[i] + Math.sin(time * bFY[i] + bPY[i]) * 9;
        const dyW = bp[iy] - sCam.y;
        if (dyW >  totalY * 0.52) { bp[iy] -= totalY; bBY[i] -= totalY; }
        if (dyW < -totalY * 0.52) { bp[iy] += totalY; bBY[i] += totalY; }
      }
      brightGeo.attributes['position'].needsUpdate = true;

      renderer.render(scene, camera);
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const onVis = () => { if (!document.hidden && this.animId === 0) animate(performance.now()); };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize',   onResize);
    document.addEventListener('visibilitychange', onVis);
    animate(performance.now());

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',   onResize);
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
      dustGeo.dispose();  dustMat.dispose();
      starGeo.dispose();  starMat.dispose();
      brightGeo.dispose(); brightMat.dispose();
    };
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
    const SEL = '.skill-item,button,a,input,textarea';
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
