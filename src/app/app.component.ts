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

    // Header drops in
    gsap.from('app-header', { y: -80, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });

    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) this.initGlobalThreeJS();
      this.initCustomCursor();
    });

    // Wait for Angular router to render main-content
    setTimeout(() => {
      this.initJourney();
    }, 500);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY — 7-beat pinned scroll experience
  // ════════════════════════════════════════════════════════════════════════════

  private initJourney() {
    const stages = gsap.utils.toArray<HTMLElement>('.stage');
    if (stages.length < 5) return;

    // Set initial hidden states for all non-hero stages
    gsap.set(stages[1], { z: -1600, opacity: 0, scale: 0.15, rotateX: 12 });
    gsap.set(stages[2], { x: '110%', y: '50%', rotateZ: 8, opacity: 0 });
    gsap.set(stages[3], { rotateY: 90, opacity: 0, z: -300 });
    gsap.set(stages[4], { y: '-70%', z: -900, scale: 0.6, opacity: 0, rotateX: 15 });

    // MASTER TIMELINE — 6 beats total
    const tl = gsap.timeline();

    // ── Beat 0→1: Hero → About (Z-TUNNEL forward dive) ──
    tl.to(stages[0], { z: 900, scale: 1.8, opacity: 0, duration: 1, ease: 'sine.in' }, 0)
      .to(stages[1], { z: 0, opacity: 1, scale: 1, rotateX: 0, duration: 1, ease: 'sine.out' }, 0.18)

    // ── Beat 1→2: About → Skills (DIAGONAL SWING) ──
      .to(stages[1], { x: '-110%', y: '-50%', rotateZ: -8, opacity: 0, duration: 1, ease: 'sine.in' }, 1)
      .to(stages[2], { x: 0, y: 0, rotateZ: 0, opacity: 1, duration: 1, ease: 'sine.out' }, 1.16)

    // ── Beat 2→3: Skills → Portfolio (CARD FLIP rotateY) ──
      .to(stages[2], { rotateY: -90, opacity: 0, z: -300, duration: 1, ease: 'sine.in' }, 2)
      .to(stages[3], { rotateY: 0, opacity: 1, z: 0, duration: 1, ease: 'sine.out' }, 2.14)

    // ── Beat 3→4: Portfolio project 1 → 2 (HORIZONTAL TRACK SLIDE) ──
      .to('.projects-track', { xPercent: -33.333, duration: 1, ease: 'sine.inOut' }, 3)

    // ── Beat 4→5: Portfolio project 2 → 3 ──
      .to('.projects-track', { xPercent: -66.667, duration: 1, ease: 'sine.inOut' }, 4)

    // ── Beat 5→6: Portfolio → Contact (ASCEND from below) ──
      .to(stages[3], { y: '70%', z: -900, scale: 0.6, opacity: 0, rotateX: -15, duration: 1, ease: 'sine.in' }, 5)
      .to(stages[4], { y: 0, z: 0, scale: 1, opacity: 1, rotateX: 0, duration: 1, ease: 'sine.out' }, 5.14);

    // ── ScrollTrigger — scrub + snap ──
    let rawF = 0;
    const journeyST = ScrollTrigger.create({
      trigger: '#journey',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,           // tighter scrub — less lag → less oscillation on snap
      animation: tl,
      snap: {
        snapTo: 1 / 6,
        duration: { min: 0.55, max: 0.90 },
        delay: 0.12,          // wait longer before committing to snap
        ease: 'expo.inOut'    // exponential ease feels much smoother than power
      },
      onUpdate: (self) => { rawF = self.progress; },
      onSnapComplete: (self) => {
        const beat = Math.round(self.progress * 6);
        this.fireStageAnimation(beat);
      }
    });

    // ── Section link navigation ──
    const BEAT_SCROLL: Record<string, number> = {
      'above_the_fold_section': 0,
      'about_me_section':       1,
      'my_skills_section':      2,
      'portfolio_section':      3,
      'contact_section':        6
    };

    const getJourneyScrollMax = () => {
      const journey = document.querySelector('#journey') as HTMLElement;
      return journey ? journey.scrollHeight - window.innerHeight : 0;
    };

    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      if (id in BEAT_SCROLL) {
        e.preventDefault();
        const targetY = (BEAT_SCROLL[id] / 6) * getJourneyScrollMax();
        gsap.to(window, { scrollTo: targetY, duration: 1.2, ease: 'power3.inOut' });
      }
    });

    // Three.js reads rawF from closure via this global
    (window as any).__journeyProgress = () => rawF;

    this.scrollCleanup = () => { journeyST.kill(); };

    // Fire hero entrance on load
    setTimeout(() => this.fireStageAnimation(0), 200);
  }

  private fireStageAnimation(beat: number) {
    // Map beat to stage index
    const stageIdx = beat <= 2 ? beat : beat <= 5 ? 3 : 4;
    const tl = this.buildStageTl(stageIdx, beat);
    tl?.restart();
  }

  private buildStageTl(stageIdx: number, beat: number): gsap.core.Timeline | null {
    switch (stageIdx) {
      case 0: return this.heroTl();
      case 1: return this.aboutTl();
      case 2: return this.skillsTl();
      case 3: return this.portfolioTl(beat - 3); // 0=card1, 1=card2, 2=card3
      case 4: return this.contactTl();
      default: return null;
    }
  }

  private heroTl() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero-label',        { y: 30, opacity: 0, duration: 0.55, delay: 0.1 })
      .from('.hero-name',          { y: 72, opacity: 0, skewY: 4, duration: 0.90 }, '-=0.30')
      .from('.hero-role',          { y: 28, opacity: 0, duration: 0.60 }, '-=0.45')
      .from('.hero-social-line',   { scaleX: 0, opacity: 0, duration: 0.48, transformOrigin: 'left' }, '-=0.35')
      .from('.hero-links a, .hero-links .hero-email', { y: 20, opacity: 0, stagger: 0.07, duration: 0.46 }, '-=0.30')
      .from('.hero-cta',           { y: 20, opacity: 0, scale: 0.90, duration: 0.50 }, '-=0.28')
      .from('.hero-photo-wrapper', { y: 50, opacity: 0, scale: 0.82, duration: 0.92, ease: 'back.out(1.4)' }, '-=0.72')
      .from('.hero-arrow',         { opacity: 0, y: -14, duration: 0.55 }, '-=0.22');
    return tl;
  }

  private aboutTl() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.about-photo-wrap', { scale: 0.65, opacity: 0, rotation: -16, duration: 1.1, ease: 'back.out(1.7)' })
      .from('.about-heading',     { x: -50, opacity: 0, duration: 0.72 }, '-=0.65')
      .from('.about-body',        { y: 28, opacity: 0, duration: 0.60 }, '-=0.42')
      .from('.about-trait',       { y: 24, opacity: 0, duration: 0.55, stagger: 0.14 }, '-=0.36')
      .from('.about-icon',        { scale: 0, opacity: 0, duration: 0.46, stagger: 0.10, ease: 'back.out(2.4)' }, '-=0.30')
      .from('.social-icon-link',  { y: 20, opacity: 0, duration: 0.45, stagger: 0.09 }, '-=0.22');
    return tl;
  }

  private skillsTl() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.skills-text h1',      { x: 70, opacity: 0, duration: 0.82 })
      .from('.skills-text > div > div', { scaleX: 0, opacity: 0, duration: 0.50, transformOrigin: 'right' }, '-=0.44')
      .from('.skills-text > p',     { x: 48, opacity: 0, duration: 0.68 }, '-=0.44')
      .from('.skills-text button, .skills-mobile-btn button', { x: 36, opacity: 0, scale: 0.90, duration: 0.54 }, '-=0.34')
      .from('.skill-item',          { y: 46, opacity: 0, scale: 0.78, duration: 0.58,
          stagger: { amount: 1.0, from: 'start', grid: 'auto' }, ease: 'back.out(1.6)' }, '-=0.48');
    return tl;
  }

  private portfolioTl(cardIdx: number) {
    const panels = gsap.utils.toArray<HTMLElement>('.project-panel');
    const panel = panels[cardIdx];
    if (!panel) return gsap.timeline();
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (cardIdx === 0) {
      tl.from('.portfolio-heading h1', { y: 40, opacity: 0, duration: 0.72 })
        .from('.portfolio-sub',         { y: 22, opacity: 0, duration: 0.58 }, '-=0.38');
    }
    tl.from(panel.querySelector('.project-img-wrap'), { x: -60, opacity: 0, duration: 0.82 }, cardIdx === 0 ? '-=0.44' : 0)
      .from(panel.querySelector('.project-info'),      { x: 60, opacity: 0, duration: 0.82 }, '-=0.62')
      .from(panel.querySelectorAll('.project-num, .project-tech'), { y: 18, opacity: 0, stagger: 0.10, duration: 0.48 }, '-=0.40')
      .from(panel.querySelector('h4'),                 { y: 26, opacity: 0, duration: 0.56 }, '-=0.32')
      .from(panel.querySelector('p'),                  { y: 20, opacity: 0, duration: 0.52 }, '-=0.28')
      .from(panel.querySelectorAll('.project-actions a'), { y: 16, opacity: 0, stagger: 0.11, duration: 0.46, ease: 'back.out(1.3)' }, '-=0.22');
    return tl;
  }

  private contactTl() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.contact-rule',       { scaleX: 0, opacity: 0, duration: 0.58, transformOrigin: 'left' })
      .from('.contact-heading h1', { y: 44, opacity: 0, duration: 0.78 }, '-=0.30')
      .from('.contact-info h4',    { y: 30, opacity: 0, duration: 0.66 }, '-=0.44')
      .from('.contact-info p, .contact-info span', { y: 22, opacity: 0, stagger: 0.11, duration: 0.56 }, '-=0.34')
      .from('.contact-form',       { y: 44, opacity: 0, scale: 0.95, duration: 0.80, ease: 'back.out(1.3)' }, '-=0.44')
      .from('.form-field',         { y: 18, opacity: 0, stagger: 0.10, duration: 0.46 }, '-=0.46')
      .from('.form-privacy',       { y: 14, opacity: 0, duration: 0.44 }, '-=0.22')
      .from('.contact-form > button', { y: 14, opacity: 0, scale: 0.88, duration: 0.48, ease: 'back.out(1.5)' }, '-=0.20');
    return tl;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // THREE.JS — camera progress fed by __journeyProgress, not window.scrollY
  // ════════════════════════════════════════════════════════════════════════════

  private initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const mob = w <= 768;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(58, w / h, 0.1, 12000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mob });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const PHI = (1 + Math.sqrt(5)) / 2;
    const GA  = Math.PI * (3 - Math.sqrt(5));

    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];

    // ── 22-point camera spline ───────────────────────────────────────────────
    const _c = (x: number, fy: number, z: number) =>
      new THREE.Vector3(x, fy !== 0 ? h * fy : 0, z);

    const camPts = [
      _c(   0,    0,     560),  //  0 Hero
      _c( 280, -0.08,   430),  //  1 Hero — drift right
      _c( -80, -0.26,   710),  //  2 Pre-portal 0 — pull back
      _c( 130, -0.50,   270),  //★ 3 Through portal 0
      _c(-220, -0.72,   620),  //  4 Emerge left
      _c(-200, -1.10,   500),  //  5 About — arrive left
      _c( 180, -1.35,   455),  //  6 About — scan right
      _c( 370, -1.55,   720),  //  7 Pre-portal 1 — far right
      _c(   0, -1.82,   255),  //★ 8 Through portal 1
      _c(-260, -2.02,   610),  //  9 Emerge left
      _c( 240, -2.40,   485),  // 10 Skills — arrive right
      _c(-130, -2.70,   515),  // 11 Skills — scan left
      _c(-175, -3.00,   730),  // 12 Pre-portal 2 — far back
      _c(  85, -3.22,   248),  //★13 Through portal 2
      _c( 225, -3.50,   595),  // 14 Emerge right
      _c(-185, -3.90,   530),  // 15 Portfolio — arrive left
      _c( 220, -4.20,   465),  // 16 Portfolio — scan right
      _c(  85, -4.50,   715),  // 17 Pre-portal 3 — far back
      _c(-165, -4.75,   262),  //★18 Through portal 3
      _c(  55, -5.00,   585),  // 19 Emerge
      _c(  25, -5.22,   565),  // 20 Contact — settle
      _c(   0, -5.50,   600),  // 21 Contact — arrive
    ];

    const lkPts = [
      _c(   0,    0,     0),
      _c(-180, -0.08,   0),
      _c( 200, -0.28,   0),
      _c( -80, -0.52,  -65),  //  3 look through portal
      _c( 160, -0.72,   0),
      _c( 165, -1.10,   0),
      _c(-185, -1.35,   0),
      _c(-200, -1.60,   0),
      _c(   0, -1.85, -110),  //  8 look through
      _c( 185, -2.05,   0),
      _c(-185, -2.40,   0),
      _c( 155, -2.70,   0),
      _c( 215, -3.02,   0),
      _c(-100, -3.25,  -80),  // 13 look through
      _c(-185, -3.52,   0),
      _c( 205, -3.90,   0),
      _c(-165, -4.20,   0),
      _c(-115, -4.52,   0),
      _c( 105, -4.78,  -90),  // 18 look through
      _c(   0, -5.02,   0),
      _c( -65, -5.22,   0),
      _c(   0, -5.50,   0),
    ];

    const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'catmullrom', 0.4);
    const lkCurve  = new THREE.CatmullRomCurve3(lkPts,  false, 'catmullrom', 0.4);

    // ── DUAL PARTICLE SYSTEM ─────────────────────────────────────────────────
    // Main: section-patterned particles with mouse repulsion + copper shimmer
    // Stars: cool blue-silver background, far Z plane
    const PC        = mob ? 110 : 220;  // main particles
    const SC        = mob ?  45 :  90;  // background stars
    const totalSpan = Math.abs(SY[4]) * 1.08;
    const secCount  = 5;
    const perSec    = Math.ceil(PC / secCount);

    // Section-specific XZ pattern helper (returns [xOffset, zOffset])
    const sectionXZ = (si: number, li: number, ln: number): [number, number] => {
      const t = li / Math.max(ln - 1, 1);
      switch (si) {
        case 0: { // Hero — Fibonacci spiral
          const ang = GA * li;
          const r   = 160 + t * 240;
          return [Math.cos(ang) * r, Math.sin(ang) * r * 0.34 - 160];
        }
        case 1: { // About — golden-angle scatter
          const ang = GA * li * PHI;
          const r   = 80 + Math.sqrt(t) * 310;
          return [Math.cos(ang) * r, Math.sin(ang) * r * 0.38 - 120];
        }
        case 2: { // Skills — grid + jitter
          const cols = Math.ceil(Math.sqrt(ln * 1.6));
          const row  = Math.floor(li / cols);
          const col  = li % cols;
          return [(col - cols / 2) * 72 + (Math.random() - 0.5) * 28,
                  (row - cols / 2) * 50 + (Math.random() - 0.5) * 20 - 120];
        }
        case 3: { // Portfolio — φ logarithmic spiral
          const ang = t * Math.PI * 6;
          const r   = 48 * Math.pow(PHI, t * 1.6);
          return [Math.cos(ang) * r * 1.1, Math.sin(ang) * r * 0.36 - 130];
        }
        case 4: { // Contact — converging rings
          const ang = GA * li;
          const r   = 280 * (1 - t * 0.55) + 60;
          return [Math.cos(ang) * r * 0.9, Math.sin(ang) * r * 0.30 - 100];
        }
        default: return [0, -120];
      }
    };

    // Main particle buffers
    const pPos  = new Float32Array(PC * 3);
    const pCol  = new Float32Array(PC * 3);
    const pVel  = new Float32Array(PC * 2);
    const pBase = new Float32Array(PC * 3); // section-hue reference
    const _tc   = new THREE.Color();

    for (let i = 0; i < PC; i++) {
      const si  = Math.min(Math.floor(i / perSec), secCount - 1);
      const li  = i - si * perSec;
      const ln  = Math.min(perSec, PC - si * perSec);
      const [xO, zO] = sectionXZ(si, li, ln);

      pPos[i*3]   = xO + (Math.random() - 0.5) * 14;
      pPos[i*3+1] = SY[si] + (Math.random() - 0.5) * h * 0.55;
      pPos[i*3+2] = zO - 80 + (Math.random() - 0.5) * 60;

      // Section-graduated base hue: copper (hsl 25°) → sage-teal (hsl 155°)
      _tc.setHSL(0.069 + (si / (secCount - 1)) * 0.360, 0.55, 0.64);
      pCol[i*3] = _tc.r; pCol[i*3+1] = _tc.g; pCol[i*3+2] = _tc.b;
      // Store base color for drift-back in animate loop
      pBase[i*3] = _tc.r; pBase[i*3+1] = _tc.g; pBase[i*3+2] = _tc.b;

      pVel[i*2]   = (Math.random() - 0.5) * 0.016;
      pVel[i*2+1] = (Math.random() - 0.5) * 0.012;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      vertexColors: true, size: 1.8, transparent: true, opacity: 0.30, sizeAttenuation: false
    });
    scene.add(new THREE.Points(pGeo, pMat));

    // Background stars — cool blue-silver, far Z
    const sPos = new Float32Array(SC * 3);
    const sCol = new Float32Array(SC * 3);

    for (let i = 0; i < SC; i++) {
      const t   = i / SC;
      const ang = GA * i * PHI;
      const r   = 380 + Math.random() * 520;
      sPos[i*3]   =  Math.cos(ang) * r;
      sPos[i*3+1] =  t * SY[4] * 1.10 + (Math.random() - 0.5) * h * 0.40;
      sPos[i*3+2] = -500 + Math.sin(ang) * r * 0.26 + (Math.random() - 0.5) * 110;
      _tc.setHSL(0.58 + Math.random() * 0.10, 0.28, 0.82 + Math.random() * 0.18);
      sCol[i*3] = _tc.r; sCol[i*3+1] = _tc.g; sCol[i*3+2] = _tc.b;
    }

    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('color',    new THREE.BufferAttribute(sCol, 3));
    const sMat = new THREE.PointsMaterial({
      vertexColors: true, size: 1.2, transparent: true, opacity: 0.13, sizeAttenuation: false
    });
    scene.add(new THREE.Points(sGeo, sMat));

    // ── Wireframe helper ─────────────────────────────────────────────────────
    const wMeshes: THREE.LineSegments[] = [];
    const wMats:   THREE.LineBasicMaterial[] = [];
    const wBase:   number[] = [];
    const wSecY:   number[] = [];

    const mkWf = (
      geo: THREE.BufferGeometry, opa: number,
      px: number, py: number, pz: number, sIdx: number,
      rx = 0, ry = 0, rz = 0
    ) => {
      const edges = new THREE.EdgesGeometry(geo);
      const mat   = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opa });
      const mesh  = new THREE.LineSegments(edges, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(rx, ry, rz);
      geo.dispose();
      scene.add(mesh);
      wMeshes.push(mesh); wMats.push(mat); wBase.push(opa); wSecY.push(SY[sIdx] ?? 0);
      return mesh;
    };

    const dim = Math.min(w, h);
    const S   = dim * 0.25;

    mkWf(new THREE.IcosahedronGeometry(S,              1), 0.034,  dim*0.28,  SY[0],           -300, 0);
    mkWf(new THREE.IcosahedronGeometry(S * 0.35,       0), 0.020, -dim*0.16,  SY[0] - h*0.18,  -180, 0);
    mkWf(new THREE.DodecahedronGeometry(S / PHI,       0), 0.030, -dim*0.26,  SY[1],           -240, 1, 0.2, 0.4, 0);
    mkWf(new THREE.DodecahedronGeometry(S / PHI / PHI, 0), 0.018,  dim*0.13,  SY[1] + h*0.18,  -155, 1);
    mkWf(new THREE.OctahedronGeometry(S * PHI / 2,    0), 0.032,  dim*0.30,  SY[2],           -215, 2, 0.3, 0.1, 0.2);
    mkWf(new THREE.OctahedronGeometry(S * 0.28,       0), 0.018, -dim*0.11,  SY[2] - h*0.18,  -170, 2);
    mkWf(new THREE.TorusKnotGeometry(S*0.42, S*0.09, 80, 7), 0.022, -dim*0.24, SY[3], -260, 3, 0.1, 0, 0.15);
    mkWf(new THREE.IcosahedronGeometry(S * 0.88,       2), 0.028,  dim*0.22,  SY[4],           -205, 4, 0.2, 0.3, 0);

    // ── Portal rings ─────────────────────────────────────────────────────────
    const portalY  = SY.slice(0, 4).map((y, i) => (y + SY[i + 1]) * 0.5);
    const portalXZ = [[-40, -80], [70, -90], [-35, -80], [20, -90]] as const;

    const pMeshes: THREE.LineSegments[] = [];
    const pMatsArr: THREE.LineBasicMaterial[] = [];

    portalY.forEach((py, i) => {
      const outerR = dim * 0.27;
      const tubeR  = outerR / (PHI * PHI);
      const geo    = new THREE.TorusGeometry(outerR, tubeR, 5, 48);
      const mat    = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.012 });
      const edges  = new THREE.EdgesGeometry(geo);
      geo.dispose();
      const mesh   = new THREE.LineSegments(edges, mat);
      mesh.position.set(portalXZ[i][0], py, portalXZ[i][1]);
      mesh.rotation.x = 0.08 + i * 0.035;
      scene.add(mesh); pMeshes.push(mesh); pMatsArr.push(mat);
    });

    // ── Golden logarithmic spirals ────────────────────────────────────────────
    const mkSpiral = (phase: number, bFactor: number, xScale: number, zOff: number, opa: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 340; i++) {
        const t   = i / 340;
        const ang = t * Math.PI * 12 + phase;
        const r   = 52 * Math.pow(PHI, t * bFactor);
        pts.push(new THREE.Vector3(Math.cos(ang) * r * xScale, t * SY[4] * 1.04, Math.sin(ang) * r * 0.32 + zOff));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opa });
      scene.add(new THREE.Line(g, m));
      return { g, m };
    };

    const sp1 = mkSpiral(0,       2.2, 0.50, -450, 0.016);
    const sp2 = mkSpiral(Math.PI, 2.0, 0.38, -480, 0.010);

    // ── Mouse parallax (raw + smoothed separately) ────────────────────────────
    let mNX = 0, mNY = 0;   // raw
    let smX = 0, smY = 0;   // smoothed — used for camera + repulsion
    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    // ── Camera state + smoothing ─────────────────────────────────────────────
    const sCam  = new THREE.Vector3(0, 0, 600);
    const sLk   = new THREE.Vector3(0, 0, 0);
    const tCam  = new THREE.Vector3();
    const tLk   = new THREE.Vector3();
    const upVec = new THREE.Vector3(0, 1, 0);
    const tCol  = new THREE.Color();
    let   sFrac = 0;

    const rotR = [
      [ 0.00036,  0.00050,  0      ],
      [ 0,        0.00030, -0.00040],
      [ 0.00018,  0.00044,  0.00028],
      [-0.00025,  0,        0.00032],
      [ 0.00042,  0,        0.00036],
      [ 0,       -0.00028,  0.00044],
      [ 0.00022,  0.00038,  0.00016],
      [-0.00020,  0.00040,  0.00028],
    ];

    // ── Render loop ──────────────────────────────────────────────────────────
    const animate = () => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);

      // Smooth mouse before use — prevents camera jitter from rapid moves
      smX += (mNX - smX) * 0.055;
      smY += (mNY - smY) * 0.055;

      // __journeyProgress gives us a clean 0-1 progress — lerp into sFrac
      const rawF = (window as any).__journeyProgress?.() ?? 0;
      sFrac += (rawF - sFrac) * 0.038;  // slower lerp = glassier camera follow

      camCurve.getPoint(Math.min(sFrac, 0.9999), tCam);
      lkCurve.getPoint(Math.min(sFrac, 0.9999),  tLk);
      tCam.x += smX * 16;
      tCam.y += smY * 7;
      sCam.lerp(tCam, 0.040);
      sLk.lerp(tLk,  0.040);
      camera.position.copy(sCam);

      const roll = Math.sin(sFrac * Math.PI * 7) * 0.028;
      upVec.set(-roll, 1, 0).normalize();
      camera.up.lerp(upVec, 0.028);
      camera.lookAt(sLk);

      // room markers
      wMeshes.forEach((m, i) => {
        const r = rotR[i] ?? [0, 0.0003, 0];
        m.rotation.x += r[0]; m.rotation.y += r[1]; m.rotation.z += r[2];
        const d = Math.abs(sCam.y - wSecY[i]);
        wMats[i].opacity = wBase[i] + Math.max(0, 1 - d / (h * 0.9)) * 0.052;
      });

      // portals
      pMeshes.forEach((p, i) => {
        p.rotation.z += 0.00015 * (i % 2 === 0 ? 1 : -1);
        const t = Math.max(0, 1 - Math.abs(sCam.y - portalY[i]) / (h * 0.78));
        pMatsArr[i].opacity = 0.010 + t * 0.058;
        const sc = 1.0 + t * 0.28;
        p.scale.set(sc, sc, 1.0 + t * 0.12);
      });

      // particles — main with mouse repulsion + copper shimmer
      const mWX     = sCam.x + smX * 240;  // use smoothed mouse
      const mWY     = sCam.y + smY * 130;
      const REPEL_R = 155;
      const REPEL_F = 0.0046;

      const pos = pGeo.attributes['position'].array as Float32Array;
      const col = pGeo.attributes['color'].array as Float32Array;

      for (let i = 0; i < PC; i++) {
        pos[i*3]   += pVel[i*2];
        pos[i*3+1] += pVel[i*2+1];

        pVel[i*2]   += (Math.random() - 0.5) * 0.00060;
        pVel[i*2+1] += (Math.random() - 0.5) * 0.00060;
        pVel[i*2]   *= 0.978;
        pVel[i*2+1] *= 0.978;

        // Mouse repulsion (world XY plane)
        const rDX = pos[i*3]   - mWX;
        const rDY = pos[i*3+1] - mWY;
        const rD  = Math.sqrt(rDX * rDX + rDY * rDY);
        if (rD < REPEL_R && rD > 0.1) {
          const f = REPEL_F * (1 - rD / REPEL_R);
          pVel[i*2]   += (rDX / rD) * f;
          pVel[i*2+1] += (rDY / rD) * f;
        }

        // Wrap Y around camera travel span
        if (pos[i*3+1] - sCam.y >  totalSpan * 0.5) pos[i*3+1] -= totalSpan;
        if (pos[i*3+1] - sCam.y < -totalSpan * 0.5) pos[i*3+1] += totalSpan;

        // Proximity copper shimmer near camera
        const dx = pos[i*3] - sCam.x, dy = pos[i*3+1] - sCam.y, dz = pos[i*3+2] - sCam.z;
        const d3 = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d3 < 280) {
          const fr = (1 - d3 / 280) * 0.52;
          tCol.setHSL(0.069, 0.68, 0.72); // copper hsl(25°, 68%, 72%)
          col[i*3]   += (tCol.r - col[i*3])   * fr;
          col[i*3+1] += (tCol.g - col[i*3+1]) * fr;
          col[i*3+2] += (tCol.b - col[i*3+2]) * fr;
        } else {
          // Drift back to section base hue
          col[i*3]   += (pBase[i*3]   - col[i*3])   * 0.006;
          col[i*3+1] += (pBase[i*3+1] - col[i*3+1]) * 0.006;
          col[i*3+2] += (pBase[i*3+2] - col[i*3+2]) * 0.006;
        }
      }
      pGeo.attributes['position'].needsUpdate = true;
      pGeo.attributes['color'].needsUpdate    = true;

      renderer.render(scene, camera);
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
      renderer.dispose();
      pGeo.dispose(); pMat.dispose();
      sGeo.dispose(); sMat.dispose();
      sp1.g.dispose(); sp1.m.dispose();
      sp2.g.dispose(); sp2.m.dispose();
      wMeshes.forEach(m  => { m.geometry.dispose(); (m.material as THREE.LineBasicMaterial).dispose(); });
      pMeshes.forEach(pm => { pm.geometry.dispose(); (pm.material as THREE.LineBasicMaterial).dispose(); });
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOM CURSOR
  // ════════════════════════════════════════════════════════════════════════════

  private initCustomCursor() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    const ring = document.getElementById('cursor-ring')!;
    const dot  = document.getElementById('cursor-dot')!;
    if (!ring || !dot) return;

    gsap.set(ring, { xPercent: -50, yPercent: -50 });
    gsap.set(dot,  { xPercent: -50, yPercent: -50 });

    let appeared = false;
    let spotEls: HTMLElement[] = [];
    let rects: DOMRect[] = [];
    const SEL = '.skill-item,.project-info,.project-img-wrap,.about-icon,.social-icon-link,form,button';

    const refresh = () => { rects = spotEls.map(el => el.getBoundingClientRect()); };
    setTimeout(() => { spotEls = Array.from(document.querySelectorAll(SEL)) as HTMLElement[]; refresh(); }, 900);

    const onMove = (e: MouseEvent) => {
      if (!appeared) { gsap.to([ring, dot], { opacity: 1, duration: 0.4 }); appeared = true; }
      gsap.to(dot,  { x: e.clientX, y: e.clientY, duration: 0 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.18, ease: 'power2.out' });
      for (let i = 0; i < spotEls.length; i++) {
        const r = rects[i]; if (!r) continue;
        spotEls[i].style.setProperty('--mx', `${e.clientX - r.left}px`);
        spotEls[i].style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };

    const onOver  = (e: MouseEvent) => {
      if ((e.target as Element).closest('a,button,input,textarea'))
        gsap.to(ring, { scale: 1.7, borderColor: 'rgba(255,255,255,0.75)', duration: 0.22 });
    };
    const onOut   = (e: MouseEvent) => {
      if ((e.target as Element).closest('a,button,input,textarea'))
        gsap.to(ring, { scale: 1, borderColor: 'rgba(255,255,255,0.40)', duration: 0.22 });
    };
    const onLeave = () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    const onEnter = () => { if (appeared) gsap.to([ring, dot], { opacity: 1, duration: 0.3 }); };

    window.addEventListener('mousemove', onMove,  { passive: true });
    window.addEventListener('scroll',    refresh,  { passive: true });
    window.addEventListener('resize',    refresh,  { passive: true });
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
