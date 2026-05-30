import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { ThemeService } from './shared/services/theme.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import type * as THREE from 'three';
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

    // ── Master timeline: OUT/IN share identical parameters ───────────────────
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
    const onLinkClick = (e: MouseEvent) => {
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
    };
    document.addEventListener('click', onLinkClick);

    (window as any).__journeyProgress = () => rawF;
    this.scrollCleanup = () => {
      st.kill();
      document.removeEventListener('click', onLinkClick);
    };
    lastBeat = 0;
    this.scheduleLoaderHide(120);
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

    const onMobileLinkClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      e.preventDefault();
    };
    document.addEventListener('click', onMobileLinkClick);

    (window as any).__journeyProgress = () => 0;
    this.scrollCleanup = () => {
      document.removeEventListener('click', onMobileLinkClick);
    };
    this.scheduleLoaderHide(120);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // THREE.JS — Spatial Corridor: architectural grid chamber the camera flies through
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Concept: Apple Vision Pro / Apple Silicon aesthetic.
  // The camera moves forward along a Z tunnel as the user scrolls.
  // A perspective grid (floor + ceiling) creates infinite depth sensation.
  // Rectangular gate frames mark each section boundary — they glow as the
  // camera approaches, creating an "entering a new room" spatial narrative.
  // On section transitions: speed streaks flash + camera Z velocity spikes.

  private async initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const THREE = await import('three');

    let w = window.innerWidth, h = window.innerHeight;

    const getCSSColor = (v: string, fb: string): string =>
      getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

    const light = () => document.documentElement.classList.contains('light');
    const lineCol   = () => new THREE.Color(light() ? 0x1c1c1e : 0xe0e0e4);
    const fogColStr = () => getCSSColor('--bg', light() ? '#f5f5f7' : '#0a0a0a');

    const scene    = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(fogColStr()).getHex(), 0.00020);

    const camera   = new THREE.PerspectiveCamera(60, w / h, 1, 6000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // ── Corridor geometry constants ──────────────────────────────────────────
    const TUNNEL_Z   = 2600;   // total Z depth of the journey
    const RAIL_W     =  600;   // half-width of corridor
    const FLOOR_Y    = -220;   // floor plane Y
    const CEIL_Y     =  180;   // ceiling plane Y
    const GRID_Z_FAR = 6500;   // grid extends this far back
    const GRID_X_ST  =  240;   // lateral line spacing
    const GRID_Z_ST  =  190;   // depth ring spacing

    // ── Grid builder — floor or ceiling plane ────────────────────────────────
    const makeGrid = (yPos: number, opacity: number) => {
      const verts: number[] = [];
      for (let x = -RAIL_W; x <= RAIL_W; x += GRID_X_ST) {
        verts.push(x, yPos, 80,  x, yPos, -GRID_Z_FAR);
      }
      for (let z = 0; z >= -GRID_Z_FAR; z -= GRID_Z_ST) {
        verts.push(-RAIL_W, yPos, z,  RAIL_W, yPos, z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const mat = new THREE.LineBasicMaterial({ color: lineCol(), transparent: true, opacity, depthWrite: false });
      return { mesh: new THREE.LineSegments(geo, mat), mat };
    };

    const { mesh: floorMesh, mat: floorMat } = makeGrid(FLOOR_Y, 0.055);
    const { mesh: ceilMesh,  mat: ceilMat  } = makeGrid(CEIL_Y,  0.038);
    scene.add(floorMesh, ceilMesh);

    // ── Wall rails — left and right vertical planes ──────────────────────────
    const makeWall = (xPos: number) => {
      const verts: number[] = [];
      for (let y = FLOOR_Y; y <= CEIL_Y; y += 100) {
        verts.push(xPos, y, 80,  xPos, y, -GRID_Z_FAR);
      }
      for (let z = 0; z >= -GRID_Z_FAR; z -= GRID_Z_ST) {
        verts.push(xPos, FLOOR_Y, z,  xPos, CEIL_Y, z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const mat = new THREE.LineBasicMaterial({ color: lineCol(), transparent: true, opacity: 0.028, depthWrite: false });
      return { mesh: new THREE.LineSegments(geo, mat), mat };
    };

    const { mesh: leftWall,  mat: leftMat  } = makeWall(-RAIL_W);
    const { mesh: rightWall, mat: rightMat } = makeWall( RAIL_W);
    scene.add(leftWall, rightWall);

    // ── Section gate frames — one per section boundary ───────────────────────
    const GATE_N  = 7;
    const GATE_W  = RAIL_W * 2.3;
    const GATE_H  = (CEIL_Y - FLOOR_Y) * 1.28;
    const midY    = (FLOOR_Y + CEIL_Y) / 2;

    type GateEntry = { mesh: THREE.LineSegments; mat: THREE.LineBasicMaterial; z: number };
    const gates: GateEntry[] = [];

    for (let g = 0; g < GATE_N; g++) {
      const z  = -((g + 1) * TUNNEL_Z / (GATE_N + 1));
      const hw = GATE_W / 2, hh = GATE_H / 2;
      const v  = [
        -hw, midY-hh, z,   hw, midY-hh, z,
         hw, midY-hh, z,   hw, midY+hh, z,
         hw, midY+hh, z,  -hw, midY+hh, z,
        -hw, midY+hh, z,  -hw, midY-hh, z,
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      const mat = new THREE.LineBasicMaterial({ color: lineCol(), transparent: true, opacity: 0.09, depthWrite: false });
      const mesh = new THREE.LineSegments(geo, mat);
      scene.add(mesh);
      gates.push({ mesh, mat, z });
    }

    // ── Speed streaks — flash on section beat change ─────────────────────────
    const STREAK_N = 16;
    const streakBuf = new Float32Array(STREAK_N * 6);
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.Float32BufferAttribute(streakBuf, 3));
    streakGeo.setDrawRange(0, 0);
    const streakMat = new THREE.LineBasicMaterial({ color: lineCol(), transparent: true, opacity: 0, depthWrite: false });
    scene.add(new THREE.LineSegments(streakGeo, streakMat));

    // ── Camera state ─────────────────────────────────────────────────────────
    let mNX = 0, mNY = 0, smX = 0, smY = 0;
    let camZ = 50, camZVel = 0, camX = 0;
    let time = 0, pulseStart = -10;
    const PULSE_DUR = 0.52;

    (window as any).__beatPulse = () => { pulseStart = time; };

    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    let lastRender = 0;
    const FRAME_MS = 1000 / 30;

    const animate = (now: number) => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);
      if (now - lastRender < FRAME_MS) return;
      lastRender = now;
      time += 0.014;

      smX += (mNX - smX) * 0.042;
      smY += (mNY - smY) * 0.042;

      const rawF = (window as any).__journeyProgress?.() ?? 0;

      // Beat pulse: Z velocity burst — camera lunges forward on section change
      const pElapsed = time - pulseStart;
      if (pElapsed < PULSE_DUR) {
        camZVel += Math.pow(1 - pElapsed / PULSE_DUR, 2.4) * 4.5;
      }
      camZVel *= 0.84;

      // Portfolio (beats 3-5, rawF 3/7→6/7): camera slides X to mirror card track.
      // Z is locked at portfolio entry depth — no forward movement during card swipes.
      const PORT_START  = 3 / 7;
      const PORT_END    = 6 / 7;
      const PORT_X_SPAN = 480;

      let targetZ    = -(rawF * TUNNEL_Z * 0.97) + 50;
      let targetCamX = smX * 42;

      if (rawF >= PORT_START && rawF <= PORT_END) {
        targetZ = -(PORT_START * TUNNEL_Z * 0.97) + 50;
        const portFrac = (rawF - PORT_START) / (PORT_END - PORT_START);
        targetCamX = smX * 42 - portFrac * PORT_X_SPAN;
      }

      camZ += (targetZ - camZ) * 0.044 + camZVel * 0.48;
      camX += (targetCamX - camX) * 0.055;

      // Camera: Z tunnel + portfolio X slide + mouse parallax + gentle organic breathe
      camera.position.set(
        camX,
        -45 + smY * 22 + Math.sin(time * 0.30) * 5,
        camZ,
      );
      camera.lookAt(camX * 0.55, -88 + smY * 10, camZ - 750);
      camera.up.set(smX * 0.03, 1, 0).normalize();

      // Gate glow: approach glow in Z tunnel; during portfolio: all gates subtle
      const inPort = rawF >= PORT_START && rawF <= PORT_END;
      for (const { mat, z } of gates) {
        if (inPort) {
          mat.opacity = 0.06;
        } else {
          const dz   = Math.abs(camZ - z);
          const prox = Math.max(0, 1 - dz / 380);
          mat.opacity = 0.07 + prox * 0.34;
        }
      }

      // Speed streaks: Z-transition = forward horizontal streaks,
      // Portfolio = vertical streaks (matching the lateral X slide direction)
      if (pElapsed < PULSE_DUR * 1.5) {
        const str = Math.max(0, 1 - pElapsed / (PULSE_DUR * 1.5));
        streakMat.opacity = str * 0.26;
        streakGeo.setDrawRange(0, STREAK_N * 2);
        const sb = streakGeo.attributes['position'].array as Float32Array;
        for (let i = 0; i < STREAK_N; i++) {
          const z  = camZ - 60 - Math.random() * 520;
          if (inPort) {
            // Vertical streaks — reinforce lateral X movement
            const x  = camX + (Math.random() - 0.5) * GATE_W;
            const y0 = FLOOR_Y + Math.random() * (CEIL_Y - FLOOR_Y);
            const dy = (40 + Math.random() * 140) * (Math.random() > 0.5 ? 1 : -1);
            sb[i*6]   = x; sb[i*6+1] = y0;    sb[i*6+2] = z;
            sb[i*6+3] = x; sb[i*6+4] = y0+dy; sb[i*6+5] = z;
          } else {
            // Horizontal streaks — forward Z transition
            const y  = FLOOR_Y + Math.random() * (CEIL_Y - FLOOR_Y);
            const x0 = camX + (Math.random() - 0.5) * GATE_W;
            const dx = (60 + Math.random() * 180) * (Math.random() > 0.5 ? 1 : -1);
            sb[i*6]   = x0;    sb[i*6+1] = y; sb[i*6+2] = z;
            sb[i*6+3] = x0+dx; sb[i*6+4] = y; sb[i*6+5] = z;
          }
        }
        (streakGeo.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;
      } else {
        streakMat.opacity = 0;
        streakGeo.setDrawRange(0, 0);
      }

      renderer.render(scene, camera);
    };

    const updateThemeColors = () => {
      const col = lineCol();
      const fog = fogColStr();
      floorMat.color.copy(col);  ceilMat.color.copy(col);
      leftMat.color.copy(col);   rightMat.color.copy(col);
      streakMat.color.copy(col);
      gates.forEach(({ mat }) => mat.color.copy(col));
      (scene.fog as THREE.FogExp2).color.set(fog);
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const onVis = () => { if (!document.hidden && this.animId === 0) animate(performance.now()); };

    window.addEventListener('mousemove',    onMouseMove);
    window.addEventListener('resize',       onResize);
    window.addEventListener('themeChange',  updateThemeColors);
    document.addEventListener('visibilitychange', onVis);
    animate(performance.now());

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('resize',      onResize);
      window.removeEventListener('themeChange', updateThemeColors);
      document.removeEventListener('visibilitychange', onVis);
      delete (window as any).__beatPulse;
      renderer.dispose();
      [floorMesh, ceilMesh, leftWall, rightWall].forEach(m => {
        m.geometry.dispose(); (m.material as THREE.Material).dispose();
      });
      gates.forEach(({ mesh, mat }) => { mesh.geometry.dispose(); mat.dispose(); });
      streakGeo.dispose(); streakMat.dispose();
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
