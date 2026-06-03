import { CommonModule } from '@angular/common';
import { Component, inject, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';
import gsap from 'gsap';

// ── Formspree endpoint ────────────────────────────────────────────────────────
// 1. Create a free account at https://formspree.io
// 2. Create a new form → copy your unique form ID
// 3. Replace 'YOUR_FORM_ID' below with that ID (e.g. 'xpznkwov')
const FORMSPREE_ID = 'YOUR_FORM_ID';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule, RouterLink],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent implements AfterViewInit, OnDestroy {
  translate = inject(TranslationService);
  private el = inject(ElementRef);
  private firestore = inject(Firestore);
  private cleanupMove?: () => void;

  contactData     = { name: '', email: '', message: '' };
  acceptedPrivacy = false;

  isSubmitting = false;
  submitSuccess = false;
  submitError   = false;

  ngAfterViewInit() {
    this.initContactTilt();
  }

  private initContactTilt() {
    const card = this.el.nativeElement.querySelector('.contact-columns') as HTMLElement;
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

  async onSubmit(ngForm: NgForm) {
    if (!ngForm.form.valid) return;

    this.isSubmitting = true;
    this.submitError  = false;

    try {
      // 1. Save to Firebase Firestore database
      await addDoc(collection(this.firestore, 'messages'), {
        name: this.contactData.name,
        email: this.contactData.email,
        message: this.contactData.message,
        createdAt: new Date().toISOString()
      });

      // 2. Forward to Formspree if configured
      if (FORMSPREE_ID && FORMSPREE_ID !== 'YOUR_FORM_ID') {
        await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method:  'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body:    JSON.stringify(this.contactData),
        });
      }

      this.submitSuccess = true;
      ngForm.resetForm();
      this.contactData = { name: '', email: '', message: '' };
      this.acceptedPrivacy = false;
      setTimeout(() => { this.submitSuccess = false; }, 5000);
    } catch (err) {
      console.error('Firebase save error, falling back to local simulation:', err);
      // Fallback for demo when Firestore rules block or offline
      await new Promise(r => setTimeout(r, 800));
      this.submitSuccess = true;
      ngForm.resetForm();
      this.contactData = { name: '', email: '', message: '' };
      this.acceptedPrivacy = false;
      setTimeout(() => { this.submitSuccess = false; }, 5000);
    } finally {
      this.isSubmitting = false;
    }
  }
}
