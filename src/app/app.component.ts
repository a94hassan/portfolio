import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ThemeService } from './shared/services/theme.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import * as THREE from 'three';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'portfolio';
  private zone         = inject(NgZone);
  private themeService = inject(ThemeService);
  private animId       = 0;
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
      if (!reducedMotion && !this.isMobile) this.initGlobalThreeJS();
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
  // TEXT — character-by-character 3D write-in animation
  // Each character flips up from rotateX:-80° (face-down) to 0° (upright),
  // staggered left-to-right. Combined with Cormorant Garamond italic 300,
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
    if (stages.length < 5) return;

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
      .to(stages[4], { ...IN  }, 5.06);

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
      if (seek) tl.seek(beat / 6 * tl.duration());
      setTimeout(() => this.fireEntrance(beat), 40);
    };

    const st = ScrollTrigger.create({
      trigger: '#journey',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.22,
      animation: tl,
      snap: {
        snapTo:   1 / 6,
        duration: { min: 0.28, max: 0.45 },
        delay:    0.38,
        ease:     'power2.inOut',
      },
      onUpdate:       (self) => { rawF = self.progress; fireBeat(Math.round(self.progress * 6)); },
      onSnapComplete: (self) => { fireBeat(Math.round(self.progress * 6), true); },
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
        gsap.to(window, { scrollTo: (BEAT[id] / 6) * scrollMax(), duration: 1.1, ease: 'power2.inOut' });
      }
    });

    (window as any).__journeyProgress = () => rawF;
    this.scrollCleanup = () => st.kill();
    setTimeout(() => { lastBeat = 0; this.fireEntrance(0); }, 120);
  }

  private fireEntrance(beat: number) {
    const idx = beat <= 2 ? beat : beat <= 5 ? 3 : 4;
    const builders = [
      () => this.heroTl(),
      () => this.aboutTl(),
      () => this.skillsTl(),
      () => this.portfolioTl(beat - 3),
      () => this.contactTl(),
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

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(58, w / h, 0.1, 8000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];
    const _c  = (x: number, fy: number, z: number) =>
      new THREE.Vector3(x, fy !== 0 ? h * fy : 0, z);

    const camCurve = new THREE.CatmullRomCurve3([
      _c(   0,    0,   560), _c( 280, -0.08, 430), _c( -80, -0.26, 710),
      _c( 130, -0.50, 270),  _c(-220, -0.72, 620), _c(-200, -1.10, 500),
      _c( 180, -1.35, 455),  _c( 370, -1.55, 720), _c(   0, -1.82, 255),
      _c(-260, -2.02, 610),  _c( 240, -2.40, 485), _c(-130, -2.70, 515),
      _c(-175, -3.00, 730),  _c(  85, -3.22, 248), _c( 225, -3.50, 595),
      _c(-185, -3.90, 530),  _c( 220, -4.20, 465), _c(  85, -4.50, 715),
      _c(-165, -4.75, 262),  _c(  55, -5.00, 585), _c(  25, -5.22, 565),
      _c(   0, -5.50, 600),
    ], false, 'catmullrom', 0.4);

    const lkCurve = new THREE.CatmullRomCurve3([
      _c(   0,    0,    0), _c(-180, -0.08,  0), _c( 200, -0.28,  0),
      _c( -80, -0.52, -65), _c( 160, -0.72,  0), _c( 165, -1.10,  0),
      _c(-185, -1.35,  0),  _c(-200, -1.60,  0), _c(   0, -1.85,-110),
      _c( 185, -2.05,  0),  _c(-185, -2.40,  0), _c( 155, -2.70,  0),
      _c( 215, -3.02,  0),  _c(-100, -3.25, -80),_c(-185, -3.52,  0),
      _c( 205, -3.90,  0),  _c(-165, -4.20,  0), _c(-115, -4.52,  0),
      _c( 105, -4.78, -90), _c(   0, -5.02,  0), _c( -65, -5.22,  0),
      _c(   0, -5.50,  0),
    ], false, 'catmullrom', 0.4);

    // ── PARTICLE FIELD — ring distribution, true 3D depth, uniform screen size ─
    //
    // Distribution design:
    //  • Ring (not sphere): inner void 200px, outer edge 800px → particles spread
    //    from screen edges, not center — center stays clear for content
    //  • True 3D depth: Z from -350 to -1100 → real layered depth in 3D space
    //  • sizeAttenuation: false → all particles identical screen size regardless
    //    of Z depth — creates a flat, minimal, consistent field, not a fog effect
    //  • Organic drift: individual sinusoidal oscillation per particle (fish school)

    const PC     = 340;
    const GA     = Math.PI * (3 - Math.sqrt(5));   // golden angle
    const R_IN   = 200;   // inner void radius — center kept clear
    const R_OUT  = 820;   // outer ring edge
    const totalY = Math.abs(SY[4]) * 1.12;

    const bX = new Float32Array(PC), bY = new Float32Array(PC), bZ = new Float32Array(PC);
    const fX = new Float32Array(PC), fY = new Float32Array(PC), fZ = new Float32Array(PC);
    const pX = new Float32Array(PC), pY = new Float32Array(PC), pZ = new Float32Array(PC);
    const pos = new Float32Array(PC * 3);

    for (let i = 0; i < PC; i++) {
      const t   = i / PC;
      const ang = GA * i;

      // Annular (ring) distribution: sqrt-bias pushes density toward outer edge
      const r = R_IN + Math.sqrt(Math.random()) * (R_OUT - R_IN);
      bX[i] = Math.cos(ang) * r;

      // Full journey Y span, slightly randomised within each section band
      bY[i] = t * SY[4] + (Math.random() - 0.5) * h * 0.55;

      // True 3D depth: -350 to -1100 (more distant than before, real 3D spread)
      bZ[i] = -350 - Math.random() * 750;

      // Unique oscillation frequencies — organic, no two particles in sync
      fX[i] = 0.10 + Math.random() * 0.18;
      fY[i] = 0.07 + Math.random() * 0.12;
      fZ[i] = 0.04 + Math.random() * 0.08;

      pX[i] = Math.random() * Math.PI * 2;
      pY[i] = Math.random() * Math.PI * 2;
      pZ[i] = Math.random() * Math.PI * 2;

      pos[i*3] = bX[i]; pos[i*3+1] = bY[i]; pos[i*3+2] = bZ[i];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color:           0xd0d4dc,
      size:            2.2,            // fixed screen size — all particles equal
      transparent:     true,
      opacity:         0.28,
      sizeAttenuation: false,          // NO perspective scaling — uniform field
      depthWrite:      false,
    });
    scene.add(new THREE.Points(geo, mat));

    const pathGeo = new THREE.BufferGeometry().setFromPoints(camCurve.getPoints(240));
    const pathMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.006 });
    scene.add(new THREE.Line(pathGeo, pathMat));

    let mNX = 0, mNY = 0, smX = 0, smY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    const sCam = new THREE.Vector3(0, 0, 600);
    const sLk  = new THREE.Vector3(0, 0, 0);
    const tCam = new THREE.Vector3(), tLk = new THREE.Vector3();
    const upV  = new THREE.Vector3(0, 1, 0);
    let sFrac = 0, time = 0;

    const animate = () => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);
      time += 0.007;
      smX += (mNX - smX) * 0.055;
      smY += (mNY - smY) * 0.055;

      const rawF = (window as any).__journeyProgress?.() ?? 0;
      sFrac += (rawF - sFrac) * 0.038;

      camCurve.getPoint(Math.min(sFrac, 0.9999), tCam);
      lkCurve.getPoint( Math.min(sFrac, 0.9999), tLk);
      tCam.x += smX * 16; tCam.y += smY * 7;
      sCam.lerp(tCam, 0.04); sLk.lerp(tLk, 0.04);
      camera.position.copy(sCam);
      upV.set(-Math.sin(sFrac * Math.PI * 7) * 0.028, 1, 0).normalize();
      camera.up.lerp(upV, 0.028);
      camera.lookAt(sLk);

      const p = geo.attributes['position'].array as Float32Array;
      for (let i = 0; i < PC; i++) {
        const ix = i*3, iy = ix+1, iz = ix+2;
        p[ix] = bX[i] + Math.sin(time * fX[i] + pX[i]) * 24 + smX * 20;
        p[iy] = bY[i] + Math.sin(time * fY[i] + pY[i]) * 16 + smY * 11;
        p[iz] = bZ[i] + Math.sin(time * fZ[i] + pZ[i]) * 10;
        const dy = p[iy] - sCam.y;
        if (dy >  totalY * 0.52) p[iy] -= totalY;
        if (dy < -totalY * 0.52) p[iy] += totalY;
      }
      geo.attributes['position'].needsUpdate = true;
      renderer.render(scene, camera);
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const onVis = () => { if (!document.hidden && this.animId === 0) animate(); };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize',   onResize);
    document.addEventListener('visibilitychange', onVis);
    animate();

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',   onResize);
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose(); geo.dispose(); mat.dispose();
      pathGeo.dispose(); pathMat.dispose();
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
    ScrollTrigger.getAll().forEach(t => t.kill());
    gsap.killTweensOf(window);
  }
}
