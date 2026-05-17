import { Injectable } from '@angular/core';
import { Skill } from '../interfaces/skill';

@Injectable({
  providedIn: 'root'
})
export class SkillsService {

  skills: Skill[] = [
    { name: 'Angular',       icon: 'angular-original.svg'    },
    { name: 'TypeScript',    icon: 'typescript-original.svg' },
    { name: 'JavaScript',    icon: 'javascript-original.svg' },
    { name: 'SCSS',          icon: 'sass-original.svg'       },
    { name: 'CSS',           icon: 'css3-original.svg'       },
    { name: 'HTML',          icon: 'html5-original.svg'      },
    { name: 'Firebase',      icon: 'firebase-original.svg'   },
    { name: 'Git',           icon: 'git-original.svg'        },
    { name: 'REST API',      icon: 'rest-api-original.svg'   },
    { name: 'Material UI',   icon: 'materialui-original.svg' },
    { name: 'Bootstrap',     icon: 'bootstrap-original.svg'  },
    { name: 'Scrum',         icon: 'scrum-original.svg'      },
  ];
}
