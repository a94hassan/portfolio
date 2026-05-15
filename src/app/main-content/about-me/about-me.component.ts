import { Component, inject, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import gsap from 'gsap';

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
  private ctx?: gsap.Context;

  ngAfterViewInit() {
    this.ctx = gsap.context(() => {
      const contentTrigger = {
        trigger: '.about-content',
        start: 'top 82%',
        toggleActions: 'play none none none'
      };

      gsap.from('.about-heading', {
        opacity: 0, y: 70, duration: 1.0, ease: 'power4.out',
        scrollTrigger: contentTrigger
      });
      gsap.from('.about-body', {
        opacity: 0, y: 30, duration: 0.8, ease: 'power3.out',
        scrollTrigger: contentTrigger, delay: 0.2
      });
      gsap.from('.about-trait', {
        opacity: 0, x: -28, duration: 0.65, stagger: 0.14, ease: 'power3.out',
        scrollTrigger: contentTrigger, delay: 0.38
      });
      gsap.from('.about-photo-wrap', {
        opacity: 0, x: 70, duration: 0.9, ease: 'power3.out',
        scrollTrigger: {
          trigger: '.about-photo-wrap',
          start: 'top 82%',
          toggleActions: 'play none none none'
        }
      });
    }, this.el.nativeElement);
  }

  ngOnDestroy() {
    this.ctx?.revert();
  }
}
