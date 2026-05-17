import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  translate = inject(TranslationService);
  http = inject(HttpClient);

  mailTest = false;

  contactData = { name: '', email: '', message: '' };

  post = {
    endPoint: '/sendMail.php',
    body: (payload: any) => JSON.stringify(payload),
    options: { headers: { 'Content-Type': 'text/plain', responseType: 'text' } },
  };

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

}
