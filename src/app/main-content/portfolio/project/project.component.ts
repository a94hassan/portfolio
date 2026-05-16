import { Component, inject, AfterViewInit, OnDestroy } from '@angular/core';
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
  private tiltCleanups: (() => void)[] = [];

  ngAfterViewInit() {
    this.initCardTilt();
  }

  private initCardTilt() {
    if (window.innerWidth <= 768) return;
    gsap.utils.toArray<HTMLElement>('.project-panel').forEach((panel) => {
      const card = panel.querySelector('.project-info') as HTMLElement;
      if (!card) return;
      const onMove = (e: MouseEvent) => {
        const rect = panel.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(card, { rotateX: -y * 5, rotateY: x * 5, transformPerspective: 1000, ease: 'power2.out', duration: 0.35 });
      };
      const onLeave = () => gsap.to(card, { rotateX: 0, rotateY: 0, ease: 'power3.out', duration: 0.55 });
      panel.addEventListener('mousemove', onMove);
      panel.addEventListener('mouseleave', onLeave);
      this.tiltCleanups.push(() => {
        panel.removeEventListener('mousemove', onMove);
        panel.removeEventListener('mouseleave', onLeave);
      });
    });
  }

  ngOnDestroy() { this.tiltCleanups.forEach(fn => fn()); }
}
