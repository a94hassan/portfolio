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
  private zone       = inject(NgZone);
  private themeService = inject(ThemeService);
  private animId     = 0;
  private threeCleanup?: () => void;
  private cursorCleanup?: () => void;
  private scrollCleanup?: () => void;

  ngOnInit() {
    this.themeService.init();

    // ── Register all GSAP plugins once ──────────────────────────────────────
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    // ── Header drops in ─────────────────────────────────────────────────────
    gsap.from('app-header', { y: -80, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });

    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) this.initGlobalThreeJS();
      this.initCustomCursor();
    });

    // ── GSAP owns all scrolling ──────────────────────────────────────────────
    this.initGSAPScroll();

    // wait for DOM (router-outlet renders async)
    setTimeout(() => this.initSectionAnimations(), 600);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GSAP SCROLL  —  gsap.to(window, scrollTo) replaces every RAF line
  // ════════════════════════════════════════════════════════════════════════════

  private initGSAPScroll() {
    const IDS = [
      '#above_the_fold_section',
      '#about_me_section',
      '#my_skills_section',
      '#portfolio_section',
      '#contact_section'
    ];

    let sections: HTMLElement[] = [];
    let current  = 0;
    let busy     = false;
    const HEADER = 80;

    // find which section is currently in the viewport centre
    const findCurrent = () => {
      const mid = window.innerHeight * 0.45;
      for (let i = 0; i < sections.length; i++) {
        const r = sections[i]?.getBoundingClientRect();
        if (r && r.top <= mid && r.bottom >= mid) { current = i; return; }
      }
    };

    // ── Pure GSAP scroll — ScrollToPlugin ───────────────────────────────────
    const goTo = (idx: number) => {
      const el = sections[idx];
      if (!el) return;
      busy    = true;
      current = idx;
      gsap.killTweensOf(window);          // cancel any in-progress scroll
      gsap.to(window, {
        scrollTo: { y: el, offsetY: HEADER },
        duration: 1.15,
        ease: 'power3.inOut',
        onComplete: () => setTimeout(() => { busy = false; }, 100)
      });
    };

    const navigate = (dir: 1 | -1) => {
      if (!sections.length || busy) return;
      const rect = sections[current]?.getBoundingClientRect();
      // let the user scroll naturally within a tall section
      if (dir ===  1 && rect && rect.bottom > window.innerHeight + 20) return;
      if (dir === -1 && rect && rect.top    < -20)                       return;
      const nxt = Math.max(0, Math.min(sections.length - 1, current + dir));
      if (nxt === current) return;
      goTo(nxt);
    };

    // ── Input handlers ───────────────────────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      if (busy) { e.preventDefault(); return; }
      navigate(e.deltaY > 0 ? 1 : -1);
      if (busy) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navigate( 1); }
      if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); navigate(-1); }
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchEnd   = (e: TouchEvent) => {
      const d = touchY - e.changedTouches[0].clientY;
      if (Math.abs(d) < 52) return;
      navigate(d > 0 ? 1 : -1);
    };

    setTimeout(() => {
      sections = IDS.map(id => document.querySelector(id) as HTMLElement).filter(Boolean);
    }, 400);

    window.addEventListener('scroll',     findCurrent,  { passive: true  });
    window.addEventListener('wheel',      onWheel,      { passive: false  });
    window.addEventListener('keydown',    onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true  });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true  });

    this.scrollCleanup = () => {
      window.removeEventListener('scroll',     findCurrent);
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('keydown',    onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GSAP SECTION ANIMATIONS  — per-section timelines, all ScrollTrigger-driven
  // ════════════════════════════════════════════════════════════════════════════

  private initSectionAnimations() {

    // ── Hero — plays on page load, no ScrollTrigger needed ──────────────────
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero-label',
        { y: 28, opacity: 0, duration: 0.55, delay: 0.28 })
      .from('.hero-name',
        { y: 72, opacity: 0, skewY: 3, duration: 0.90 }, '-=0.30')
      .from('.hero-role',
        { y: 30, opacity: 0, duration: 0.62 }, '-=0.48')
      .from('.hero-social-line',
        { scaleX: 0, opacity: 0, duration: 0.50, transformOrigin: 'left center' }, '-=0.38')
      .from('.hero-links a, .hero-links .hero-email',
        { y: 20, opacity: 0, duration: 0.48, stagger: 0.07 }, '-=0.32')
      .from('.hero-cta',
        { y: 22, opacity: 0, scale: 0.90, duration: 0.52 }, '-=0.28')
      .from('.hero-photo-wrapper',
        { y: 48, opacity: 0, scale: 0.84, duration: 0.95, ease: 'back.out(1.4)' }, '-=0.72')
      .from('.hero-arrow',
        { opacity: 0, y: -12, duration: 0.55 }, '-=0.20');

    // ── About ───────────────────────────────────────────────────────────────
    const aboutTl = gsap.timeline({
      scrollTrigger: { trigger: '#about_me_section', start: 'top 70%' }
    });
    aboutTl
      .from('.about-photo-wrap',
        { scale: 0.68, opacity: 0, rotation: -14, duration: 1.05, ease: 'back.out(1.6)' })
      .from('.about-heading',
        { x: -44, opacity: 0, duration: 0.70, ease: 'power3.out' }, '-=0.60')
      .from('.about-content p, .about-content span',
        { y: 26, opacity: 0, duration: 0.58, stagger: 0.12, ease: 'power2.out' }, '-=0.42')
      .from('.about-icon',
        { scale: 0, opacity: 0, duration: 0.46, stagger: 0.09, ease: 'back.out(2.2)' }, '-=0.22')
      .from('.social-icon-link',
        { y: 18, opacity: 0, duration: 0.44, stagger: 0.08, ease: 'power2.out' }, '-=0.18');

    // ── Skills ──────────────────────────────────────────────────────────────
    const skillsTl = gsap.timeline({
      scrollTrigger: { trigger: '#my_skills_section', start: 'top 72%' }
    });
    skillsTl
      .from('.skills-text h1',
        { x: 68, opacity: 0, duration: 0.80, ease: 'power3.out' })
      .from('.skills-text > div > div',         // decorative rule
        { scaleX: 0, opacity: 0, duration: 0.50, ease: 'power3.out', transformOrigin: 'right center' }, '-=0.42')
      .from('.skills-text > p',
        { x: 44, opacity: 0, duration: 0.65, ease: 'power3.out' }, '-=0.42')
      .from('.skills-text button, .skills-mobile-btn button',
        { x: 32, opacity: 0, scale: 0.92, duration: 0.52, ease: 'back.out(1.3)' }, '-=0.32')
      .from('.skill-item',
        { y: 44, opacity: 0, scale: 0.80, duration: 0.55,
          stagger: { amount: 0.95, from: 'start', grid: 'auto', ease: 'power1.in' },
          ease: 'back.out(1.5)' }, '-=0.46');

    // ── Portfolio — per-card ─────────────────────────────────────────────────
    document.querySelectorAll('.project-card').forEach((card, i) => {
      const fromL = i % 2 === 0;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: card, start: 'top 80%' }
      });
      tl.from(card.querySelector('.project-img-wrap'),
          { x: fromL ? -70 : 70, opacity: 0, duration: 0.85, ease: 'power3.out' })
        .from(card.querySelector('.project-info'),
          { x: fromL ? 70 : -70, opacity: 0, duration: 0.85, ease: 'power3.out' }, '-=0.65')
        .from(card.querySelectorAll('.project-num, .project-tech'),
          { y: 18, opacity: 0, duration: 0.46, stagger: 0.09, ease: 'power2.out' }, '-=0.42')
        .from(card.querySelector('h4'),
          { y: 26, opacity: 0, duration: 0.58, ease: 'power2.out' }, '-=0.32')
        .from(card.querySelector('p'),
          { y: 20, opacity: 0, duration: 0.52, ease: 'power2.out' }, '-=0.28')
        .from(card.querySelectorAll('.project-actions a'),
          { y: 16, opacity: 0, duration: 0.46, stagger: 0.10, ease: 'back.out(1.3)' }, '-=0.22');
    });

    // ── Contact ─────────────────────────────────────────────────────────────
    const contactTl = gsap.timeline({
      scrollTrigger: { trigger: '#contact_section', start: 'top 72%' }
    });
    contactTl
      .from('.contact-rule',
        { scaleX: 0, opacity: 0, duration: 0.58, transformOrigin: 'left center', ease: 'power3.out' })
      .from('.contact-heading h1',
        { y: 44, opacity: 0, duration: 0.78, ease: 'power3.out' }, '-=0.32')
      .from('.contact-info h4',
        { y: 30, opacity: 0, duration: 0.65, ease: 'power3.out' }, '-=0.44')
      .from('.contact-info p, .contact-info span',
        { y: 22, opacity: 0, duration: 0.56, stagger: 0.10, ease: 'power2.out' }, '-=0.32')
      .from('.contact-form',
        { y: 44, opacity: 0, scale: 0.95, duration: 0.80, ease: 'back.out(1.25)' }, '-=0.44')
      .from('.form-field',
        { y: 18, opacity: 0, duration: 0.46, stagger: 0.10, ease: 'power2.out' }, '-=0.46')
      .from('.form-privacy',
        { y: 14, opacity: 0, duration: 0.44, ease: 'power2.out' }, '-=0.20')
      .from('.contact-form > button',
        { y: 14, opacity: 0, scale: 0.90, duration: 0.48, ease: 'back.out(1.4)' }, '-=0.18');

    // ── Subtle scroll-parallax on hero photo ────────────────────────────────
    gsap.to('.hero-photo-wrapper', {
      yPercent: 18,
      ease: 'none',
      scrollTrigger: {
        trigger: '#above_the_fold_section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.4
      }
    });

    // ── Heading parallax on every section ───────────────────────────────────
    [
      { sel: '.about-heading',       trigger: '#about_me_section'  },
      { sel: '.skills-text h1',      trigger: '#my_skills_section' },
      { sel: '.portfolio-heading h1',trigger: '#portfolio_section' },
      { sel: '.contact-heading h1',  trigger: '#contact_section'   },
    ].forEach(({ sel, trigger }) => {
      gsap.to(sel, {
        yPercent: -12, ease: 'none',
        scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 1.8 }
      });
    });

    ScrollTrigger.refresh();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // THREE.JS — camera progress now fed by ScrollTrigger, not window.scrollY
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

    // ── Particles (Fibonacci / golden-angle) ─────────────────────────────────
    const PC   = mob ? 85 : 160;
    const pPos = new Float32Array(PC * 3);
    const pCol = new Float32Array(PC * 3).fill(1);
    const pVel = new Float32Array(PC * 2);
    const span = Math.abs(SY[4]) * 1.10;

    for (let i = 0; i < PC; i++) {
      const t    = i / PC;
      const incl = Math.acos(1 - 2 * t);
      const azim = GA * i;
      const r    = 255 + Math.random() * 380;
      pPos[i*3]   =  Math.sin(incl) * Math.cos(azim) * r;
      pPos[i*3+1] =  t * SY[4] * 1.06 + (Math.random() - 0.5) * h * 0.65;
      pPos[i*3+2] =  Math.sin(incl) * Math.sin(azim) * r - 180;
      pVel[i*2]   = (Math.random() - 0.5) * 0.020;
      pVel[i*2+1] = (Math.random() - 0.5) * 0.016;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      vertexColors: true, size: 2.0, transparent: true, opacity: 0.24, sizeAttenuation: false
    });
    scene.add(new THREE.Points(pGeo, pMat));

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

    // ── Mouse parallax ───────────────────────────────────────────────────────
    let mNX = 0, mNY = 0;
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

    // ── ScrollTrigger feeds rawF — GSAP owns the scroll value ───────────────
    let rawF = 0;
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => { rawF = self.progress; }
    });

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

      // ScrollTrigger gives us a clean 0-1 progress — lerp into sFrac
      sFrac += (rawF - sFrac) * 0.052;

      camCurve.getPoint(sFrac, tCam);
      lkCurve.getPoint(sFrac,  tLk);
      tCam.x += mNX * 18;
      tCam.y += mNY * 8;
      sCam.lerp(tCam, 0.046);
      sLk.lerp(tLk,  0.046);
      camera.position.copy(sCam);

      const roll = Math.sin(sFrac * Math.PI * 7) * 0.044;
      upVec.set(-roll, 1, 0).normalize();
      camera.up.lerp(upVec, 0.04);
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

      // particles
      const pos = pGeo.attributes['position'].array as Float32Array;
      const col = pGeo.attributes['color'].array as Float32Array;
      const ts  = Date.now() * 0.000105;

      for (let i = 0; i < PC; i++) {
        pos[i*3]   += pVel[i*2];
        pos[i*3+1] += pVel[i*2+1];
        pVel[i*2]   += (Math.random() - 0.5) * 0.0008;
        pVel[i*2+1] += (Math.random() - 0.5) * 0.0008;
        pVel[i*2]   *= 0.974;
        pVel[i*2+1] *= 0.974;

        if (pos[i*3+1] - sCam.y >  span * 0.5) pos[i*3+1] -= span;
        if (pos[i*3+1] - sCam.y < -span * 0.5) pos[i*3+1] += span;

        const dx = pos[i*3] - sCam.x, dy = pos[i*3+1] - sCam.y, dz = pos[i*3+2] - sCam.z;
        const d3 = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const cr = 250;
        if (d3 < cr) {
          const frac = 1 - d3 / cr;
          const hue  = (((Math.atan2(dy, dx) / (Math.PI * 2)) + 0.5 + ts) % 1 + 1) % 1;
          tCol.setHSL(hue, 0.84, 0.68);
          col[i*3]   = 1 - frac + tCol.r * frac;
          col[i*3+1] = 1 - frac + tCol.g * frac;
          col[i*3+2] = 1 - frac + tCol.b * frac;
        } else { col[i*3] = col[i*3+1] = col[i*3+2] = 1; }
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
      st.kill();
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',   onResize);
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
      pGeo.dispose(); pMat.dispose();
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
