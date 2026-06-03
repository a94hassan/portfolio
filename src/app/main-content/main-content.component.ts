import { Component, OnDestroy, NgZone, inject, afterNextRender } from '@angular/core';
import { AboveTheFoldComponent } from './above-the-fold/above-the-fold.component';
import { AboutMeComponent } from './about-me/about-me.component';
import { MySkillsComponent } from './my-skills/my-skills.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { ProjectComponent } from './portfolio/project/project.component';
import { ContactComponent } from './contact/contact.component';
import { FooterComponent } from '../shared/components/footer/footer.component';
import gsap from 'gsap';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [
    AboveTheFoldComponent,
    AboutMeComponent,
    MySkillsComponent,
    PortfolioComponent,
    ProjectComponent,
    ContactComponent,
    FooterComponent
  ],
  templateUrl: './main-content.component.html',
  styleUrl: './main-content.component.scss'
})
export class MainContentComponent implements OnDestroy {
  private zone = inject(NgZone);
  private ctx?: gsap.Context;

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.initSpatialScroll();
      });
    });
  }

  private initSpatialScroll() {
    if (window.innerWidth <= 768) return;

    this.ctx = gsap.context(() => {
      // 1. Initial states configuration
      gsap.set('#c3d-above-the-fold', { autoAlpha: 1, opacity: 1 });
      gsap.set([
        '#c3d-about-me',
        '#c3d-my-skills',
        '#c3d-portfolio-intro',
        '#c3d-project-0',
        '#c3d-project-1',
        '#c3d-project-2',
        '#c3d-contact',
        '#c3d-footer'
      ], {
        autoAlpha: 0,
        opacity: 0
      });

      // Initial sub-element hidden states for scroll reveals (clean vertical slide-ups)
      gsap.set('.about-content', { y: 35, opacity: 0 });
      gsap.set('.about-photo-wrap', { y: 35, opacity: 0 });
      gsap.set('.skills-text', { y: 25, opacity: 0 });
      gsap.set('.skill-item', { y: 35, opacity: 0, scale: 0.92 });
      gsap.set('.contact-heading', { y: 25, opacity: 0 });
      gsap.set('.contact-info', { y: 30, opacity: 0 });
      gsap.set('.contact-form-wrap', { y: 30, opacity: 0 });

      // Create main ScrollTrigger timeline
      // 3D station map (app.component.ts spline): Hero=0.0, About=0.143, Skills=0.286
      // Video plays start→finish across Hero+About, last frame reached just
      // before Skills (0.270) and fully faded exactly as Skills arrives (0.286).
      const CINEMA_END   = 0.270; // frame 151 reached at this scroll progress
      const CINEMA_FADE  = 0.286; // fully transparent by the Skills station

      const master = gsap.timeline({
        scrollTrigger: {
          trigger: '.spatial-scroll-wrapper',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.2,
          pin: '.spatial-viewport',
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            const c = (window as any).__cinema;
            if (!c) return;

            // Map scroll 0→CINEMA_END onto frame 0→1
            const frameP = Math.min(1, p / CINEMA_END);
            c.setProgress(frameP);

            // Continuous opacity: full during cinema, linear fade after
            const opacity = p <= CINEMA_END
              ? 1
              : Math.max(0, 1 - (p - CINEMA_END) / (CINEMA_FADE - CINEMA_END));
            c.setOpacity(opacity);
          }
        }
      });

      // ─── STAGE 1: Above The Fold -> About Me ───────────────────────────────
      master.addLabel('above-to-about');
      master.to('#c3d-above-the-fold', {
        opacity: 0,
        autoAlpha: 0,
        duration: 1,
        ease: 'power2.inOut'
      });
      master.to('#c3d-about-me', {
        opacity: 1,
        autoAlpha: 1,
        duration: 1,
        ease: 'power2.inOut'
      }, '<');
      master.to('.about-content', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out'
      }, '<0.4');
      master.to('.about-photo-wrap', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out'
      }, '<');

      // ─── STAGE 2: About Me -> My Skills ────────────────────────────────────
      master.addLabel('about-to-skills');
      master.to('#c3d-about-me', {
        opacity: 0,
        autoAlpha: 0,
        duration: 1,
        ease: 'power2.inOut'
      });
      master.to('#c3d-my-skills', {
        opacity: 1,
        autoAlpha: 1,
        duration: 1,
        ease: 'power2.inOut'
      }, '<');
      master.to('.skills-text', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out'
      }, '<0.3');
      master.to('.skill-item', {
        y: 0,
        opacity: 1,
        scale: 1,
        stagger: 0.025,
        duration: 0.6,
        ease: 'power2.out'
      }, '<0.1');

      // ─── STAGE 3: My Skills -> Portfolio Intro & Projects ───────────────────
      master.addLabel('skills-to-portfolio');
      master.to('#c3d-my-skills', {
        opacity: 0,
        autoAlpha: 0,
        duration: 1,
        ease: 'power2.inOut'
      });
      master.to([
        '#c3d-portfolio-intro',
        '#c3d-project-0',
        '#c3d-project-1',
        '#c3d-project-2'
      ], {
        opacity: 1,
        autoAlpha: 1,
        duration: 1,
        ease: 'power2.inOut'
      }, '<');

      // Project Flyby spacer (replaces sequential fades)
      master.to({}, { duration: 3 });

      // ─── STAGE 4: Portfolio -> Contact & Footer ────────────────────────────
      master.addLabel('portfolio-to-contact');
      master.to([
        '#c3d-portfolio-intro',
        '#c3d-project-0',
        '#c3d-project-1',
        '#c3d-project-2'
      ], {
        opacity: 0,
        autoAlpha: 0,
        duration: 1,
        ease: 'power2.inOut'
      });
      master.to(['#c3d-contact', '#c3d-footer'], {
        opacity: 1,
        autoAlpha: 1,
        duration: 1,
        ease: 'power2.inOut'
      }, '<');
      master.to('.contact-heading', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out'
      }, '<0.4');
      master.to('.contact-info', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out'
      }, '<0.15');
      master.to('.contact-form-wrap', {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out'
      }, '<0.1');
    });
  }

  ngOnDestroy() {
    this.ctx?.revert();
  }
}

