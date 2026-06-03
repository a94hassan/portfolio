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
    this.initEntranceAnimation();
  }

  private initEntranceAnimation() {
    const root    = this.el.nativeElement;
    const status  = root.querySelector('.hero-status');
    const name    = root.querySelector('.hero-name');
    const role    = root.querySelector('.hero-role-wrap');
    const tagline = root.querySelector('.hero-tagline');
    const actions = root.querySelector('.hero-actions');
    const email   = root.querySelector('.hero-email');
    const arrow   = root.querySelector('.hero-arrow');

    const els = [status, name, role, tagline, actions, email, arrow].filter(Boolean);
    gsap.set(els, { opacity: 0, y: 28 });

    const tl = gsap.timeline({ delay: 0.5 });
    tl.to(status,  { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      .to(name,    { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.4')
      .to(role,    { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.55')
      .to(tagline, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5')
      .to(actions, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.45')
      .to(email,   { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.4')
      .to(arrow,   { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');
  }
}
