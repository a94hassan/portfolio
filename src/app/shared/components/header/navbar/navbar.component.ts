import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslationService } from './../../../services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from './../../../services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  translate = inject(TranslationService);
  theme     = inject(ThemeService);

  options: { text: string; code: string }[] = [
    { text: 'EN', code: 'en' },
    { text: 'DE', code: 'de' },
  ];

  selectedIndex = localStorage.getItem('selectedLanguage') === 'en' ? 0 : 1;
  get selectedOption() { return this.options[this.selectedIndex]; }
  showDropdown = false;

  toggleIcon(navIcon: HTMLElement, dialog: HTMLElement): void {
    navIcon.classList.toggle('open');
    dialog.classList.toggle('visible');
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  selectOption(index: number): void {
    this.selectedIndex = index;
    this.showDropdown = false;
    this.translate.switchLanguage(this.options[index].code);
  }
}
