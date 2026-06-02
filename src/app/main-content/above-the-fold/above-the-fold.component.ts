import { Component, inject, AfterViewInit, ElementRef } from '@angular/core';
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
export class AboveTheFoldComponent implements AfterViewInit {
  translate = inject(TranslationService);
  private el = inject(ElementRef);

  ngAfterViewInit() {
    this.initHeroTilt();
    this.initEntranceAnimation();
  }

  private initEntranceAnimation() {
    const root = this.el.nativeElement;
    const status = root.querySelector('.hero-status');
    const name = root.querySelector('.hero-name');
    const role = root.querySelector('.hero-role-wrap');
    const tagline = root.querySelector('.hero-tagline');
    const actions = root.querySelector('.hero-actions');
    const email = root.querySelector('.hero-email');
    const photo = root.querySelector('.hero-photo-wrapper');
    const arrow = root.querySelector('.hero-arrow');

    // Prevent flash of unstyled content
    gsap.set([status, name, role, tagline, actions, email, arrow].filter(el => el), {
      opacity: 0,
      y: 25
    });
    if (photo) {
      gsap.set(photo, { opacity: 0, scale: 0.96, y: 15 });
    }

    const tl = gsap.timeline({ delay: 0.35 });
    if (status)  tl.to(status,  { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
    if (name)    tl.to(name,    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.45');
    if (role)    tl.to(role,    { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.55');
    if (tagline) tl.to(tagline, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');
    if (actions) tl.to(actions, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.45');
    if (email)   tl.to(email,   { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.4');
    if (photo)   tl.to(photo,   { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: 'power3.out' }, '-=0.85');
    if (arrow)   tl.to(arrow,   { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.65');
  }

  private initHeroTilt() {
    const heroContent = this.el.nativeElement.querySelector('.hero-content') as HTMLElement;
    if (!heroContent || !window.matchMedia('(hover: hover)').matches) return;
    gsap.set(heroContent, { transformPerspective: 1200 });
    heroContent.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = heroContent.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(heroContent, { rotateY: nx * 6, rotateX: -ny * 6, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
    });
    heroContent.addEventListener('mouseleave', () => {
      gsap.to(heroContent, { rotateX: 0, rotateY: 0, duration: 0.75, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
    });
  }
}
