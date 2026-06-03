import { Component, OnDestroy, NgZone, inject, afterNextRender } from '@angular/core';
import { AboveTheFoldComponent } from './above-the-fold/above-the-fold.component';
import { AboutMeComponent } from './about-me/about-me.component';
import { MySkillsComponent } from './my-skills/my-skills.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { ContactComponent } from './contact/contact.component';
import { FooterComponent } from '../shared/components/footer/footer.component';
import gsap from 'gsap';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [
    AboveTheFoldComponent,
    AboutMeComponent,
    MySkillsComponent,
    PortfolioComponent,
    ContactComponent,
    FooterComponent
  ],
  templateUrl: './main-content.component.html',
  styleUrl: './main-content.component.scss'
})
export class MainContentComponent implements OnDestroy {
  private zone = inject(NgZone);
  private ctx?: gsap.Context;

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.initScrollAnimations();
      });
    });
  }

  private initScrollAnimations() {
    if (window.innerWidth <= 768) return;

    this.ctx = gsap.context(() => {
      // 1. About Me section reveal
      gsap.from('.about-content, .about-photo-wrap', {
        scrollTrigger: {
          trigger: '#about_me_section',
          start: 'top 82%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        y: 35,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power2.out'
      });

      // 2. Skills section reveal
      gsap.from('.skills-text, .skill-item', {
        scrollTrigger: {
          trigger: '#my_skills_section',
          start: 'top 82%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        y: 25,
        duration: 0.6,
        stagger: 0.03,
        ease: 'power2.out'
      });

      // 3. Portfolio section reveal
      gsap.from('#portfolio_section .section-heading, #portfolio_section .portfolio-span, #portfolio_section .portfolio-ribbon-wrap', {
        scrollTrigger: {
          trigger: '#portfolio_section',
          start: 'top 82%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power2.out'
      });

      // 4. Contact section reveal
      gsap.from('.contact-heading, .contact-info, .contact-form-wrap', {
        scrollTrigger: {
          trigger: '#contact_section',
          start: 'top 82%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power2.out'
      });
    });
  }

  ngOnDestroy() {
    this.ctx?.revert();
  }
}
