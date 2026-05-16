import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ThemeService } from './shared/services/theme.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
  private zone = inject(NgZone);
  private themeService = inject(ThemeService);
  private animId = 0;
  private threeCleanup?: () => void;
  private cursorCleanup?: () => void;
  private scrollCleanup?: () => void;

  ngOnInit() {
    this.themeService.init();
    gsap.registerPlugin(ScrollTrigger);

    gsap.from('app-header', { y: -80, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });

    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) this.initGlobalThreeJS();
      this.initCustomCursor();
    });

    this.initScrollSnap();
    setTimeout(() => this.initSectionTransitions(), 800);
  }

  // ─── Full-page scroll snap — RAF-based smooth scroll ──────────────────────
  // Uses custom easeInOutQuart instead of native behavior:'smooth'
  // so timing and feel are consistent across all browsers.

  private initScrollSnap() {
    const SECTION_IDS = [
      '#above_the_fold_section',
      '#about_me_section',
      '#my_skills_section',
      '#portfolio_section',
      '#contact_section'
    ];

    let sections: HTMLElement[] = [];
    let current  = 0;
    let locked   = false;
    const HEADER = 80;

    // ── Smooth scroll: RAF + easeInOutQuart ──────────────────────────────
    const scrollTo = (idx: number) => {
      const el = sections[idx];
      if (!el) return;

      const targetY = window.scrollY + el.getBoundingClientRect().top - HEADER;
      const startY  = window.scrollY;
      const dist    = targetY - startY;
      const dur     = 960;        // ms
      const t0      = performance.now();

      // easeInOutQuart — fast ramp, smooth arrival
      const ease = (t: number) =>
        t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

      const step = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        window.scrollTo(0, startY + dist * ease(p));
        if (p < 1) requestAnimationFrame(step);
        else { setTimeout(() => { locked = false; }, 80); }
      };

      requestAnimationFrame(step);
    };

    const init = () => {
      sections = SECTION_IDS
        .map(id => document.querySelector(id) as HTMLElement)
        .filter(Boolean);
    };

    const findCurrent = () => {
      const mid = window.innerHeight * 0.45;
      for (let i = 0; i < sections.length; i++) {
        const r = sections[i]?.getBoundingClientRect();
        if (r && r.top <= mid && r.bottom >= mid) { current = i; return; }
      }
    };

    const navigate = (dir: 1 | -1) => {
      if (!sections.length || locked) return;
      const curr = sections[current]?.getBoundingClientRect();
      if (dir ===  1 && curr && curr.bottom > window.innerHeight + 20) return;
      if (dir === -1 && curr && curr.top    < -20)                       return;
      const next = Math.max(0, Math.min(sections.length - 1, current + dir));
      if (next === current) return;
      locked = true; scrollTo(next); current = next;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      if (locked) { e.preventDefault(); return; }
      navigate(e.deltaY > 0 ? 1 : -1);
      if (locked) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navigate(1); }
      if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); navigate(-1); }
    };

    let ty = 0;
    const onTouchStart = (e: TouchEvent) => { ty = e.touches[0].clientY; };
    const onTouchEnd   = (e: TouchEvent) => {
      const delta = ty - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 52) return;
      navigate(delta > 0 ? 1 : -1);
    };

    setTimeout(init, 400);
    window.addEventListener('scroll',     findCurrent,  { passive: true });
    window.addEventListener('wheel',      onWheel,      { passive: false });
    window.addEventListener('keydown',    onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true });

    this.scrollCleanup = () => {
      window.removeEventListener('scroll',     findCurrent);
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('keydown',    onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }

  // ─── GSAP section 3D entrance animations ──────────────────────────────────

  private initSectionTransitions() {
    const sections = Array.from(
      document.querySelectorAll('section[id]:not(#above_the_fold_section)')
    ) as HTMLElement[];

    sections.forEach(section => {
      gsap.set(section, {
        opacity: 0, y: 80, scale: 0.92, rotateX: 9,
        transformPerspective: 1400, transformOrigin: 'top center'
      });
      gsap.to(section, {
        opacity: 1, y: 0, scale: 1, rotateX: 0, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top 92%', end: 'top 10%', scrub: 2.0 }
      });
    });

    ScrollTrigger.refresh();
  }

  // ─── Three.js — Phi-space journey ─────────────────────────────────────────
  //
  // Camera follows a 22-point CatmullRom spline.
  // BEFORE each portal: camera pulls back (Z→700) and swings laterally.
  // THROUGH each portal: Z drops to 250-280 — rushing through the opening.
  // AFTER each portal:  camera re-emerges on the opposite side.
  //
  // Geometry sizes follow golden ratio φ = 1.618.

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

    const PHI = (1 + Math.sqrt(5)) / 2;          // ≈ 1.618
    const GA  = Math.PI * (3 - Math.sqrt(5));    // golden angle ≈ 137.5°

    // Section world-Y positions (camera path measured in viewport heights)
    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];

    // ── 22-point camera spline ─────────────────────────────────────────────
    // Pattern per portal: wide swing (Z high) → dive through (Z low) → emerge opposite
    // Numbers prefixed with ★ are the "rush-through" moments (low Z)
    const _c = (x: number, fy: number, z: number) =>
      new THREE.Vector3(x, fy !== 0 ? h * fy : 0, z);

    const camPts = [
      _c(   0,    0,     560),  //  0 Hero arrival — centre
      _c( 280, -0.08,   430),  //  1 Hero — drift right, closer
      _c( -80, -0.26,   710),  //  2 Pre-portal 0 — pull back, swing left
      _c( 130, -0.50,   270),  //★ 3 Through portal 0 — Z dive forward
      _c(-220, -0.72,   620),  //  4 Emerge left
      _c(-200, -1.10,   500),  //  5 About — arrive left
      _c( 180, -1.35,   455),  //  6 About — scan right
      _c( 370, -1.55,   720),  //  7 Pre-portal 1 — pull back, far right
      _c(   0, -1.82,   255),  //★ 8 Through portal 1 — Z dive
      _c(-260, -2.02,   610),  //  9 Emerge left
      _c( 240, -2.40,   485),  // 10 Skills — arrive right
      _c(-130, -2.70,   515),  // 11 Skills — scan left
      _c(-175, -3.00,   730),  // 12 Pre-portal 2 — pull far back left
      _c(  85, -3.22,   248),  //★13 Through portal 2 — Z dive
      _c( 225, -3.50,   595),  // 14 Emerge right
      _c(-185, -3.90,   530),  // 15 Portfolio — arrive left
      _c( 220, -4.20,   465),  // 16 Portfolio — scan right
      _c(  85, -4.50,   715),  // 17 Pre-portal 3 — pull far back
      _c(-165, -4.75,   262),  //★18 Through portal 3 — Z dive
      _c(  55, -5.00,   585),  // 19 Emerge centre
      _c(  25, -5.22,   565),  // 20 Contact — settle
      _c(   0, -5.50,   600),  // 21 Contact — arrive centre
    ];

    const lkPts = [
      _c(   0,    0,     0),   //  0
      _c(-180, -0.08,   0),   //  1
      _c( 200, -0.28,   0),   //  2
      _c( -80, -0.52,  -65),  //  3 Look through portal (negative Z depth)
      _c( 160, -0.72,   0),   //  4
      _c( 165, -1.10,   0),   //  5
      _c(-185, -1.35,   0),   //  6
      _c(-200, -1.60,   0),   //  7
      _c(   0, -1.85, -110),  //  8 Look through
      _c( 185, -2.05,   0),   //  9
      _c(-185, -2.40,   0),   // 10
      _c( 155, -2.70,   0),   // 11
      _c( 215, -3.02,   0),   // 12
      _c(-100, -3.25,  -80),  // 13 Look through
      _c(-185, -3.52,   0),   // 14
      _c( 205, -3.90,   0),   // 15
      _c(-165, -4.20,   0),   // 16
      _c(-115, -4.52,   0),   // 17
      _c( 105, -4.78,  -90),  // 18 Look through
      _c(   0, -5.02,   0),   // 19
      _c( -65, -5.22,   0),   // 20
      _c(   0, -5.50,   0),   // 21
    ];

    const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'catmullrom', 0.4);
    const lkCurve  = new THREE.CatmullRomCurve3(lkPts,  false, 'catmullrom', 0.4);

    // ── Fibonacci particle field (golden-angle distribution) ───────────────
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

    // ── Wireframe helper ──────────────────────────────────────────────────
    const wMeshes: THREE.LineSegments[] = [];
    const wMats:   THREE.LineBasicMaterial[] = [];
    const wBase:   number[] = [];
    const wSecY:   number[] = [];  // which section Y this belongs to

    const mkWf = (
      geo: THREE.BufferGeometry, opa: number,
      px: number, py: number, pz: number, sectionIdx: number,
      rx = 0, ry = 0, rz = 0
    ) => {
      const edges = new THREE.EdgesGeometry(geo);
      const mat   = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opa });
      const mesh  = new THREE.LineSegments(edges, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(rx, ry, rz);
      geo.dispose();
      scene.add(mesh);
      wMeshes.push(mesh); wMats.push(mat); wBase.push(opa);
      wSecY.push(SY[sectionIdx] ?? 0);
      return mesh;
    };

    const dim = Math.min(w, h);
    const S   = dim * 0.25;   // base size

    // Hero — large icosahedron + small companion
    mkWf(new THREE.IcosahedronGeometry(S,           1), 0.034,  dim*0.28,  SY[0],           -300, 0);
    mkWf(new THREE.IcosahedronGeometry(S * 0.35,    0), 0.020, -dim*0.16,  SY[0] - h*0.18,  -180, 0);

    // About — dodecahedron (φ embedded in pentagons) + companion
    mkWf(new THREE.DodecahedronGeometry(S / PHI,       0), 0.030, -dim*0.26, SY[1],          -240, 1,  0.2, 0.4, 0);
    mkWf(new THREE.DodecahedronGeometry(S / PHI / PHI, 0), 0.018,  dim*0.13, SY[1] + h*0.18, -155, 1);

    // Skills — octahedron (dual of cube)
    mkWf(new THREE.OctahedronGeometry(S * PHI / 2, 0), 0.032,  dim*0.30, SY[2],          -215, 2,  0.3, 0.1, 0.2);
    mkWf(new THREE.OctahedronGeometry(S * 0.28,    0), 0.018, -dim*0.11, SY[2] - h*0.18, -170, 2);

    // Portfolio — torus knot (mathematical elegance)
    mkWf(new THREE.TorusKnotGeometry(S * 0.42, S * 0.09, 80, 7), 0.022, -dim*0.24, SY[3], -260, 3,  0.1, 0, 0.15);

    // Contact — geodesic sphere (freq-2)
    mkWf(new THREE.IcosahedronGeometry(S * 0.88, 2), 0.028,  dim*0.22,  SY[4], -205, 4,  0.2, 0.3, 0);

    // ── Portal rings — between sections ───────────────────────────────────
    // Torus proportion: outerR / tubeR = φ² ≈ 2.618
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
      scene.add(mesh);
      pMeshes.push(mesh);
      pMatsArr.push(mat);
    });

    // ── Golden logarithmic spiral — spine line ─────────────────────────────
    // r(θ) = a · φ^(b·θ), grows by φ per unit turn
    const mkSpiral = (phase: number, bFactor: number, xScale: number, zOff: number, opa: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 340; i++) {
        const t   = i / 340;
        const ang = t * Math.PI * 12 + phase;
        const r   = 52 * Math.pow(PHI, t * bFactor);
        pts.push(new THREE.Vector3(
          Math.cos(ang) * r * xScale,
          t * SY[4] * 1.04,
          Math.sin(ang) * r * 0.32 + zOff
        ));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opa });
      scene.add(new THREE.Line(g, m));
      return { g, m };
    };

    const sp1 = mkSpiral(0,        2.2, 0.50, -450, 0.016);
    const sp2 = mkSpiral(Math.PI,  2.0, 0.38, -480, 0.010);

    // ── Mouse ─────────────────────────────────────────────────────────────
    let mNX = 0, mNY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    // ── Smooth camera state ────────────────────────────────────────────────
    const sCam   = new THREE.Vector3(0, 0, 600);
    const sLk    = new THREE.Vector3(0, 0, 0);
    const tCam   = new THREE.Vector3();
    const tLk    = new THREE.Vector3();
    const upVec  = new THREE.Vector3(0, 1, 0);
    const tCol   = new THREE.Color();
    let sFrac    = 0;

    // Per-mesh rotation rates (varied to avoid visual repetition)
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

    // ── Render loop ───────────────────────────────────────────────────────
    const animate = () => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);

      const maxS  = document.documentElement.scrollHeight - window.innerHeight;
      const rawF  = maxS > 0 ? Math.max(0, Math.min(1, window.scrollY / maxS)) : 0;
      sFrac      += (rawF - sFrac) * 0.048;   // slightly faster to keep up with snap

      // Camera follows spline + mouse parallax
      camCurve.getPoint(sFrac, tCam);
      lkCurve.getPoint(sFrac,  tLk);
      tCam.x += mNX * 18;
      tCam.y += mNY * 8;
      sCam.lerp(tCam, 0.046);
      sLk.lerp(tLk,  0.046);
      camera.position.copy(sCam);

      // Subtle camera roll (±2.5°) — follows a slow sine of journey progress
      const roll = Math.sin(sFrac * Math.PI * 7) * 0.044;
      upVec.set(-roll, 1, 0).normalize();
      camera.up.lerp(upVec, 0.04);

      camera.lookAt(sLk);

      // ── Room markers: rotate + proximity brightness ──────────────────
      wMeshes.forEach((m, i) => {
        const r = rotR[i] ?? [0, 0.0003, 0];
        m.rotation.x += r[0]; m.rotation.y += r[1]; m.rotation.z += r[2];
        const dist = Math.abs(sCam.y - wSecY[i]);
        const rng  = h * 0.90;
        wMats[i].opacity = wBase[i] + Math.max(0, 1 - dist / rng) * 0.052;
      });

      // ── Portals: glow + scale on approach, peak at Z-dive moment ─────
      pMeshes.forEach((p, i) => {
        p.rotation.z += 0.00015 * (i % 2 === 0 ? 1 : -1);
        const dist  = Math.abs(sCam.y - portalY[i]);
        const range = h * 0.78;
        const t     = Math.max(0, 1 - dist / range);
        pMatsArr[i].opacity = 0.010 + t * 0.058;
        const sc = 1.0 + t * 0.28;
        p.scale.set(sc, sc, 1.0 + t * 0.12);  // slight Z stretch = depth illusion
      });

      // ── Fibonacci particles: drift + colour shimmer ───────────────────
      const pos = pGeo.attributes['position'].array as Float32Array;
      const col = pGeo.attributes['color'].array as Float32Array;
      const ts  = Date.now() * 0.000105;

      for (let i = 0; i < PC; i++) {
        pos[i*3]   += pVel[i*2];
        pos[i*3+1] += pVel[i*2+1];
        pVel[i*2]   += (Math.random() - 0.5) * 0.0008;
        pVel[i*2+1] += (Math.random() - 0.5) * 0.0008;
        pVel[i*2]   *= 0.974; pVel[i*2+1] *= 0.974;

        // Vertical tile relative to camera
        if (pos[i*3+1] - sCam.y >  span * 0.5) pos[i*3+1] -= span;
        if (pos[i*3+1] - sCam.y < -span * 0.5) pos[i*3+1] += span;

        // HSL shimmer near camera
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

  // ─── Custom cursor ─────────────────────────────────────────────────────────

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
        gsap.to(ring, { scale: 1,   borderColor: 'rgba(255,255,255,0.40)', duration: 0.22 });
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
  }
}
