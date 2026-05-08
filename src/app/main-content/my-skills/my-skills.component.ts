import { Component, inject, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
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
  translate = inject(TranslationService);
  private el = inject(ElementRef);
  private ctx?: gsap.Context;
  private tiltCleanups: (() => void)[] = [];

  get isGerman(): boolean {
    return localStorage.getItem('selectedLanguage') === 'de';
  }

  ngAfterViewInit() {
    this.ctx = gsap.context(() => {
      gsap.from('.skill-item', {
        opacity: 0,
        y: 36,
        scale: 0.70,
        duration: 0.55,
        stagger: { each: 0.045, from: 'random' },
        ease: 'back.out(1.8)',
        scrollTrigger: {
          trigger: '.skills-grid',
          start: 'top 82%',
          toggleActions: 'play none none none'
        }
      });

      gsap.from('.skills-text h1', {
        opacity: 0,
        y: 70,
        duration: 1.0,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: '.skills-text',
          start: 'top 82%',
          toggleActions: 'play none none none'
        }
      });

      gsap.from('.skills-text p', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.skills-text',
          start: 'top 82%',
          toggleActions: 'play none none none'
        },
        delay: 0.15
      });

      gsap.from('.skills-text button', {
        opacity: 0,
        scale: 0.9,
        y: 20,
        duration: 0.6,
        ease: 'back.out(1.8)',
        scrollTrigger: {
          trigger: '.skills-text',
          start: 'top 80%',
          toggleActions: 'play none none none'
        },
        delay: 0.3
      });
    }, this.el.nativeElement);

    this.initSkillTilt();
  }

  private initSkillTilt() {
    if (window.innerWidth <= 768) return;

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
    this.ctx?.revert();
    this.tiltCleanups.forEach(fn => fn());
  }
}
