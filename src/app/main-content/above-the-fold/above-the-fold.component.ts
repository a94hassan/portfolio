import { CommonModule } from '@angular/common';
import { Component, inject} from '@angular/core';
import { TranslationService } from './../../shared/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-above-the-fold',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './above-the-fold.component.html',
  styleUrl: './above-the-fold.component.scss'
})
export class AboveTheFoldComponent {

  translate = inject(TranslationService);

  get isGerman(): boolean {
    return localStorage.getItem('selectedLanguage') === 'de';
  }
}
