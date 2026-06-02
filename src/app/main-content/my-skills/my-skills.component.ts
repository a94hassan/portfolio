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
    this.initSkillTilt();
    this.initDragAndAutoScroll();
  }

  private initDragAndAutoScroll() {
    if (window.innerWidth <= 768) return;
    const wrapper = this.el.nativeElement.querySelector('.skills-ribbon-wrapper') as HTMLElement;
    if (!wrapper) return;

    let isDragging = false;
    let isHovered = false;
    let startX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let rafId = 0;
    let scrollLeftVal = wrapper.scrollLeft;
    const autoScrollSpeed = 0.65; // speed of auto-scroll in pixels per frame

    const tick = () => {
      if (!isHovered && !isDragging) {
        scrollLeftVal += autoScrollSpeed;
        const half = wrapper.scrollWidth / 2;
        if (scrollLeftVal >= half) {
          scrollLeftVal -= half;
        }
        wrapper.scrollLeft = scrollLeftVal;
      } else {
        scrollLeftVal = wrapper.scrollLeft;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Mouse drag scrolling
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      wrapper.classList.add('dragging');
      startX = e.pageX - wrapper.offsetLeft;
      scrollLeft = wrapper.scrollLeft;
      velocity = 0;
      lastX = e.pageX;
      lastTime = performance.now();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - wrapper.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollLeftVal = scrollLeft - walk;

      const half = wrapper.scrollWidth / 2;
      if (scrollLeftVal < 0) scrollLeftVal += half;
      if (scrollLeftVal >= half) scrollLeftVal -= half;

      wrapper.scrollLeft = scrollLeftVal;

      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        velocity = (e.pageX - lastX) / dt;
      }
      lastX = e.pageX;
      lastTime = now;
    };

    const onMouseUpOrLeave = () => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.classList.remove('dragging');

      const step = () => {
        if (isDragging || Math.abs(velocity) < 0.05) return;
        scrollLeftVal -= velocity * 14;
        velocity *= 0.92;

        const half = wrapper.scrollWidth / 2;
        if (scrollLeftVal < 0) scrollLeftVal += half;
        if (scrollLeftVal >= half) scrollLeftVal -= half;

        wrapper.scrollLeft = scrollLeftVal;
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    };

    // Horizontal mousewheel scrolling
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollLeftVal += e.deltaY * 0.7;
        const half = wrapper.scrollWidth / 2;
        if (scrollLeftVal < 0) scrollLeftVal += half;
        if (scrollLeftVal >= half) scrollLeftVal -= half;
        wrapper.scrollLeft = scrollLeftVal;
      }
    };

    // Hover events
    const onMouseEnter = () => isHovered = true;
    const onMouseLeaveEvent = () => {
      isHovered = false;
      onMouseUpOrLeave();
    };

    // Touch events
    const onTouchStart = () => isDragging = true;
    const onTouchEnd = () => isDragging = false;

    wrapper.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUpOrLeave);
    wrapper.addEventListener('mouseleave', onMouseLeaveEvent);
    wrapper.addEventListener('mouseenter', onMouseEnter);
    wrapper.addEventListener('wheel', onWheel, { passive: false });

    wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: true });
    wrapper.addEventListener('touchcancel', onTouchEnd, { passive: true });

    this.tiltCleanups.push(() => {
      cancelAnimationFrame(rafId);
      wrapper.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUpOrLeave);
      wrapper.removeEventListener('mouseleave', onMouseLeaveEvent);
      wrapper.removeEventListener('mouseenter', onMouseEnter);
      wrapper.removeEventListener('wheel', onWheel);
      wrapper.removeEventListener('touchstart', onTouchStart);
      wrapper.removeEventListener('touchend', onTouchEnd);
      wrapper.removeEventListener('touchcancel', onTouchEnd);
    });
  }

  private initSkillTilt() {
    if (!window.matchMedia('(hover: hover)').matches) return;
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
