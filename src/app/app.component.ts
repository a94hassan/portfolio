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

  // ─── Full-page scroll snap controller ─────────────────────────────────────

  private initScrollSnap() {
    const SECTION_IDS = [
      '#above_the_fold_section',
      '#about_me_section',
      '#my_skills_section',
      '#portfolio_section',
      '#contact_section'
    ];

    let sections: HTMLElement[] = [];
    let current = 0;
    let locked = false;
    const LOCK_MS = 1100;
    const HEADER_H = 80;

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

    const scrollTo = (idx: number) => {
      const target = sections[idx];
      if (!target) return;
      const top = window.scrollY + target.getBoundingClientRect().top - HEADER_H;
      window.scrollTo({ top, behavior: 'smooth' });
    };

    const onWheel = (e: WheelEvent) => {
      if (!sections.length) return;
      if (Math.abs(e.deltaY) < 8) return;

      const curr = sections[current];
      const rect = curr?.getBoundingClientRect();
      const dir  = e.deltaY > 0 ? 1 : -1;

      if (rect && dir ===  1 && rect.bottom > window.innerHeight + 20) return;
      if (rect && dir === -1 && rect.top    < -20)                       return;

      const next = Math.max(0, Math.min(sections.length - 1, current + dir));
      if (next === current || locked) return;

      e.preventDefault();
      locked = true;
      scrollTo(next);
      current = next;
      setTimeout(() => { locked = false; }, LOCK_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!sections.length || locked) return;
      let dir = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') dir =  1;
      if (e.key === 'ArrowUp'   || e.key === 'PageUp')   dir = -1;
      if (!dir) return;
      e.preventDefault();
      const next = Math.max(0, Math.min(sections.length - 1, current + dir));
      if (next === current) return;
      locked = true; scrollTo(next); current = next;
      setTimeout(() => { locked = false; }, LOCK_MS);
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchEnd   = (e: TouchEvent) => {
      if (!sections.length || locked) return;
      const delta = touchY - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 52) return;
      const dir  = delta > 0 ? 1 : -1;
      const curr = sections[current];
      const rect = curr?.getBoundingClientRect();
      if (rect && dir ===  1 && rect.bottom > window.innerHeight + 20) return;
      if (rect && dir === -1 && rect.top    < -20) return;
      const next = Math.max(0, Math.min(sections.length - 1, current + dir));
      if (next === current) return;
      locked = true; scrollTo(next); current = next;
      setTimeout(() => { locked = false; }, LOCK_MS);
    };

    setTimeout(init, 400);
    window.addEventListener('scroll',     findCurrent,  { passive: true });
    window.addEventListener('wheel',      onWheel,      { passive: false });
    window.addEventListener('keydown',    onKeyDown);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true });

    this.scrollCleanup = () => {
      window.removeEventListener('scroll',     findCurrent);
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('keydown',    onKeyDown);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }

  // ─── 3D section entrance animations (GSAP + ScrollTrigger) ────────────────

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
        opacity: 1, y: 0, scale: 1, rotateX: 0,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top 92%', end: 'top 10%', scrub: 2.0 }
      });
    });

    ScrollTrigger.refresh();
  }

  // ─── Three.js — Phi-space journey ─────────────────────────────────────────

  private initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const isMobile = w <= 768;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(58, w / h, 0.1, 12000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ── Golden ratio constants ─────────────────────────────────────────────
    const PHI = (1 + Math.sqrt(5)) / 2;          // ≈ 1.6180
    const GA  = Math.PI * (3 - Math.sqrt(5));    // golden angle ≈ 137.5°

    // ── Section world-Y positions (spaced by ~1 viewport height each) ──────
    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];

    // ── Camera spline — winds through the scene as scroll progresses ───────
    // Camera oscillates left/right while descending, creating oblique views.
    // lookAt target is mirrored to create rotation as the camera swings.
    const camPts = [
      new THREE.Vector3(    0,  SY[0],  600),
      new THREE.Vector3( -170,  SY[1],  530),
      new THREE.Vector3(  230,  SY[2],  490),
      new THREE.Vector3( -140,  SY[3],  550),
      new THREE.Vector3(   55,  SY[4],  600),
    ];
    const lkPts = [
      new THREE.Vector3(    0,  SY[0],  0),
      new THREE.Vector3(  140,  SY[1],  0),
      new THREE.Vector3( -185,  SY[2],  0),
      new THREE.Vector3(  110,  SY[3],  0),
      new THREE.Vector3(    0,  SY[4],  0),
    ];
    const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'catmullrom', 0.5);
    const lkCurve  = new THREE.CatmullRomCurve3(lkPts,  false, 'catmullrom', 0.5);

    // ── Fibonacci particle field ───────────────────────────────────────────
    // Particles placed via golden-angle spiral (sunflower seed distribution)
    const PC   = isMobile ? 90 : 165;
    const pPos = new Float32Array(PC * 3);
    const pCol = new Float32Array(PC * 3).fill(1);
    const pVel = new Float32Array(PC * 2);
    const totalSpan = Math.abs(SY[4]) * 1.08;

    for (let i = 0; i < PC; i++) {
      const t    = i / PC;
      const incl = Math.acos(1 - 2 * t);
      const azim = GA * i;
      const r    = 260 + Math.random() * 380;
      pPos[i*3]   =  Math.sin(incl) * Math.cos(azim) * r;
      pPos[i*3+1] =  t * SY[4] * 1.05 + (Math.random() - 0.5) * h * 0.7;
      pPos[i*3+2] =  Math.sin(incl) * Math.sin(azim) * r - 190;
      pVel[i*2]   = (Math.random() - 0.5) * 0.022;
      pVel[i*2+1] = (Math.random() - 0.5) * 0.018;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      vertexColors: true, size: 2.1, transparent: true, opacity: 0.26, sizeAttenuation: false
    });
    scene.add(new THREE.Points(pGeo, pMat));

    // ── Wireframe helper ──────────────────────────────────────────────────
    const allWfMeshes: THREE.LineSegments[] = [];
    const allWfMats:   THREE.LineBasicMaterial[] = [];
    const allWfBase:   number[] = [];

    const mkWf = (
      geo: THREE.BufferGeometry, opa: number,
      px: number, py: number, pz: number,
      rx = 0, ry = 0, rz = 0
    ) => {
      const edges = new THREE.EdgesGeometry(geo);
      const mat   = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opa });
      const mesh  = new THREE.LineSegments(edges, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(rx, ry, rz);
      geo.dispose();
      scene.add(mesh);
      allWfMeshes.push(mesh);
      allWfMats.push(mat);
      allWfBase.push(opa);
      return mesh;
    };

    // ── Room markers — each section has a characteristic Phi-scaled shape ──
    const dim = Math.min(w, h);
    const S   = dim * 0.26;  // base size

    // Section 0 — Hero: large icosahedron (Platonic solid of highest symmetry)
    mkWf(new THREE.IcosahedronGeometry(S * 1.00, 1), 0.036,  dim * 0.29,  SY[0],         -300);
    // Secondary shape — smaller, offset
    mkWf(new THREE.IcosahedronGeometry(S * 0.38, 1), 0.022, -dim * 0.18,  SY[0] - h*0.2, -200);

    // Section 1 — About: dodecahedron (12 pentagonal faces, Phi proportions)
    mkWf(new THREE.DodecahedronGeometry(S / PHI,    0), 0.032, -dim * 0.27,  SY[1],         -250,  0.2, 0.4, 0);
    mkWf(new THREE.DodecahedronGeometry(S / PHI / PHI, 0), 0.020, dim * 0.14, SY[1] + h*0.2, -160);

    // Section 2 — Skills: octahedron (dual of cube, precise geometry)
    mkWf(new THREE.OctahedronGeometry(S * PHI / 2, 0), 0.034,  dim * 0.31,  SY[2],         -220,  0.3, 0.1, 0.2);
    mkWf(new THREE.OctahedronGeometry(S / 3,       0), 0.020, -dim * 0.12,  SY[2] - h*0.2, -180);

    // Section 3 — Portfolio: torus knot (mathematical elegance)
    mkWf(new THREE.TorusKnotGeometry(S * 0.42, S * 0.09, 80, 7), 0.024, -dim * 0.25, SY[3], -270,  0.1, 0, 0.15);

    // Section 4 — Contact: geodesic sphere (frequency-2 icosahedron)
    mkWf(new THREE.IcosahedronGeometry(S * 0.88, 2), 0.030,  dim * 0.22,  SY[4],         -210,  0.2, 0.3, 0);

    // ── Portal rings — at section transition midpoints ─────────────────────
    // Torus proportions: outer/inner = φ² (≈ 2.618)
    const portalY: number[] = SY.slice(0, 4).map((y, i) => (y + SY[i + 1]) * 0.5);
    const portalX = [-55, 85, -45, 22];
    const portalRot = [0.10, -0.08, 0.12, -0.07];
    const portalMeshes: THREE.LineSegments[] = [];
    const portalMats:   THREE.LineBasicMaterial[] = [];

    portalY.forEach((py, i) => {
      const outerR = dim * 0.28;
      const tubeR  = outerR / (PHI * PHI);
      const geo    = new THREE.TorusGeometry(outerR, tubeR, 5, 48);
      const mat    = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.013 });
      const edges  = new THREE.EdgesGeometry(geo);
      geo.dispose();
      const mesh = new THREE.LineSegments(edges, mat);
      mesh.position.set(portalX[i], py, -90);
      mesh.rotation.x = portalRot[i];
      scene.add(mesh);
      portalMeshes.push(mesh);
      portalMats.push(mat);
    });

    // ── Golden logarithmic spiral — spine of the journey ──────────────────
    // r(θ) = a · φ^(bθ) — grows by factor φ with each unit turn
    const SPN = 340;
    const spPts: THREE.Vector3[] = [];
    for (let i = 0; i < SPN; i++) {
      const t   = i / SPN;
      const ang = t * Math.PI * 12;           // 6 full turns through the journey
      const r   = 55 * Math.pow(PHI, t * 2.4);
      spPts.push(new THREE.Vector3(
        Math.cos(ang) * r * 0.52,
        t * SY[4] * 1.03,
        Math.sin(ang) * r * 0.33 - 460
      ));
    }
    const spGeo = new THREE.BufferGeometry().setFromPoints(spPts);
    const spMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.018 });
    scene.add(new THREE.Line(spGeo, spMat));

    // ── Second lighter spiral (phase offset) ──────────────────────────────
    const sp2Pts: THREE.Vector3[] = [];
    for (let i = 0; i < SPN; i++) {
      const t   = i / SPN;
      const ang = t * Math.PI * 12 + Math.PI; // 180° offset
      const r   = 40 * Math.pow(PHI, t * 2.2);
      sp2Pts.push(new THREE.Vector3(
        Math.cos(ang) * r * 0.42,
        t * SY[4] * 1.03,
        Math.sin(ang) * r * 0.28 - 480
      ));
    }
    const sp2Geo = new THREE.BufferGeometry().setFromPoints(sp2Pts);
    const sp2Mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.012 });
    scene.add(new THREE.Line(sp2Geo, sp2Mat));

    // ── Mouse ─────────────────────────────────────────────────────────────
    let mNX = 0, mNY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    // ── Smooth camera state ────────────────────────────────────────────────
    const smoothCam  = new THREE.Vector3(0, 0, 600);
    const smoothLk   = new THREE.Vector3(0, 0, 0);
    const tmpCam     = new THREE.Vector3();
    const tmpLk      = new THREE.Vector3();
    const tCol       = new THREE.Color();
    let   smoothFrac = 0;

    // Rotation speeds for each room marker (unique per shape, avoid repetition)
    const rotRates = [
      [ 0.00036,  0.00050,  0],
      [ 0,        0.00042,  0.00030],
      [ 0.00045,  0,        0.00034],
      [ 0.00028,  0.00036,  0.00018],
      [-0.00022,  0.00038,  0.00026],
      [ 0.00032, -0.00028,  0],
      [ 0.00020,  0,        0.00040],
      [ 0.00030,  0.00022,  0],
      [ 0.00016,  0.00034, -0.00020],
      [ 0,        0.00028,  0.00036],
    ];

    // ── Render loop ───────────────────────────────────────────────────────
    const animate = () => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);

      // Scroll-driven fraction with smooth lerp
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const rawFrac   = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0;
      smoothFrac     += (rawFrac - smoothFrac) * 0.038;

      // Camera follows spline + mouse parallax
      camCurve.getPoint(smoothFrac, tmpCam);
      lkCurve.getPoint(smoothFrac, tmpLk);
      tmpCam.x += mNX * 20;
      tmpCam.y += mNY * 9;
      smoothCam.lerp(tmpCam, 0.042);
      smoothLk.lerp(tmpLk,   0.042);
      camera.position.copy(smoothCam);
      camera.lookAt(smoothLk);

      // ── Room markers: rotate + proximity brightness ──────────────────
      const roomSectionMap = [0, 0, 1, 1, 2, 2, 3, 4, 4, 4]; // which section each mesh belongs to
      allWfMeshes.forEach((m, i) => {
        const rs = rotRates[i] ?? [0, 0.0003, 0];
        m.rotation.x += rs[0]; m.rotation.y += rs[1]; m.rotation.z += rs[2];
        const sIdx = roomSectionMap[i] ?? i;
        const sY   = SY[sIdx] ?? 0;
        const dist = Math.abs(smoothCam.y - sY);
        const rng  = h * 0.88;
        allWfMats[i].opacity = allWfBase[i] + Math.max(0, 1 - dist / rng) * 0.054;
      });

      // ── Portal rings: glow + scale as camera approaches ───────────────
      portalMeshes.forEach((p, i) => {
        p.rotation.z += 0.00016 * (i % 2 === 0 ? 1 : -1);
        const dist  = Math.abs(smoothCam.y - portalY[i]);
        const range = h * 0.78;
        const t     = Math.max(0, 1 - dist / range);
        portalMats[i].opacity = 0.012 + t * 0.055;   // dezent: max ~0.067
        const sc = 1.0 + t * 0.25;
        p.scale.set(sc, sc, 1.0 + t * 0.10);          // slight Z compression for depth illusion
      });

      // ── Fibonacci particles: drift + color near camera ────────────────
      const pos = pGeo.attributes['position'].array as Float32Array;
      const col = pGeo.attributes['color'].array as Float32Array;
      const ts  = Date.now() * 0.00011;

      for (let i = 0; i < PC; i++) {
        pos[i*3]   += pVel[i*2];
        pos[i*3+1] += pVel[i*2+1];
        pVel[i*2]   += (Math.random() - 0.5) * 0.0009;
        pVel[i*2+1] += (Math.random() - 0.5) * 0.0009;
        pVel[i*2]   *= 0.972;
        pVel[i*2+1] *= 0.972;

        // Tile vertically around camera
        if (pos[i*3+1] - smoothCam.y >  totalSpan * 0.5) pos[i*3+1] -= totalSpan;
        if (pos[i*3+1] - smoothCam.y < -totalSpan * 0.5) pos[i*3+1] += totalSpan;

        // Colour shimmer near camera
        const dx = pos[i*3]   - smoothCam.x;
        const dy = pos[i*3+1] - smoothCam.y;
        const dz = pos[i*3+2] - smoothCam.z;
        const d3 = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const cr = 255;
        if (d3 < cr) {
          const t2  = 1 - d3 / cr;
          const hue = (((Math.atan2(dy, dx) / (Math.PI * 2)) + 0.5 + ts) % 1 + 1) % 1;
          tCol.setHSL(hue, 0.86, 0.68);
          col[i*3]   = 1 - t2 + tCol.r * t2;
          col[i*3+1] = 1 - t2 + tCol.g * t2;
          col[i*3+2] = 1 - t2 + tCol.b * t2;
        } else {
          col[i*3] = col[i*3+1] = col[i*3+2] = 1;
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
    const onVisChg = () => { if (!document.hidden && this.animId === 0) animate(); };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisChg);
    animate();

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisChg);
      renderer.dispose();
      pGeo.dispose(); pMat.dispose();
      spGeo.dispose(); spMat.dispose();
      sp2Geo.dispose(); sp2Mat.dispose();
      allWfMeshes.forEach(m => {
        m.geometry.dispose();
        (m.material as THREE.LineBasicMaterial).dispose();
      });
      portalMeshes.forEach(m => {
        m.geometry.dispose();
        (m.material as THREE.LineBasicMaterial).dispose();
      });
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
    let spotElements: HTMLElement[] = [];
    let cachedRects: DOMRect[] = [];
    const SPOT_SEL = '.skill-item,.project-info,.project-img-wrap,.about-icon,.social-icon-link,form,button';

    const refreshRects = () => { cachedRects = spotElements.map(el => el.getBoundingClientRect()); };
    setTimeout(() => { spotElements = Array.from(document.querySelectorAll(SPOT_SEL)) as HTMLElement[]; refreshRects(); }, 900);

    const onMove = (e: MouseEvent) => {
      if (!appeared) { gsap.to([ring, dot], { opacity: 1, duration: 0.4 }); appeared = true; }
      gsap.to(dot,  { x: e.clientX, y: e.clientY, duration: 0 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.18, ease: 'power2.out' });
      for (let i = 0; i < spotElements.length; i++) {
        const r = cachedRects[i]; if (!r) continue;
        spotElements[i].style.setProperty('--mx', `${e.clientX - r.left}px`);
        spotElements[i].style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };

    const onOver = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, input, textarea'))
        gsap.to(ring, { scale: 1.7, borderColor: 'rgba(255,255,255,0.75)', duration: 0.22 });
    };
    const onOut = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, input, textarea'))
        gsap.to(ring, { scale: 1, borderColor: 'rgba(255,255,255,0.40)', duration: 0.22 });
    };
    const onLeave  = () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    const onEnter  = () => { if (appeared) gsap.to([ring, dot], { opacity: 1, duration: 0.3 }); };

    window.addEventListener('mousemove', onMove,  { passive: true });
    window.addEventListener('scroll',    refreshRects, { passive: true });
    window.addEventListener('resize',    refreshRects, { passive: true });
    document.addEventListener('mouseover',  onOver);
    document.addEventListener('mouseout',   onOut);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    this.cursorCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll',    refreshRects);
      window.removeEventListener('resize',    refreshRects);
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
