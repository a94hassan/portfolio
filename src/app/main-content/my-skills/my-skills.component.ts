import { Component, inject, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { SkillsService } from '../../shared/services/skills.service';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import gsap from 'gsap';

@Component({
  selector: 'app-my-skills',
  standalone: true,
  imports: [TranslateModule, CommonModule],
  templateUrl: './my-skills.component.html',
  styleUrl: './my-skills.component.scss'
})
export class MySkillsComponent implements AfterViewInit, OnDestroy {
  skillsService = inject(SkillsService);
  translate     = inject(TranslationService);
  private el    = inject(ElementRef);
  private tiltCleanups: (() => void)[] = [];

  get isGerman(): boolean {
    return localStorage.getItem('selectedLanguage') === 'de';
  }

  ngAfterViewInit() {
    // Scroll-based entrance animations are owned by app.component.ts (skillsTl).
    // ScrollTrigger never fires inside a GSAP-pinned stage — removed to avoid conflict.
    // Tilt is purely mouse-driven → safe to keep here.
    if (!window.matchMedia('(hover: hover)').matches) return;
    this.initSkillTilt();
  }

  private initSkillTilt() {

    const items = this.el.nativeElement.querySelectorAll('.skill-item') as NodeListOf<HTMLElement>;
    items.forEach((item) => {
      const onMove = (e: MouseEvent) => {
        const rect = item.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(item, {
          rotateX: -y * 22,
          rotateY: x * 22,
          transformPerspective: 500,
          scale: 1.08,
          duration: 0.20,
          ease: 'power2.out'
        });
      };

      const onLeave = () => {
        gsap.to(item, {
          rotateX: 0, rotateY: 0, scale: 1,
          duration: 0.50, ease: 'power3.out'
        });
      };

      item.addEventListener('mousemove', onMove);
      item.addEventListener('mouseleave', onLeave);
      this.tiltCleanups.push(() => {
        item.removeEventListener('mousemove', onMove);
        item.removeEventListener('mouseleave', onLeave);
      });
    });
  }

  ngOnDestroy() {
    this.tiltCleanups.forEach(fn => fn());
  }
}
