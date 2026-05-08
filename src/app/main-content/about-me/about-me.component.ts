import { Component, inject, AfterViewInit, ElementRef, OnDestroy, NgZone } from '@angular/core';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import gsap from 'gsap';
import * as THREE from 'three';

@Component({
  selector: 'app-about-me',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './about-me.component.html',
  styleUrl: './about-me.component.scss'
})
export class AboutMeComponent implements AfterViewInit, OnDestroy {
  translate = inject(TranslationService);
  private el = inject(ElementRef);
  private zone = inject(NgZone);
  private ctx?: gsap.Context;
  private aboutCleanup?: () => void;

  ngAfterViewInit() {
    this.ctx = gsap.context(() => {
      const trigger = { trigger: '.about-content', start: 'top 82%', toggleActions: 'play none none none' };

      gsap.from('.about-content h1', { opacity: 0, y: 70, duration: 1.0, ease: 'power4.out', scrollTrigger: trigger });
      gsap.from('.about-content > div > p', { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out', scrollTrigger: trigger, delay: 0.2 });
      gsap.from('.about-trait', { opacity: 0, x: -28, duration: 0.65, stagger: 0.14, ease: 'power3.out', scrollTrigger: trigger, delay: 0.38 });
      gsap.from('.about-canvas', {
        opacity: 0, x: 70, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '.about-canvas', start: 'top 82%', toggleActions: 'play none none none' }
      });
    }, this.el.nativeElement);

    this.zone.runOutsideAngular(() => this.initAboutCanvas());
  }

  private initAboutCanvas() {
    const canvas = this.el.nativeElement.querySelector('.about-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const w = canvas.clientWidth || 450;
    const h = canvas.clientHeight || 450;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    camera.position.z = 260;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const makeEdges = (geo: THREE.BufferGeometry, opacity: number) => {
      const edges = new THREE.EdgesGeometry(geo);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity });
      const mesh = new THREE.LineSegments(edges, mat);
      geo.dispose();
      return { mesh, edges, mat };
    };

    const { mesh: outer, edges: outerE, mat: outerM } = makeEdges(new THREE.IcosahedronGeometry(72, 1), 0.22);
    const { mesh: inner, edges: innerE, mat: innerM } = makeEdges(new THREE.OctahedronGeometry(38, 0), 0.14);
    scene.add(outer, inner);

    // Rainbow orbiting particles
    const pCount = 90;
    const pPos = new Float32Array(pCount * 3);
    const pCol = new Float32Array(pCount * 3);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pCount; i++) {
      const r = 100 + Math.random() * 72;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
      tmpColor.setHSL(i / pCount, 0.78, 0.68);
      pCol[i * 3] = tmpColor.r; pCol[i * 3 + 1] = tmpColor.g; pCol[i * 3 + 2] = tmpColor.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ vertexColors: true, size: 2.6, transparent: true, opacity: 0.78, sizeAttenuation: false });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = Date.now() * 0.001;
      outer.rotation.x += 0.0028; outer.rotation.y += 0.0042;
      inner.rotation.x -= 0.0034; inner.rotation.z += 0.0026;
      points.rotation.y += 0.0018; points.rotation.x += 0.0010;
      outerM.color.setHSL((t * 0.055) % 1, 0.58, 0.70);
      innerM.color.setHSL((t * 0.055 + 0.33) % 1, 0.58, 0.62);
      renderer.render(scene, camera);
    };
    animate();

    this.aboutCleanup = () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      outerE.dispose(); outerM.dispose();
      innerE.dispose(); innerM.dispose();
      pGeo.dispose(); pMat.dispose();
    };
  }

  ngOnDestroy() {
    this.ctx?.revert();
    this.aboutCleanup?.();
  }
}
