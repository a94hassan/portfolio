import { Firestore } from '@angular/fire/firestore';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { StorageService } from '../core/firebase/storage.service';
import { ProjectsService } from '../shared/services/projects.service';
import { SkillsService } from '../shared/services/skills.service';
import { provideHttpClient } from '@angular/common/http';

const translateServiceMock = {
  setDefaultLang: () => undefined,
  use: () => of('en'),
  get: () => of(''),
  stream: () => of(''),
  instant: (key: string) => key,
  onLangChange: of({ lang: 'en', translations: {} }),
  onTranslationChange: of({ lang: 'en', translations: {} }),
  onDefaultLangChange: of({ lang: 'en', translations: {} }),
};

const storageServiceMock: Pick<StorageService, 'getDownloadUrl'> = {
  getDownloadUrl: () => of(''),
};

const projectsServiceMock: Pick<ProjectsService, 'projects$'> = {
  projects$: of([]),
};

const skillsServiceMock: Pick<SkillsService, 'skills$'> = {
  skills$: of([]),
};

export const testProviders = [
  {
    provide: TranslateService,
    useValue: translateServiceMock as unknown as TranslateService,
  },
  { provide: Firestore, useValue: {} },
  { provide: StorageService, useValue: storageServiceMock },
  { provide: ProjectsService, useValue: projectsServiceMock },
  { provide: SkillsService, useValue: skillsServiceMock },
  provideHttpClient(),
];
