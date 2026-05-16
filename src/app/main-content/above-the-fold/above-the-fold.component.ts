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

  get isGerman(): boolean {
    return localStorage.getItem('selectedLanguage') === 'de';
  }

  ngAfterViewInit() {
    this.initMagneticButton();
    this.initPhotoTilt();
  }

  private initMagneticButton() {
    const btn = this.el.nativeElement.querySelector('.hero-cta button') as HTMLElement;
    if (!btn) return;
    btn.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, { x: x * 0.30, y: y * 0.30, duration: 0.3, ease: 'power2.out' });
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
      gsap.to(wrapper, { rotateY: nx * 14, rotateX: -ny * 14, duration: 0.4, ease: 'power2.out' });
    });
    wrapper.addEventListener('mouseleave', () => {
      gsap.to(wrapper, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3.out' });
    });
  }
}
