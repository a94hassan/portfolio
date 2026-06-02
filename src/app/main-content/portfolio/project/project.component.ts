import { Component, inject, AfterViewInit, OnDestroy, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { ProjectsService } from '../../../shared/services/projects.service';
import { CommonModule } from '@angular/common';
import { TranslationService } from './../../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent implements AfterViewInit, OnDestroy {
  @Input() projectIndex?: number;

  projectsService = inject(ProjectsService);
  translate       = inject(TranslationService);
  private el      = inject(ElementRef);
  private cdr     = inject(ChangeDetectorRef);

  activeIndex = 0;

  // Each card transition = 100svh of scroll space
  get scrollHeight(): string {
    const n = this.projectsService.projects.length;
    return `${n * 100 + 20}svh`;
  }

  private tiltCleanups: (() => void)[] = [];
  private st?: ScrollTrigger;

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      if (this.projectIndex === undefined) {
        this.initHorizontalCarousel();
      }
      this.initCardTilt();
    });
  }

  // ── Horizontal carousel ──────────────────────────────────────────────────────
  // Desktop: cards sit in a flex track that GSAP slides left on scroll.
  // Active card: scale 1, opacity 1 — adjacent cards: scale 0.92, opacity ~0.42.
  // Snap ensures the track always rests with a card centered.

  private initHorizontalCarousel() {
    const scroll = this.el.nativeElement.querySelector('.portfolio-scroll') as HTMLElement;
    const sticky = this.el.nativeElement.querySelector('.portfolio-sticky') as HTMLElement;
    const track  = this.el.nativeElement.querySelector('.cards-track') as HTMLElement;
    const cards  = Array.from(track.querySelectorAll('.project-card')) as HTMLElement[];
    const N      = cards.length;
    if (!scroll || !sticky || !track || N < 1) return;

    if (window.innerWidth > 768) {
      const W      = sticky.clientWidth;
      const H      = sticky.clientHeight;
      const CARD_W = Math.round(W * 0.82);
      const CARD_H = Math.round(H * 0.82);
      const INIT_X = Math.round((W - CARD_W) / 2);

      gsap.set(cards, { width: CARD_W, height: CARD_H });
      gsap.set(track, { x: INIT_X });
      gsap.set(cards[0], { scale: 1, opacity: 1 });
      if (N > 1) gsap.set(cards.slice(1), { scale: 0.90, opacity: 0.42 });

      window.__updateProjectSlide = (progress: number) => {
        const exactIdx = progress * (N - 1);
        cards.forEach((card, i) => {
          const dist    = Math.abs(i - exactIdx);
          const scale   = 1 - Math.min(1, dist) * 0.08;
          const opacity = 1 - Math.min(1, dist) * 0.58;
          gsap.set(card, { scale, opacity });
        });
        const idx = Math.min(N - 1, Math.round(exactIdx));
        if (idx !== this.activeIndex) {
          this.activeIndex = idx;
          this.cdr.detectChanges();
          window.__beatPulse?.();
        }
      };
      return;
    }

    if (window.innerWidth <= 768 || !window.matchMedia('(hover: hover)').matches) return;

    const W      = sticky.clientWidth;
    const H      = sticky.clientHeight;
    const CARD_W = Math.round(W * 0.82);
    const CARD_H = Math.round(H * 0.82);
    const GAP    = parseFloat(getComputedStyle(track).columnGap) || Math.round(W * 0.04);
    const STEP   = CARD_W + GAP;
    const INIT_X = Math.round((W - CARD_W) / 2);

    gsap.set(cards, { width: CARD_W, height: CARD_H });
    gsap.set(track, { x: INIT_X });

    gsap.set(cards[0], { scale: 1, opacity: 1 });
    if (N > 1) gsap.set(cards.slice(1), { scale: 0.90, opacity: 0.42 });

    const tl = gsap.timeline({ paused: true });
    tl.to(track, { x: INIT_X - (N - 1) * STEP, ease: 'none', duration: N - 1 });

    this.st = ScrollTrigger.create({
      trigger:   scroll,
      start:     'top top',
      end:       'bottom bottom',
      scrub:     0.8,
      animation: tl,
      snap: N > 1 ? {
        snapTo:   1 / (N - 1),
        duration: { min: 0.3, max: 0.55 },
        delay:    0.06,
        ease:     'power2.inOut',
      } : undefined,
      onUpdate: (self) => {
        const exactIdx = self.progress * (N - 1);
        cards.forEach((card, i) => {
          const dist    = Math.abs(i - exactIdx);
          const scale   = 1 - Math.min(1, dist) * 0.08;
          const opacity = 1 - Math.min(1, dist) * 0.58;
          gsap.set(card, { scale, opacity });
        });
        const idx = Math.min(N - 1, Math.round(exactIdx));
        if (idx !== this.activeIndex) {
          this.activeIndex = idx;
          this.cdr.detectChanges();
          window.__beatPulse?.();
        }
      },
    });
  }

  navigate(dir: -1 | 1) {
    const N      = this.projectsService.projects.length;
    const newIdx = Math.max(0, Math.min(N - 1, this.activeIndex + dir));
    if (newIdx === this.activeIndex) return;

    if (window.innerWidth > 768) {
      const wh = window.innerHeight;
      const targetScroll = wh * (3 + newIdx);
      const lenis = window.__lenis;
      if (lenis) {
        lenis.scrollTo(targetScroll, { duration: 0.75, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
      } else {
        gsap.to(window, { scrollTo: targetScroll, duration: 0.75, ease: 'power3.inOut' });
      }
    } else if (this.st) {
      const { start, end } = this.st;
      const targetScroll   = start + (newIdx / Math.max(1, N - 1)) * (end - start);

      const lenis = window.__lenis;
      if (lenis) {
        lenis.scrollTo(targetScroll, { duration: 0.75, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
      } else {
        gsap.to(window, { scrollTo: targetScroll, duration: 0.75, ease: 'power3.inOut' });
      }
    }
  }

  // ── Card tilt ────────────────────────────────────────────────────────────────
  private initCardTilt() {
    if (window.innerWidth <= 768 || !window.matchMedia('(hover: hover)').matches) return;

    const cards = Array.from(this.el.nativeElement.querySelectorAll('.project-card')) as HTMLElement[];
    cards.forEach(card => {
      gsap.set(card, { transformPerspective: 1200 });

      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        gsap.to(card, {
          rotateX: -y * 4, rotateY: x * 4,
          ease: 'power2.out', duration: 0.35, overwrite: 'auto',
        });
      };
      const onLeave = () => gsap.to(card, {
        rotateX: 0, rotateY: 0,
        ease: 'elastic.out(1, 0.5)', duration: 0.7, overwrite: 'auto',
      });

      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      this.tiltCleanups.push(() => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
      });
    });
  }

  ngOnDestroy() {
    this.st?.kill();
    this.tiltCleanups.forEach(fn => fn());
  }
}
