import { Component, inject, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { ProjectsService } from '../../../shared/services/projects.service';
import { CommonModule } from '@angular/common';
import { TranslationService } from './../../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import gsap from 'gsap';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent implements AfterViewInit, OnDestroy {
  projectsService = inject(ProjectsService);
  translate = inject(TranslationService);
  private el = inject(ElementRef);
  private ctx?: gsap.Context;
  private tiltCleanups: (() => void)[] = [];

  ngAfterViewInit() {
    this.ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.project-card').forEach((card, i) => {
        gsap.from(card, {
          opacity: 0,
          y: 60,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 87%',
            toggleActions: 'play none none none'
          }
        });

        const info = card.querySelector('.project-info') as HTMLElement;
        if (info) {
          gsap.from(info, {
            opacity: 0,
            x: i % 2 === 0 ? 40 : -40,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 87%',
              toggleActions: 'play none none none'
            },
            delay: 0.12
          });
        }
      });
    }, this.el.nativeElement);

    this.initCardTilt();
  }

  private initCardTilt() {
    if (window.innerWidth <= 768) return;

    gsap.utils.toArray<HTMLElement>('.project-card').forEach((card) => {
      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(card, {
          rotateX: -y * 4,
          rotateY: x * 4,
          transformPerspective: 1000,
          ease: 'power2.out',
          duration: 0.35
        });
      };

      const onLeave = () => {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          ease: 'power3.out',
          duration: 0.55
        });
      };

      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      this.tiltCleanups.push(() => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
      });
    });
  }

  ngOnDestroy() {
    this.ctx?.revert();
    this.tiltCleanups.forEach(fn => fn());
  }
}
