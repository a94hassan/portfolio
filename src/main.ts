(window as any).__zone_symbol__UNPATCHED_EVENTS = ['scroll', 'wheel', 'touchstart', 'touchmove', 'touchend'];

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
