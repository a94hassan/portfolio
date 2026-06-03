import { Component, inject, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
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
  private cleanupMove?: () => void;

  ngAfterViewInit() {
    this.initAboutTilt();
  }

  private initAboutTilt() {
    const card = this.el.nativeElement.querySelector('.about-glass-card') as HTMLElement;
    if (!card || !window.matchMedia('(hover: hover)').matches) return;
    gsap.set(card, { transformPerspective: 1200 });

    const onMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(card, { rotateY: nx * 4, rotateX: -ny * 4, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
    };

    const onMouseLeave = () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.75, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
    };

    card.addEventListener('mousemove', onMouseMove);
    card.addEventListener('mouseleave', onMouseLeave);

    this.cleanupMove = () => {
      card.removeEventListener('mousemove', onMouseMove);
      card.removeEventListener('mouseleave', onMouseLeave);
    };
  }

  ngOnDestroy() {
    this.cleanupMove?.();
  }
}
