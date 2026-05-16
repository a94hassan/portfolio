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

    // Header entrance — pre-hide to prevent FOUC, then drop in
    gsap.set('app-header', { y: -72, opacity: 0 });
    gsap.to('app-header', { y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', delay: 0.15 });

    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion && !this.isMobile) this.initGlobalThreeJS();
      this.initCustomCursor();
    });

    // Wait for Angular router to render main-content
    setTimeout(() => this.initJourney(), 500);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE DETECTION
  // ════════════════════════════════════════════════════════════════════════════

  private get isMobile(): boolean {
    return window.innerWidth <= 900 || !window.matchMedia('(hover: hover)').matches;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOURNEY — 7-beat pinned scroll experience
  // ════════════════════════════════════════════════════════════════════════════

  private initJourney() {
    const stages = gsap.utils.toArray<HTMLElement>('.stage');
    if (stages.length < 5) return;

    if (this.isMobile) {
      this.initMobileScroll();
      return;
    }

    // ── Unified "forward in 3D" transition DNA ──────────────────────────────
    // Every section transition uses the same metaphor:
    // outgoing → recedes (z: -200, scale: 0.88, opacity: 0)
    // incoming → emerges from behind (z: -160 → 0, scale: 0.90 → 1)
    // This creates a consistent "camera moving forward through space" feeling.

    gsap.set(stages[1], { z: -160, scale: 0.90, opacity: 0 });
    gsap.set(stages[2], { z: -160, scale: 0.90, opacity: 0 });
    gsap.set(stages[3], { z: -160, scale: 0.90, opacity: 0 });
    gsap.set(stages[4], { z: -160, scale: 0.90, opacity: 0 });

    // Content initial state — hidden, ready for entrance animations
    gsap.set([
      '.hero-text', '.hero-photo-wrapper',
      '.about-content', '.about-photo-wrap',
      '.skills-text', '.skills-grid',
      '.contact-heading', '.contact-columns',
    ], { opacity: 0, y: 10 });

    // Skill items: start small+transparent for particle-stream pop-in
    gsap.set('.skill-item', { opacity: 0, scale: 0.68, y: 8 });

    // ── MASTER TIMELINE — 6 beats, unified forward-3D DNA ──────────────────
    // All section transitions share identical easing & depth parameters.
    // The outgoing stage recedes; the incoming stage emerges from behind.

    const OUT = { z: -200, scale: 0.88, opacity: 0, duration: 1, ease: 'power2.inOut' } as const;
    const IN  = { z: 0,    scale: 1,    opacity: 1, duration: 1, ease: 'power2.out'  } as const;

    const tl = gsap.timeline()

      // Beat 0→1: Hero → About
      .to(stages[0], { ...OUT                   }, 0)
      .to(stages[1], { ...IN                    }, 0.08)

      // Beat 1→2: About → Skills
      .to(stages[1], { ...OUT                   }, 1)
      .to(stages[2], { ...IN                    }, 1.08)

      // Beat 2→3: Skills → Portfolio
      .to(stages[2], { ...OUT                   }, 2)
      .to(stages[3], { ...IN                    }, 2.08)

      // Beat 3→4: Portfolio slide — card 1 → 2
      .to('.projects-track', { xPercent: -33.333, duration: 1, ease: 'power2.inOut' }, 3)

      // Beat 4→5: Portfolio slide — card 2 → 3
      .to('.projects-track', { xPercent: -66.667, duration: 1, ease: 'power2.inOut' }, 4)

      // Beat 5→6: Portfolio → Contact
      .to(stages[3], { ...OUT                   }, 5)
      .to(stages[4], { ...IN                    }, 5.08);

    // ── ScrollTrigger — linear scrub, relaxed snap ───────────────────────────
    //
    // scrub: true → perfectly linear 1:1 scroll-to-animation mapping.
    // No resistance, no momentum lag. User has full manual control.
    //
    // snap: fires only after 0.9s of stillness (user must intentionally pause).
    // power2.inOut = gentle, not aggressive. No more "catapulting" into sections.

    let rawF = 0;
    const journeyST = ScrollTrigger.create({
      trigger: '#journey',
      start:   'top top',
      end:     'bottom bottom',
      scrub:   true,
      animation: tl,
      snap: {
        snapTo:   1 / 6,
        duration: { min: 0.55, max: 0.85 },
        delay:    0.9,
        ease:     'power2.inOut',
      },
      onUpdate:      (self) => { rawF = self.progress; },
      onSnapComplete: (self) => {
        const beat = Math.round(self.progress * 6);
        // Force timeline to exact beat position — eliminates scrub overshoot
        tl.seek(beat / 6 * tl.duration());
        // 2-frame buffer for the seek to render before entrance fires
        setTimeout(() => this.fireStageAnimation(beat), 32);
      },
    });

    // ── Section link navigation ──────────────────────────────────────────────
    const BEAT_SCROLL: Record<string, number> = {
      'above_the_fold_section': 0,
      'about_me_section':       1,
      'my_skills_section':      2,
      'portfolio_section':      3,
      'contact_section':        6,
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
        gsap.to(window, { scrollTo: targetY, duration: 1.1, ease: 'power2.inOut' });
      }
    });

    // Three.js reads rawF from closure
    (window as any).__journeyProgress = () => rawF;

    this.scrollCleanup = () => { journeyST.kill(); };

    // Hero entrance on load
    setTimeout(() => this.fireStageAnimation(0), 200);
  }

  private fireStageAnimation(beat: number) {
    const stageIdx = beat <= 2 ? beat : beat <= 5 ? 3 : 4;
    const tl = this.buildStageTl(stageIdx, beat);
    tl?.restart();
  }

  private buildStageTl(stageIdx: number, beat: number): gsap.core.Timeline | null {
    switch (stageIdx) {
      case 0: return this.heroTl();
      case 1: return this.aboutTl();
      case 2: return this.skillsTl();
      case 3: return this.portfolioTl(beat - 3);
      case 4: return this.contactTl();
      default: return null;
    }
  }

  // ── Entrance animations ───────────────────────────────────────────────────
  // gsap.to() only — captures current state as "from".
  // Return visit: elements already at final state → no-op → zero flash.

  private heroTl() {
    return gsap.timeline()
      .to('.hero-text',          { opacity: 1, y: 0, duration: 0.72, ease: 'power2.out', delay: 0.12 })
      .to('.hero-photo-wrapper', { opacity: 1, y: 0, duration: 0.68, ease: 'power2.out' }, '-=0.44');
  }

  private aboutTl() {
    return gsap.timeline()
      .to('.about-content',   { opacity: 1, y: 0, duration: 0.70, ease: 'power2.out', delay: 0.12 })
      .to('.about-photo-wrap',{ opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, '-=0.42');
  }

  private skillsTl() {
    // Skills reveal: text + grid container fade in first,
    // then individual skill cards "stream in" like particles — small→large, staggered.
    // The stagger direction (start) + back.out easing creates the particle-materializing effect.
    return gsap.timeline()
      .to('.skills-text', { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out', delay: 0.10 })
      .to('.skills-grid', { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, '-=0.30')
      .to('.skill-item',  {
        opacity: 1, scale: 1, y: 0,
        duration: 0.42,
        ease: 'back.out(1.5)',
        stagger: { amount: 0.65, from: 'start', ease: 'power2.in' },
      }, '-=0.20');
  }

  private portfolioTl(cardIdx: number) {
    const panels = gsap.utils.toArray<HTMLElement>('.project-panel');
    const panel  = panels[cardIdx];
    if (!panel) return gsap.timeline();
    return gsap.timeline()
      .to(panel, { opacity: 1, duration: 0.55, ease: 'power2.out', delay: 0.08 });
  }

  private contactTl() {
    return gsap.timeline()
      .to('.contact-heading', { opacity: 1, y: 0, duration: 0.70, ease: 'power2.out', delay: 0.12 })
      .to('.contact-columns', { opacity: 1, y: 0, duration: 0.68, ease: 'power2.out' }, '-=0.40');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE SCROLL — native touch, lightweight ScrollTrigger entrances
  // ════════════════════════════════════════════════════════════════════════════

  private initMobileScroll() {
    gsap.from(['.hero-text', '.hero-photo-wrapper'], {
      opacity: 0, y: 28,
      duration: 0.65, stagger: 0.14, ease: 'power2.out', delay: 0.35,
      clearProps: 'opacity,transform',
    });

    const groups: Array<[string, string[]]> = [
      ['.about-content',   ['.about-content', '.about-photo-wrap']],
      ['.skills-grid',     ['.skills-grid', '.skills-text']],
      ['.contact-heading', ['.contact-heading', '.contact-columns']],
    ];

    groups.forEach(([triggerSel, targets]) => {
      const triggerEl = document.querySelector(triggerSel);
      if (!triggerEl) return;
      targets.forEach((sel, i) => {
        const el = document.querySelector(sel);
        if (!el) return;
        gsap.from(el, {
          scrollTrigger: { trigger: triggerEl, start: 'top 88%', once: true },
          opacity: 0, y: 24, duration: 0.65, ease: 'power2.out',
          delay: i * 0.12, clearProps: 'opacity,transform',
        });
      });
    });

    gsap.utils.toArray<HTMLElement>('.project-panel').forEach((panel) => {
      gsap.from(panel, {
        scrollTrigger: { trigger: panel, start: 'top 90%', once: true },
        opacity: 0, y: 30, duration: 0.7, ease: 'power2.out',
        clearProps: 'opacity,transform',
      });
    });

    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    (window as any).__journeyProgress = () => 0;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // THREE.JS — Fish school + camera journey
  //
  // Architecture: single organic particle system (fish school metaphor) +
  // camera spline. Removed multi-layer complexity, wireframes, portals, stars.
  // Clean, performant, cinematic.
  // ════════════════════════════════════════════════════════════════════════════

  private initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let w = window.innerWidth;
    let h = window.innerHeight;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(58, w / h, 0.1, 8000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const SY = [0, -h * 1.15, -h * 2.55, -h * 4.05, -h * 5.35];

    // ── 22-point camera spline — cinematic journey through all sections ──────
    const _c = (x: number, fy: number, z: number) =>
      new THREE.Vector3(x, fy !== 0 ? h * fy : 0, z);

    const camPts = [
      _c(   0,    0,   560),  //  0 Hero
      _c( 280, -0.08, 430),  //  1 Hero — drift right
      _c( -80, -0.26, 710),  //  2 Pre-portal 0
      _c( 130, -0.50, 270),  //  3 Through portal 0
      _c(-220, -0.72, 620),  //  4 Emerge left
      _c(-200, -1.10, 500),  //  5 About — arrive left
      _c( 180, -1.35, 455),  //  6 About — scan right
      _c( 370, -1.55, 720),  //  7 Pre-portal 1
      _c(   0, -1.82, 255),  //  8 Through portal 1
      _c(-260, -2.02, 610),  //  9 Emerge left
      _c( 240, -2.40, 485),  // 10 Skills — arrive right
      _c(-130, -2.70, 515),  // 11 Skills — scan left
      _c(-175, -3.00, 730),  // 12 Pre-portal 2
      _c(  85, -3.22, 248),  // 13 Through portal 2
      _c( 225, -3.50, 595),  // 14 Emerge right
      _c(-185, -3.90, 530),  // 15 Portfolio — arrive left
      _c( 220, -4.20, 465),  // 16 Portfolio — scan right
      _c(  85, -4.50, 715),  // 17 Pre-portal 3
      _c(-165, -4.75, 262),  // 18 Through portal 3
      _c(  55, -5.00, 585),  // 19 Emerge
      _c(  25, -5.22, 565),  // 20 Contact — settle
      _c(   0, -5.50, 600),  // 21 Contact — arrive
    ];

    const lkPts = [
      _c(   0,    0,    0),
      _c(-180, -0.08,  0),
      _c( 200, -0.28,  0),
      _c( -80, -0.52,-65),
      _c( 160, -0.72,  0),
      _c( 165, -1.10,  0),
      _c(-185, -1.35,  0),
      _c(-200, -1.60,  0),
      _c(   0, -1.85,-110),
      _c( 185, -2.05,  0),
      _c(-185, -2.40,  0),
      _c( 155, -2.70,  0),
      _c( 215, -3.02,  0),
      _c(-100, -3.25,-80),
      _c(-185, -3.52,  0),
      _c( 205, -3.90,  0),
      _c(-165, -4.20,  0),
      _c(-115, -4.52,  0),
      _c( 105, -4.78,-90),
      _c(   0, -5.02,  0),
      _c( -65, -5.22,  0),
      _c(   0, -5.50,  0),
    ];

    const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'catmullrom', 0.4);
    const lkCurve  = new THREE.CatmullRomCurve3(lkPts,  false, 'catmullrom', 0.4);

    // ── FISH SCHOOL — organic drifting particle cluster ──────────────────────
    //
    // Each particle oscillates sinusoidally around its base position with a
    // unique frequency + phase offset. The result is organic, breathing motion
    // reminiscent of a school of fish drifting in slow water.
    //
    // Bigger particles (size: 7, sizeAttenuation: true) feel zoomed-in and
    // intimate. Opacity is low (0.20) for subtlety — they're atmosphere, not UI.

    const PC       = 320;   // particle count
    const totalSpanY = Math.abs(SY[4]) * 1.12;

    // Typed arrays for base positions, frequencies, phases
    const baseX = new Float32Array(PC);
    const baseY = new Float32Array(PC);
    const baseZ = new Float32Array(PC);
    const freqX = new Float32Array(PC);
    const freqY = new Float32Array(PC);
    const freqZ = new Float32Array(PC);
    const phsX  = new Float32Array(PC);
    const phsY  = new Float32Array(PC);
    const phsZ  = new Float32Array(PC);

    const currPos = new Float32Array(PC * 3);

    const GA  = Math.PI * (3 - Math.sqrt(5));  // golden angle

    for (let i = 0; i < PC; i++) {
      const t   = i / PC;
      const ang = GA * i;
      // Wide elliptical XZ spread, loose clustering — like a real school
      const r   = 90 + Math.random() * 360;
      baseX[i] = Math.cos(ang) * r * (0.55 + Math.random() * 0.45);
      baseY[i] = t * SY[4] + (Math.random() - 0.5) * h * 0.45;
      // Z: particles are closer to camera (100–420 units behind), creating
      // the "zoomed in, big particles" look the user requested.
      baseZ[i] = -100 - Math.random() * 320;

      // Individual oscillation frequencies — slight variation creates organic feel
      freqX[i] = 0.14 + Math.random() * 0.22;
      freqY[i] = 0.09 + Math.random() * 0.16;
      freqZ[i] = 0.06 + Math.random() * 0.10;

      // Phase offsets — ensures no two particles are in sync (school not grid)
      phsX[i] = Math.random() * Math.PI * 2;
      phsY[i] = Math.random() * Math.PI * 2;
      phsZ[i] = Math.random() * Math.PI * 2;

      currPos[i*3]   = baseX[i];
      currPos[i*3+1] = baseY[i];
      currPos[i*3+2] = baseZ[i];
    }

    const schoolGeo = new THREE.BufferGeometry();
    schoolGeo.setAttribute('position', new THREE.BufferAttribute(currPos, 3));

    const schoolMat = new THREE.PointsMaterial({
      color:           0xc8ccd6,  // cool silver-grey
      size:            7.5,        // big, close-up fish school
      transparent:     true,
      opacity:         0.20,
      sizeAttenuation: true,       // farther = smaller → natural 3D depth
      depthWrite:      false,
    });
    scene.add(new THREE.Points(schoolGeo, schoolMat));

    // ── Camera path line — the invisible "red thread" ────────────────────────
    // Very faint line tracing the camera journey. Gives spatial continuity
    // without being visible at a glance — a structural skeleton.
    const pathPts = camCurve.getPoints(240);
    const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPts);
    const pathMat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.007,
    });
    scene.add(new THREE.Line(pathGeo, pathMat));

    // ── Mouse parallax ────────────────────────────────────────────────────────
    let mNX = 0, mNY = 0, smX = 0, smY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    // ── Camera state — smoothed interpolation ─────────────────────────────────
    const sCam  = new THREE.Vector3(0, 0, 600);
    const sLk   = new THREE.Vector3(0, 0, 0);
    const tCam  = new THREE.Vector3();
    const tLk   = new THREE.Vector3();
    const upVec = new THREE.Vector3(0, 1, 0);
    let   sFrac = 0;
    let   time  = 0;

    // ── Render loop ──────────────────────────────────────────────────────────
    const animate = () => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);

      time += 0.007;   // very slow tick — the school drifts, not swims fast
      smX += (mNX - smX) * 0.055;
      smY += (mNY - smY) * 0.055;

      const rawF = (window as any).__journeyProgress?.() ?? 0;
      sFrac += (rawF - sFrac) * 0.038;

      // Camera follows spline
      camCurve.getPoint(Math.min(sFrac, 0.9999), tCam);
      lkCurve.getPoint( Math.min(sFrac, 0.9999), tLk);
      tCam.x += smX * 16;
      tCam.y += smY * 7;
      sCam.lerp(tCam, 0.040);
      sLk.lerp(tLk,  0.040);
      camera.position.copy(sCam);

      const roll = Math.sin(sFrac * Math.PI * 7) * 0.028;
      upVec.set(-roll, 1, 0).normalize();
      camera.up.lerp(upVec, 0.028);
      camera.lookAt(sLk);

      // Fish school: organic sinusoidal oscillation per particle
      const pos = schoolGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < PC; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;

        // Each particle drifts around its base position independently
        pos[ix] = baseX[i] + Math.sin(time * freqX[i] + phsX[i]) * 24 + smX * 20;
        pos[iy] = baseY[i] + Math.sin(time * freqY[i] + phsY[i]) * 16 + smY * 11;
        pos[iz] = baseZ[i] + Math.sin(time * freqZ[i] + phsZ[i]) * 10;

        // Wrap Y: keeps particles visible as camera scrolls down through sections
        const deltaY = pos[iy] - sCam.y;
        if (deltaY >  totalSpanY * 0.52) pos[iy] -= totalSpanY;
        if (deltaY < -totalSpanY * 0.52) pos[iy] += totalSpanY;
      }
      schoolGeo.attributes['position'].needsUpdate = true;

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
      schoolGeo.dispose();
      schoolMat.dispose();
      pathGeo.dispose();
      pathMat.dispose();
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOM CURSOR — theme-adaptive ring + dot
  // ════════════════════════════════════════════════════════════════════════════

  private initCustomCursor() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    const ring = document.getElementById('cursor-ring')!;
    const dot  = document.getElementById('cursor-dot')!;
    if (!ring || !dot) return;

    gsap.set(ring, { xPercent: -50, yPercent: -50 });
    gsap.set(dot,  { xPercent: -50, yPercent: -50 });

    const isLight   = () => document.documentElement.classList.contains('light');
    const ringBase  = () => isLight() ? 'rgba(17,17,17,0.32)' : 'rgba(255,255,255,0.40)';
    const ringHover = () => isLight() ? 'rgba(17,17,17,0.72)' : 'rgba(255,255,255,0.75)';

    let appeared = false;
    let spotEls: HTMLElement[] = [];
    let rects:   DOMRect[]     = [];
    const SEL = '.skill-item,.project-info,.project-img-wrap,.about-icon,.social-icon-link,form,button';

    const refresh = () => { rects = spotEls.map(el => el.getBoundingClientRect()); };
    setTimeout(() => {
      spotEls = Array.from(document.querySelectorAll(SEL)) as HTMLElement[];
      refresh();
    }, 900);

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
