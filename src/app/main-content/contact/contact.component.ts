import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import gsap from 'gsap';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent implements AfterViewInit, OnDestroy {
  translate = inject(TranslationService);
  http = inject(HttpClient);
  private el = inject(ElementRef);
  private ctx?: gsap.Context;

  mailTest = false;

  contactData = { name: '', email: '', message: '' };

  post = {
    endPoint: 'https://api.hassan-ammar.com/sendMail.php',
    body: (payload: object) => JSON.stringify(payload),
    options: { headers: { 'Content-Type': 'text/plain', responseType: 'text' } },
  };

  ngAfterViewInit() {
    this.ctx = gsap.context(() => {
      // Heading sweeps in from below
      gsap.from('.contact-heading h1', {
        opacity: 0,
        y: 80,
        duration: 1.1,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.contact-heading', start: 'top 85%', toggleActions: 'play none none none' }
      });

      gsap.from('.contact-heading > div', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-heading', start: 'top 85%', toggleActions: 'play none none none' }
      });

      // Info block drifts up
      gsap.from('.contact-info', {
        opacity: 0,
        y: 50,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-info', start: 'top 85%', toggleActions: 'play none none none' }
      });

      // Form slides from right with slight delay
      gsap.from('.contact-form', {
        opacity: 0,
        x: 70,
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-form', start: 'top 85%', toggleActions: 'play none none none' },
        delay: 0.1
      });
    }, this.el.nativeElement);
  }

  onSubmit(ngForm: NgForm) {
    if (ngForm.submitted && ngForm.form.valid && !this.mailTest) {
      this.http.post(this.post.endPoint, this.post.body(this.contactData))
        .subscribe({
          next: () => { this.toggleFeedback(); ngForm.resetForm(); },
          error: (error) => { console.error(error); },
          complete: () => console.info('send post complete'),
        });
    } else if (ngForm.submitted && ngForm.form.valid && this.mailTest) {
      this.toggleFeedback();
      ngForm.resetForm();
    }
  }

  toggleFeedback() {
    const feedback = document.getElementById('feedback');
    if (feedback) {
      feedback.classList.add('show');
      setTimeout(() => feedback.classList.remove('show'), 4000);
    }
  }

  ngOnDestroy() {
    this.ctx?.revert();
  }
}
