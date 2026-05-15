import { Routes } from '@angular/router';
import { MainContentComponent } from './main-content/main-content.component';

export const routes: Routes = [
  { path: '', component: MainContentComponent },
  {
    path: 'privacy_policy',
    loadComponent: () => import('./privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent)
  },
  {
    path: 'legal_notice',
    loadComponent: () => import('./legal-notice/legal-notice.component').then(m => m.LegalNoticeComponent)
  },
];
