import { Component, inject, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import gsap from 'gsap';

@Component({
  selector: 'app-above-the-fold',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './above-the-fold.component.html',
  styleUrl: './above-the-fold.component.scss'
})
export class AboveTheFoldComponent implements AfterViewInit, OnDestroy {
  translate = inject(TranslationService);
  private el = inject(ElementRef);
  private ctx?: gsap.Context;

  get isGerman(): boolean {
    return localStorage.getItem('selectedLanguage') === 'de';
  }

  ngAfterViewInit() {
    this.initGsapTimeline();
    this.initScrollEffects();
    this.initMagneticButton();
    this.initPhotoTilt();
  }

  private initGsapTimeline() {
    this.ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.4 });

      tl.from('.hero-photo', {
        opacity: 0,
        x: 80,
        scale: 0.96,
        duration: 1.2,
        ease: 'power3.out'
      })
      .from('.hero-label', {
        opacity: 0,
        y: 10,
        duration: 0.55,
        ease: 'power2.out'
      }, '-=0.9')
      .from('.hero-name', {
        opacity: 0,
        y: 48,
        duration: 1.1,
        ease: 'power3.out'
      }, '-=0.40')
      .from('.hero-role', {
        opacity: 0,
        y: 16,
        duration: 0.65,
        ease: 'power2.out'
      }, '-=0.35')
      .from('.hero-social-line', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.6,
        ease: 'power2.out'
      }, '-=0.2')
      .from('.hero-social-link', {
        opacity: 0,
        scale: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: 'back.out(2.5)'
      }, '-=0.3')
      .from('.hero-cta', {
        opacity: 0,
        y: 20,
        scale: 0.92,
        duration: 0.55,
        ease: 'back.out(1.7)'
      }, '-=0.15')
      .from('.hero-arrow', {
        opacity: 0,
        y: -14,
        duration: 0.45,
        ease: 'power2.out'
      }, '-=0.2');
    }, this.el.nativeElement);
  }

  private initScrollEffects() {
    const heroContent = this.el.nativeElement.querySelector('.hero-content');
    gsap.to(heroContent, {
      y: 70,
      ease: 'none',
      scrollTrigger: {
        trigger: '#above_the_fold_section',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  private initMagneticButton() {
    const btn = this.el.nativeElement.querySelector('.hero-cta button') as HTMLElement;
    if (!btn) return;

    btn.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, { x: x * 0.32, y: y * 0.32, duration: 0.3, ease: 'power2.out' });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.4)' });
    });
  }

  private initPhotoTilt() {
    const wrapper = this.el.nativeElement.querySelector('.hero-photo-wrapper') as HTMLElement;
    if (!wrapper || !window.matchMedia('(hover: hover)').matches) return;

    gsap.set(wrapper, { transformPerspective: 900 });

    wrapper.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(wrapper, { rotateY: nx * 16, rotateX: -ny * 16, duration: 0.4, ease: 'power2.out' });
    });

    wrapper.addEventListener('mouseleave', () => {
      gsap.to(wrapper, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3.out' });
    });
  }

  ngOnDestroy() {
    this.ctx?.revert();
  }
}
