import { Component, inject, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectsService } from '../../shared/services/projects.service';
import { CommonModule } from '@angular/common';
import gsap from 'gsap';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [TranslateModule, CommonModule],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss'
})
export class PortfolioComponent implements AfterViewInit, OnDestroy {
  translate = inject(TranslationService);
  projectsService = inject(ProjectsService);
  private el = inject(ElementRef);
  private tiltCleanups: (() => void)[] = [];

  ngAfterViewInit() {
    this.initCardTilt();
    this.initDragAndAutoScroll();
  }

  private initDragAndAutoScroll() {
    if (window.innerWidth <= 768) return;
    const wrapper = this.el.nativeElement.querySelector('.portfolio-ribbon-wrapper') as HTMLElement;
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
    const autoScrollSpeed = 0.35; // Slower, highly elegant auto-scroll speed for wider project cards

    const tick = () => {
      // Only auto-scroll when not dragging, not hovered, and not currently flinging with GSAP
      if (!isHovered && !isDragging && !gsap.isTweening(wrapper)) {
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

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      wrapper.classList.add('dragging');
      gsap.killTweensOf(wrapper); // stop active momentum tween immediately
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

      if (Math.abs(velocity) > 0.05) {
        // Smooth momentum glide using GSAP
        const targetScroll = wrapper.scrollLeft - velocity * 180;
        gsap.to(wrapper, {
          scrollLeft: targetScroll,
          duration: 0.8,
          ease: 'power3.out',
          overwrite: 'auto',
          onUpdate: () => {
            const half = wrapper.scrollWidth / 2;
            if (wrapper.scrollLeft < 0) wrapper.scrollLeft += half;
            if (wrapper.scrollLeft >= half) wrapper.scrollLeft -= half;
          }
        });
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        gsap.killTweensOf(wrapper);
        scrollLeftVal += e.deltaY * 0.7;
        const half = wrapper.scrollWidth / 2;
        if (scrollLeftVal < 0) scrollLeftVal += half;
        if (scrollLeftVal >= half) scrollLeftVal -= half;
        wrapper.scrollLeft = scrollLeftVal;
      }
    };

    const onMouseEnter = () => isHovered = true;
    const onMouseLeaveEvent = () => {
      isHovered = false;
      onMouseUpOrLeave();
    };

    const onTouchStart = () => {
      isDragging = true;
      gsap.killTweensOf(wrapper);
    };
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

  private initCardTilt() {
    if (window.innerWidth <= 768 || !window.matchMedia('(hover: hover)').matches) return;
    const cards = Array.from(this.el.nativeElement.querySelectorAll('.project-card')) as HTMLElement[];
    cards.forEach(card => {
      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(card, {
          rotateX: -y * 8,
          rotateY: x * 8,
          transformPerspective: 800,
          scale: 1.02,
          duration: 0.3,
          ease: 'power2.out'
        });
      };

      const onLeave = () => {
        gsap.to(card, {
          rotateX: 0, rotateY: 0, scale: 1,
          duration: 0.6, ease: 'power3.out'
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
    this.tiltCleanups.forEach(fn => fn());
  }
}
