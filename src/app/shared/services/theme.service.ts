import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = true;

  init(): void {
    this.isDark = localStorage.getItem('theme') !== 'light';
    this.apply();
  }

  toggle(): void {
    this.isDark = !this.isDark;
    localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
    this.apply();
  }

  private apply(): void {
    document.documentElement.classList.toggle('light', !this.isDark);
  }
}
