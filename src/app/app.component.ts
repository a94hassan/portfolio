import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ThemeService } from './shared/services/theme.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
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
  private lenis?: Lenis;
  private animId = 0;
  private threeCleanup?: () => void;
  private cursorCleanup?: () => void;
  private scrollY = 0;
  private scrollLimit = 1;

  ngOnInit() {
    this.themeService.init();
    gsap.registerPlugin(ScrollTrigger);

    this.lenis = new Lenis();
    this.lenis.on('scroll', ({ scroll, limit }: { scroll: number; limit: number }) => {
      this.scrollY = scroll;
      this.scrollLimit = limit;
    });

    gsap.ticker.add((time) => { this.lenis?.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    gsap.from('app-header', { y: -80, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });

    this.zone.runOutsideAngular(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) this.initGlobalThreeJS();
      this.initCustomCursor();
    });
  }

  private initGlobalThreeJS() {
    const canvas = document.querySelector('#global-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const isMobile = w <= 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 3000);
    camera.position.z = 600;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- Particles (fewer, slower, ambient) ---
    const COUNT = isMobile ? 50 : 80;
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 2);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * w * 1.4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * h * 1.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i * 2]     = (Math.random() - 0.5) * 0.04;
      velocities[i * 2 + 1] = (Math.random() - 0.5) * 0.04;
    }

    const colors = new Float32Array(COUNT * 3).fill(1);
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const particleMat = new THREE.PointsMaterial({
      vertexColors: true, size: 2.5, transparent: true, opacity: 0.32, sizeAttenuation: false
    });
    scene.add(new THREE.Points(particleGeo, particleMat));

    // --- Wireframe helper ---
    const makeWf = (geo: THREE.BufferGeometry, opacity: number) => {
      const edges = new THREE.EdgesGeometry(geo);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity });
      const mesh = new THREE.LineSegments(edges, mat);
      geo.dispose();
      return { mesh, edges, mat };
    };

    const dim = Math.min(w, h);
    // Camera travels from y=0 at scroll=0% to y=-VIRTUAL_H at scroll=100%
    const VIRTUAL_H = h * 3.0;

    // Large ambient shapes — oversized to bleed past viewport edges for immersive feel
    const { mesh: ico1, edges: ico1e, mat: ico1m } = makeWf(new THREE.IcosahedronGeometry(dim * 0.68, 1), 0.048);
    ico1.position.set(w * 0.54, h * 0.06, -140);
    scene.add(ico1);

    const { mesh: torus1, edges: tor1e, mat: tor1m } = makeWf(new THREE.TorusGeometry(dim * 0.50, dim * 0.10, 8, 52), 0.034);
    torus1.position.set(-w * 0.52, -VIRTUAL_H * 0.22, -260);
    scene.add(torus1);

    const { mesh: octa, edges: octae, mat: octam } = makeWf(new THREE.OctahedronGeometry(dim * 0.60, 0), 0.038);
    octa.position.set(w * 0.52, -VIRTUAL_H * 0.44, -180);
    scene.add(octa);

    const { mesh: ico2, edges: ico2e, mat: ico2m } = makeWf(new THREE.IcosahedronGeometry(dim * 0.56, 1), 0.036);
    ico2.position.set(-w * 0.50, -VIRTUAL_H * 0.66, -110);
    scene.add(ico2);

    const { mesh: torus2, edges: tor2e, mat: tor2m } = makeWf(new THREE.TorusGeometry(dim * 0.44, dim * 0.09, 8, 48), 0.034);
    torus2.position.set(w * 0.52, -VIRTUAL_H * 0.88, -220);
    scene.add(torus2);

    const meshes  = [ico1, torus1, octa, ico2, torus2];
    const baseX   = [w * 0.54, -w * 0.52, w * 0.52, -w * 0.50, w * 0.52];
    const baseY   = [h * 0.06, -VIRTUAL_H * 0.22, -VIRTUAL_H * 0.44, -VIRTUAL_H * 0.66, -VIRTUAL_H * 0.88];
    const pxStr   = [22, 18, 20, 18, 20]; // cursor parallax X strength
    const pyStr   = [ 9,  7,  9,  7,  8]; // cursor parallax Y strength
    const baseOpa = [0.048, 0.034, 0.038, 0.036, 0.034];
    const allMats = [ico1m, tor1m, octam, ico2m, tor2m];

    // --- Mouse state ---
    let mouseNX = 0;  // normalised -1..+1
    let mouseNY = 0;
    let mousePX = w / 2; // pixel coords
    let mousePY = h / 2;

    const onMouseMove = (e: MouseEvent) => {
      mouseNX = (e.clientX / w - 0.5) * 2;
      mouseNY = -((e.clientY / h) - 0.5) * 2; // up = +1
      mousePX = e.clientX;
      mousePY = e.clientY;
    };

    // World-space mouse at z=0 plane (perspective projection, camera at z=600, fov=60)
    const TAN30 = Math.tan(Math.PI / 6); // tan(30°) ≈ 0.5774
    const TILE_H = h * 1.6;
    const REPULSE_R = Math.min(w, h) * 0.14; // cursor repulsion radius in world units

    const tempColor = new THREE.Color();

    const animate = () => {
      if (document.hidden) { this.animId = 0; return; }
      this.animId = requestAnimationFrame(animate);

      // --- Camera driven by scroll (Y) and cursor (X) ---
      const scrollFrac = this.scrollLimit > 0 ? this.scrollY / this.scrollLimit : 0;
      camera.position.y += (-scrollFrac * VIRTUAL_H - camera.position.y) * 0.045;
      camera.position.x += (mouseNX * 16 - camera.position.x) * 0.030;
      const camY = camera.position.y;

      // --- World-space cursor position at z=0 ---
      const wHalfH = camera.position.z * TAN30;
      const wHalfW = wHalfH * (w / h);
      const worldMX = camera.position.x + ((mousePX / w) * 2 - 1) * wHalfW;
      const worldMY = camera.position.y - ((mousePY / h) * 2 - 1) * wHalfH;

      // --- Particles: ambient drift + cursor repulsion + tiling ---
      const pos = particleGeo.attributes['position'].array as Float32Array;
      const repRadSq = REPULSE_R * REPULSE_R;

      for (let i = 0; i < COUNT; i++) {
        const dx = pos[i * 3]     - worldMX;
        const dy = pos[i * 3 + 1] - worldMY;
        const dSq = dx * dx + dy * dy;

        if (dSq < repRadSq && dSq > 0.01) {
          const d = Math.sqrt(dSq);
          const f = (1 - d / REPULSE_R) * 0.028;
          velocities[i * 2]     += (dx / d) * f;
          velocities[i * 2 + 1] += (dy / d) * f;
        }

        // Brownian micro-drift keeps particles alive when cursor is far
        velocities[i * 2]     += (Math.random() - 0.5) * 0.0018;
        velocities[i * 2 + 1] += (Math.random() - 0.5) * 0.0018;

        velocities[i * 2]     *= 0.96;
        velocities[i * 2 + 1] *= 0.96;

        pos[i * 3]     += velocities[i * 2];
        pos[i * 3 + 1] += velocities[i * 2 + 1];

        // Wrap horizontally
        const halfW = w * 0.72;
        if (pos[i * 3] >  halfW) pos[i * 3] = -halfW;
        if (pos[i * 3] < -halfW) pos[i * 3] =  halfW;

        // Tile vertically around camera
        if (pos[i * 3 + 1] - camY >  TILE_H) pos[i * 3 + 1] -= TILE_H * 2;
        if (pos[i * 3 + 1] - camY < -TILE_H) pos[i * 3 + 1] += TILE_H * 2;
      }
      particleGeo.attributes['position'].needsUpdate = true;

      // --- Rainbow particle colors near cursor ---
      const col = particleGeo.attributes['color'].array as Float32Array;
      const colorR = REPULSE_R * 3.0;
      const timeShift = Date.now() * 0.00014;
      for (let i = 0; i < COUNT; i++) {
        const dx2 = pos[i * 3] - worldMX;
        const dy2 = pos[i * 3 + 1] - worldMY;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 < colorR) {
          const t = 1 - d2 / colorR;
          const hue = (((Math.atan2(dy2, dx2) / (Math.PI * 2)) + 0.5 + timeShift) % 1 + 1) % 1;
          tempColor.setHSL(hue, 0.90, 0.72);
          col[i * 3]     = 1 - t + tempColor.r * t;
          col[i * 3 + 1] = 1 - t + tempColor.g * t;
          col[i * 3 + 2] = 1 - t + tempColor.b * t;
        } else {
          col[i * 3] = 1; col[i * 3 + 1] = 1; col[i * 3 + 2] = 1;
        }
      }
      particleGeo.attributes['color'].needsUpdate = true;

      // --- Wireframes: very slow rotation + cursor parallax X+Y ---
      ico1.rotation.x   += 0.00040; ico1.rotation.y   += 0.00055;
      torus1.rotation.x += 0.00030; torus1.rotation.z += 0.00045;
      octa.rotation.x   += 0.00050; octa.rotation.y   += 0.00035; octa.rotation.z += 0.00025;
      ico2.rotation.y   += 0.00045; ico2.rotation.z   += 0.00030;
      torus2.rotation.y += 0.00038; torus2.rotation.x += 0.00042;

      meshes.forEach((mesh, i) => {
        mesh.position.x += (baseX[i] + mouseNX * pxStr[i] - mesh.position.x) * 0.020;
        mesh.position.y += (baseY[i] + mouseNY * pyStr[i] - mesh.position.y) * 0.020;
      });

      // --- Section proximity: wireframe brightens as its section enters view ---
      allMats.forEach((mat, i) => {
        const dist = Math.abs(camY - baseY[i]);
        const range = VIRTUAL_H * 0.15;
        mat.opacity = baseOpa[i] + Math.max(0, 1 - dist / range) * 0.055;
      });

      renderer.render(scene, camera);
    };

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const onVisibilityChange = () => { if (!document.hidden && this.animId === 0) animate(); };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    animate();

    this.threeCleanup = () => {
      cancelAnimationFrame(this.animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
      particleGeo.dispose(); particleMat.dispose();
      [ico1e, tor1e, octae, ico2e, tor2e].forEach(e => e.dispose());
      [ico1m, tor1m, octam, ico2m, tor2m].forEach(m => m.dispose());
    };
  }

  private initCustomCursor() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    const ring = document.getElementById('cursor-ring')!;
    const dot = document.getElementById('cursor-dot')!;
    if (!ring || !dot) return;

    gsap.set(ring, { xPercent: -50, yPercent: -50 });
    gsap.set(dot, { xPercent: -50, yPercent: -50 });

    let appeared = false;
    let spotElements: HTMLElement[] = [];
    let cachedRects: DOMRect[] = [];

    const SPOT_SEL = '.skill-item,.project-info,.project-img-wrap,.about-icon,.social-icon-link,form,button';

    const refreshRects = () => {
      cachedRects = spotElements.map(el => el.getBoundingClientRect());
    };

    setTimeout(() => {
      spotElements = Array.from(document.querySelectorAll(SPOT_SEL)) as HTMLElement[];
      refreshRects();
    }, 900);

    const onMove = (e: MouseEvent) => {
      if (!appeared) {
        gsap.to([ring, dot], { opacity: 1, duration: 0.4 });
        appeared = true;
      }
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.18, ease: 'power2.out' });

      for (let i = 0; i < spotElements.length; i++) {
        const r = cachedRects[i];
        if (!r) continue;
        spotElements[i].style.setProperty('--mx', `${e.clientX - r.left}px`);
        spotElements[i].style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };

    const onOver = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, input, textarea')) {
        gsap.to(ring, { scale: 1.7, borderColor: 'rgba(255,255,255,0.75)', duration: 0.22 });
      }
    };

    const onOut = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, input, textarea')) {
        gsap.to(ring, { scale: 1, borderColor: 'rgba(255,255,255,0.40)', duration: 0.22 });
      }
    };

    const onLeaveWindow = () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    const onEnterWindow = () => { if (appeared) gsap.to([ring, dot], { opacity: 1, duration: 0.3 }); };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', refreshRects, { passive: true });
    window.addEventListener('resize', refreshRects, { passive: true });
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mouseleave', onLeaveWindow);
    document.addEventListener('mouseenter', onEnterWindow);

    this.cursorCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', refreshRects);
      window.removeEventListener('resize', refreshRects);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseleave', onLeaveWindow);
      document.removeEventListener('mouseenter', onEnterWindow);
    };
  }

  ngOnDestroy() {
    this.lenis?.destroy();
    this.threeCleanup?.();
    this.cursorCleanup?.();
  }
}
