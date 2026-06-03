import { Component, OnInit, OnDestroy, NgZone, inject, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { CinematicCanvasComponent } from './shared/components/cinematic-canvas/cinematic-canvas.component';
import { ThemeService } from './shared/services/theme.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import type * as THREE from 'three';
import Lenis from 'lenis';
import { AiChatComponent } from './shared/components/ai-chat/ai-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, AiChatComponent, CinematicCanvasComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'portfolio';
  private zone         = inject(NgZone);
  private themeService = inject(ThemeService);
  private animId       = 0;
  private lenis?: Lenis;
  private threeCleanup?:    () => void;
  private cursorCleanup?:   () => void;
  private feedbackCleanup?: () => void;
  private scrollCleanup?:   () => void;

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion) {
          if (!this.isMobile) this.initGlobalThreeJS();
          this.initLenis();
        }
        this.initCustomCursor();
        if (!this.isMobile && !reducedMotion) {
          this.initButtonFeedback();
        }
        this.initScrollSystem();
      });
    });
  }

  ngOnInit() {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
    this.themeService.init();

    // Header entrance
    gsap.set('app-header', { y: -72, opacity: 0 });
    gsap.to('app-header',  { y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', delay: 0.2 });
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
      duration:           1.2,
      easing:             (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation:        'vertical',
      gestureOrientation: 'vertical',
      smoothWheel:        true,
      wheelMultiplier:    0.9,
      touchMultiplier:    2.0,
      infinite:           false,
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
    // Three.js camera progress: normalize window.scrollY to [0, 1]
    window.__journeyProgress = () => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      return maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0;
    };

    // ── Section link navigation ──────────────────────────────────────────────
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();

      let top = 0;
      if (window.innerWidth > 768) {
        const wh = window.innerHeight;
        if (id === 'about_me_section') {
          top = wh;
        } else if (id === 'my_skills_section') {
          top = wh * 2;
        } else if (id === 'portfolio_section') {
          top = wh * 3;
        } else if (id === 'contact_section') {
          top = wh * 6;
        } else {
          top = 0;
        }
      } else {
        const headerH = 80;
        top = target.getBoundingClientRect().top + window.scrollY - headerH;
      }

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

    this.scheduleLoaderHide(120);
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
  // THREE.JS — Stellar nebula: open particle field with mouse force + scroll drift
  // ════════════════════════════════════════════════════════════════════════════

  private async initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const THREE = await import('three');
    const { CSS3DRenderer, CSS3DObject } = await import('three/examples/jsm/renderers/CSS3DRenderer.js');

    const cssContainer = document.querySelector('#css3d-container') as HTMLElement;
    if (!cssContainer) return;

    let w = window.innerWidth, h = window.innerHeight;
    const isLight = () => document.documentElement.classList.contains('light');
    const bgColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      return v || (isLight() ? '#ffffff' : '#050505');
    };

    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(new THREE.Color(bgColor()).getHex(), 0.00035);
    const camera = new THREE.PerspectiveCamera(60, w / h, 120, 5000);
    camera.position.set(0, 0, 750);

    // Add Lights for 3D meshes (Refined & Minimalist)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.35);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.40, 1500);
    pointLight.position.set(0, 200, 400);
    scene.add(pointLight);

    // 1. WebGL Renderer (Stardust Nebula)
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. CSS3D Renderer (HTML Panels)
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(w, h);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.left = '0';
    cssRenderer.domElement.style.width = '100%';
    cssRenderer.domElement.style.height = '100%';
    cssRenderer.domElement.style.pointerEvents = 'none';
    cssContainer.appendChild(cssRenderer.domElement);

    // High-end soft-glow sprite for stardust
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const sctx = sc.getContext('2d')!;
    const sg = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0,    'rgba(255,255,255,1.0)');
    sg.addColorStop(0.20, 'rgba(255,255,255,0.85)');
    sg.addColorStop(0.50, 'rgba(255,255,255,0.25)');
    sg.addColorStop(0.80, 'rgba(255,255,255,0.05)');
    sg.addColorStop(1,    'rgba(255,255,255,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(sc);

    // Volumetric 3D Starfield - 180 particles spanning the entire hallway (reduced for clean minimalism)
    const N = 180;
    const buf = new Float32Array(N * 3);
    const origBuf = new Float32Array(N * 3);
    const phase = new Float32Array(N);
    const speed = new Float32Array(N);
    const colors = new Float32Array(N * 3);

    const color1 = new THREE.Color(isLight() ? 0x8a8884 : 0xa6a8ac); // silver-grey
    const color2 = new THREE.Color(isLight() ? 0x5c5a56 : 0xffffff); // white/dark-grey

    for (let i = 0; i < N; i++) {
      const rx = (Math.random() - 0.5) * 2000;
      const ry = (Math.random() - 0.5) * 1200;
      const rz = Math.random() * -3300 + 800;

      buf[i * 3]     = rx;
      buf[i * 3 + 1] = ry;
      buf[i * 3 + 2] = rz;

      origBuf[i * 3]     = rx;
      origBuf[i * 3 + 1] = ry;
      origBuf[i * 3 + 2] = rz;

      phase[i] = Math.random() * Math.PI * 2;
      speed[i] = 10 + Math.random() * 25;

      // Color interpolation: mix 65% silver and 35% white/dark-grey for monochrome nebula
      const t = Math.random();
      const mixedColor = new THREE.Color().copy(color1).lerp(color2, t * 0.35);
      colors[i * 3]     = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      map:             sprite,
      vertexColors:    true,
      size:            1.2,
      sizeAttenuation: true,
      transparent:     true,
      opacity:         isLight() ? 0.08 : 0.14,
      depthWrite:      false,
      blending:        isLight() ? THREE.NormalBlending : THREE.AdditiveBlending,
      alphaTest:       0.001,
    });
    scene.add(new THREE.Points(geo, mat));

    // ════════════════════════════════════════════════════════════════════════════
    // FLOATING 3D MESHES (HERO & ABOUT ME)
    // ════════════════════════════════════════════════════════════════════════════

    // Glass Crystal Torus Knot for Hero
    const heroGeom = new THREE.TorusKnotGeometry(48, 14, 128, 16);
    const heroMat = new THREE.MeshPhysicalMaterial(
      isLight() ? {
        color:        0x7a736b,
        metalness:    0.1,
        roughness:    0.2,
        transmission: 0.95,
        thickness:    1.5,
        transparent:  true,
        opacity:      0.18,
        side:         THREE.DoubleSide
      } : {
        color:        0xffffff, // pearlescent white
        metalness:    0.95,
        roughness:    0.05,
        transmission: 0.95,
        thickness:    2.0,
        emissive:     new THREE.Color(0x111111), // clean silver glow
        transparent:  true,
        opacity:      0.18,
        side:         THREE.DoubleSide
      }
    );
    const heroMesh = new THREE.Mesh(heroGeom, heroMat);
    heroMesh.position.set(380, 110, 350);
    scene.add(heroMesh);

    // Icosahedron for About Me
    const aboutGeom = new THREE.IcosahedronGeometry(55, 1);
    const aboutMat = new THREE.MeshPhysicalMaterial(
      isLight() ? {
        color:        0x8a8884,
        metalness:    0.1,
        roughness:    0.25,
        transmission: 0.95,
        thickness:    1.5,
        transparent:  true,
        opacity:      0.18,
        side:         THREE.DoubleSide
      } : {
        color:        0xffffff,
        metalness:    0.9,
        roughness:    0.08,
        transmission: 0.95,
        thickness:    1.5,
        emissive:     new THREE.Color(0x111111),
        transparent:  true,
        opacity:      0.18,
        side:         THREE.DoubleSide
      }
    );
    const aboutMesh = new THREE.Mesh(aboutGeom, aboutMat);
    aboutMesh.position.set(-340, -120, -150);
    scene.add(aboutMesh);

    // ════════════════════════════════════════════════════════════════════════════
    // 3D SPATIAL EXHIBIT STATION COORDINATES
    // ════════════════════════════════════════════════════════════════════════════

    const p1 = new THREE.Vector3(0, 0, 1200);
    const p2 = new THREE.Vector3(0, 0, 400);
    const p3 = new THREE.Vector3(0, 0, -400);
    const p4 = new THREE.Vector3(0, 0, -1200);
    const pProject0 = new THREE.Vector3(-550, 0, -2000);
    const pProject1 = new THREE.Vector3(550, 0, -2800);
    const pProject2 = new THREE.Vector3(-550, 0, -3600);
    const p5 = new THREE.Vector3(0, 50, -4400);
    const pFooter = new THREE.Vector3(0, -600, -4400);

    const r1 = new THREE.Euler(0, 0, 0);
    const r2 = new THREE.Euler(0, 0, 0);
    const r3 = new THREE.Euler(0, 0, 0);
    const r4 = new THREE.Euler(0, 0, 0);
    const rProject0 = new THREE.Euler(0, Math.PI / 8, 0);
    const rProject1 = new THREE.Euler(0, -Math.PI / 8, 0);
    const rProject2 = new THREE.Euler(0, Math.PI / 8, 0);
    const r5 = new THREE.Euler(0, 0, 0);
    const rFooter = new THREE.Euler(0, 0, 0);

    const createC3D = (id: string, pos: THREE.Vector3, rot: THREE.Euler, scale = 0.35) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obj = new CSS3DObject(el);
      obj.position.copy(pos);
      obj.rotation.copy(rot);
      obj.scale.set(scale, scale, scale);
      scene.add(obj);
      return obj;
    };

    createC3D('c3d-above-the-fold', p1, r1);
    createC3D('c3d-about-me', p2, r2);
    createC3D('c3d-my-skills', p3, r3);
    const c3dIntro = createC3D('c3d-portfolio-intro', p4, r4);
    
    // Individual project cards as separate exhibits
    const c3dProj0 = createC3D('c3d-project-0', pProject0, rProject0);
    const c3dProj1 = createC3D('c3d-project-1', pProject1, rProject1);
    const c3dProj2 = createC3D('c3d-project-2', pProject2, rProject2);
    
    createC3D('c3d-contact', p5, r5);
    createC3D('c3d-footer', pFooter, rFooter);

    // ════════════════════════════════════════════════════════════════════════════
    // DYNAMIC FLIGHT HALLWAY SPLINES
    // ════════════════════════════════════════════════════════════════════════════

    const cameraPoints = [
      new THREE.Vector3(0, 0, 1600),          // Hero camera
      new THREE.Vector3(0, 0, 800),           // About Me camera
      new THREE.Vector3(0, 0, 0),             // My Skills camera
      new THREE.Vector3(0, 0, -800),          // Portfolio Intro camera
      new THREE.Vector3(-150, 0, -1600),      // Project 1 Exhibit pass
      new THREE.Vector3(150, 0, -2400),       // Project 2 Exhibit pass
      new THREE.Vector3(-150, 0, -3200),      // Project 3 Exhibit pass
      new THREE.Vector3(0, 50, -4000),        // Contact camera
    ];
    const cameraSpline = new THREE.CatmullRomCurve3(cameraPoints);

    const targetPoints = [
      new THREE.Vector3(0, 0, 1200),          // Look at Hero
      new THREE.Vector3(0, 0, 400),           // Look at About Me
      new THREE.Vector3(0, 0, -400),          // Look at Skills
      new THREE.Vector3(0, 0, -1200),         // Look at Portfolio Intro
      new THREE.Vector3(-550, 0, -2000),      // Look left at Project 1
      new THREE.Vector3(550, 0, -2800),       // Look right at Project 2
      new THREE.Vector3(-550, 0, -3600),      // Look left at Project 3
      new THREE.Vector3(0, 50, -4400),        // Look at Contact
    ];
    const targetSpline = new THREE.CatmullRomCurve3(targetPoints);

    // ════════════════════════════════════════════════════════════════════════════
    // CLICK ZOOM INTERACTIVITY
    // ════════════════════════════════════════════════════════════════════════════

    let zoomedIndex = -1;
    const targetZoomPos = new THREE.Vector3();
    const targetZoomLookAt = new THREE.Vector3();

    const zoomToProject = (idx: number, pos: THREE.Vector3, rot: THREE.Euler) => {
      if (zoomedIndex === idx) {
        zoomedIndex = -1;
      } else {
        zoomedIndex = idx;
        // Position camera directly in front of the card based on rotation
        const offsetDist = 380;
        const offsetX = Math.sin(rot.y) * offsetDist;
        const offsetZ = Math.cos(rot.y) * offsetDist;
        
        targetZoomPos.set(pos.x + offsetX, pos.y, pos.z + offsetZ);
        targetZoomLookAt.copy(pos);
        window.__beatPulse?.();
      }
    };

    const setupClickZoom = (id: string, idx: number, pos: THREE.Vector3, rot: THREE.Euler) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Only zoom if they didn't click a link or button directly
        if (target.closest('a, button, input, textarea')) return;
        
        this.zone.run(() => {
          zoomToProject(idx, pos, rot);
        });
      });
    };

    setupClickZoom('c3d-project-0', 0, pProject0, rProject0);
    setupClickZoom('c3d-project-1', 1, pProject1, rProject1);
    setupClickZoom('c3d-project-2', 2, pProject2, rProject2);

    // Scroll releases zoom immediately
    const onScrollResetZoom = () => {
      if (zoomedIndex !== -1) {
        this.zone.run(() => { zoomedIndex = -1; });
      }
    };
    window.addEventListener('scroll', onScrollResetZoom, { passive: true });

    let mNX = 0, mNY = 0, smX = 0, smY = 0;
    let camX = 0, camY = 0, camZ = 750;
    let time = 0, lastFrameTime = performance.now();

    let beatTime = -10;
    window.__beatPulse = () => {
      beatTime = time;
    };

    const onMouseMove = (e: MouseEvent) => {
      mNX = (e.clientX / w - 0.5) * 2;
      mNY = -((e.clientY / h) - 0.5) * 2;
    };

    // Helper for distance-based card fading
    const updateCardFade = (obj: any, pos: THREE.Vector3, range = 500) => {
      if (!obj || !obj.element) return;
      const el = obj.element;
      const distZ = Math.abs(camera.position.z - pos.z);
      
      let opacity = 0;
      if (distZ < range) {
        const rawOpacity = 1 - (distZ / range);
        opacity = Math.sin(rawOpacity * Math.PI / 2); // smooth ease
      }

      el.style.opacity = opacity.toFixed(3);
      if (opacity < 0.05) {
        el.style.pointerEvents = 'none';
        el.style.visibility = 'hidden';
      } else {
        el.style.pointerEvents = 'auto';
        el.style.visibility = 'visible';
      }
    };

    const animate = (now: number) => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      time += dt;

      const mLerp = 1 - Math.exp(-5 * dt);
      const zLerp = 1 - Math.exp((zoomedIndex !== -1 ? -6 : -3.5) * dt);
      
      smX += (mNX - smX) * mLerp;
      smY += (mNY - smY) * mLerp;

      const rawF = window.__journeyProgress?.() ?? 0;
      
      // Update mid-flight pointer states
      const cssContainerEl = document.getElementById('css3d-container');
      if (cssContainerEl) {
        const stations = [0, 0.143, 0.286, 0.429, 1.0];
        const isAtStation = stations.some(s => Math.abs(rawF - s) < 0.025);
        // During the projects flight, pointer events are allowed since cards fade dynamically
        const isProjectRange = rawF > 0.429 && rawF < 0.90;
        if (isAtStation || isProjectRange || zoomedIndex !== -1) {
          cssContainerEl.classList.remove('mid-flight');
        } else {
          cssContainerEl.classList.add('mid-flight');
        }
      }

      // Camera coordinates target interpolation (support Zoom and Hallway flyby)
      const targetPos = new THREE.Vector3();
      const targetLook = new THREE.Vector3();

      if (zoomedIndex !== -1) {
        targetPos.copy(targetZoomPos);
        targetLook.copy(targetZoomLookAt);
      } else {
        targetPos.copy(cameraSpline.getPointAt(rawF));
        targetLook.copy(targetSpline.getPointAt(rawF));
      }

      camX += (targetPos.x - camX) * zLerp;
      camY += (targetPos.y - camY) * zLerp;
      camZ += (targetPos.z - camZ) * zLerp;

      camera.position.set(
        camX + smX * 45,
        camY + smY * 35,
        camZ,
      );
      camera.lookAt(
        targetLook.x + smX * 15,
        targetLook.y,
        targetLook.z
      );

      // Rotate and float 3D Meshes
      if (heroMesh) {
        heroMesh.rotation.x += 0.006;
        heroMesh.rotation.y += 0.009;
        heroMesh.position.y = 110 + Math.sin(time * 0.9) * 14;
      }
      if (aboutMesh) {
        aboutMesh.rotation.x += 0.004;
        aboutMesh.rotation.y += 0.007;
        aboutMesh.position.y = -120 + Math.cos(time * 0.75) * 10;
      }

      // Dynamically fade CSS3D project and intro cards based on proximity (adjusted for expanded layout)
      updateCardFade(c3dIntro, p4, 900);
      updateCardFade(c3dProj0, pProject0, 1100);
      updateCardFade(c3dProj1, pProject1, 1100);
      updateCardFade(c3dProj2, pProject2, 1100);

      // Interactive volumetric stardust flow field drift, mouse repulsion & restoring spring
      const influenceX = smX * 300 + camera.position.x;
      const influenceY = smY * 200 + camera.position.y;
      const influenceZ = camera.position.z - 250; 

      const bAge   = time - beatTime;
      const rippleAmp = bAge < 1.8 ? Math.sin((1 - bAge / 1.8) * Math.PI) * Math.exp(-bAge * 1.6) * 75 : 0;

      const pos = geo.attributes['position'].array as Float32Array;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        const px = pos[i3];
        const py = pos[i3 + 1];
        const pz = pos[i3 + 2];

        const ox = origBuf[i3];
        const oy = origBuf[i3 + 1];
        const oz = origBuf[i3 + 2];

        // 1. Organic multi-octave flow field drift
        pos[i3]     += (Math.sin(time * 0.15 + phase[i]) * 0.35 + Math.cos(time * 0.45 + phase[i] * 1.5) * 0.12) * dt * 30;
        pos[i3 + 1] += (Math.cos(time * 0.18 + phase[i]) * 0.35 + Math.sin(time * 0.35 + phase[i] * 2.0) * 0.12) * dt * 30;
        pos[i3 + 2] += (Math.sin(time * 0.10 + phase[i] * 2.5) * 0.25) * dt * 30;

        // 2. Spring restoring force to origin
        pos[i3]     += (ox - px) * 0.065 * dt;
        pos[i3 + 1] += (oy - py) * 0.065 * dt;
        pos[i3 + 2] += (oz - pz) * 0.065 * dt;

        // 3. Mouse cursor repulsion force (Warp tunnel)
        const dx = px - influenceX;
        const dy = py - influenceY;
        const dz = pz - influenceZ;
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < 320) {
          const force = (1.0 - d / 320) * 22;
          pos[i3]     += (dx / d) * force * dt * 45;
          pos[i3 + 1] += (dy / d) * force * dt * 45;
          pos[i3 + 2] += (dz / d) * force * dt * 30;
        }

        // 4. Project beat pulse (ripple)
        if (rippleAmp > 0) {
          const distToCenter = Math.sqrt(px * px + pz * pz);
          const rippleSpeed = 800;
          const targetDist = bAge * rippleSpeed;
          const distDiff = Math.abs(distToCenter - targetDist);
          if (distDiff < 180) {
            const rippleForce = Math.sin((1 - distDiff / 180) * Math.PI) * rippleAmp * 0.08;
            pos[i3]     += (px / distToCenter) * rippleForce;
            pos[i3 + 2]     += (pz / distToCenter) * rippleForce;
          }
        }
      }
      (geo.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;

      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    };

    const updateThemeColors = () => {
      const isL = isLight();
      if (isL) {
        mat.color.set(0x8a8884); mat.opacity = 0.08;
        mat.blending = THREE.NormalBlending; mat.size = 1.2;

        heroMat.color.set(0x7a736b);
        heroMat.metalness = 0.1;
        heroMat.roughness = 0.2;
        heroMat.transmission = 0.95;
        heroMat.opacity = 0.18;
        heroMat.emissive.set(0x000000);

        aboutMat.color.set(0x8a8884);
        aboutMat.metalness = 0.1;
        aboutMat.roughness = 0.25;
        aboutMat.transmission = 0.95;
        aboutMat.opacity = 0.18;
        aboutMat.emissive.set(0x000000);
      } else {
        mat.color.set(0xffffff); mat.opacity = 0.14;
        mat.blending = THREE.AdditiveBlending; mat.size = 1.2;

        heroMat.color.set(0xffffff);
        heroMat.metalness = 0.95;
        heroMat.roughness = 0.05;
        heroMat.transmission = 0.95;
        heroMat.opacity = 0.18;
        heroMat.emissive.set(0x111111);

        aboutMat.color.set(0xffffff);
        aboutMat.metalness = 0.9;
        aboutMat.roughness = 0.08;
        aboutMat.transmission = 0.95;
        aboutMat.opacity = 0.18;
        aboutMat.emissive.set(0x111111);
      }
      mat.needsUpdate = true;
      heroMat.needsUpdate = true;
      aboutMat.needsUpdate = true;
      (scene.fog as THREE.FogExp2).color.set(bgColor());
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      cssRenderer.setSize(w, h);
    };
    const onVis = () => {
      if (!document.hidden && this.animId === 0) {
        lastFrameTime = performance.now();
        animate(performance.now());
      }
    };

    window.addEventListener('mousemove',   onMouseMove);
    window.addEventListener('resize',      onResize);
    window.addEventListener('themeChange', updateThemeColors);
    document.addEventListener('visibilitychange', onVis);
    animate(performance.now());

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('resize',      onResize);
      window.removeEventListener('themeChange', updateThemeColors);
      document.removeEventListener('visibilitychange', onVis);
      delete window.__beatPulse;

      // Dispose added 3D resources
      heroGeom.dispose();
      heroMat.dispose();
      aboutGeom.dispose();
      aboutMat.dispose();

      geo.dispose(); mat.dispose(); sprite.dispose(); renderer.dispose();
      cssRenderer.domElement.remove();
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
    const SEL = 'app-header,.skill-item,button,a,input,textarea';
    let spotEls: HTMLElement[] = [], rects: DOMRect[] = [];
    const refresh = () => { rects = spotEls.map(el => el.getBoundingClientRect()); };
    spotEls = Array.from(document.querySelectorAll(SEL));
    refresh();

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
    const onOut   = (e: MouseEvent) => {
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
        { scale: 2.8, opacity: 0, duration: 0.44, ease: 'power2.out',
          onComplete: () => gsap.set(ring, { scale: 1, opacity: 1 }) }
      );
    };

    window.addEventListener('mousemove',   onMove,  { passive: true });
    window.addEventListener('scroll',      refresh, { passive: true });
    window.addEventListener('resize',      refresh, { passive: true });
    document.addEventListener('mouseover',  onOver);
    document.addEventListener('mouseout',   onOut);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('click',      onClick);

    this.cursorCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll',    refresh);
      window.removeEventListener('resize',    refresh);
      document.removeEventListener('mouseover',  onOver);
      document.removeEventListener('mouseout',   onOut);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      document.removeEventListener('click',      onClick);
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
          const r  = el.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width  - 0.5) * 2;
          const py = ((e.clientY - r.top)  / r.height - 0.5) * 2;
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
    this.threeCleanup?.();
    this.cursorCleanup?.();
    this.feedbackCleanup?.();
    this.scrollCleanup?.();
    this.lenis?.destroy();
    delete window.__lenis;
    gsap.killTweensOf(window);
  }
}
