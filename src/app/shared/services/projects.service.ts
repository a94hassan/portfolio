import { Injectable } from '@angular/core';
import { Project } from '../interfaces/project';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {

  constructor() { }

  projects: Project[] = [    
    {
      name: 'Join',
      techStack: 'JavaScript | HTML | CSS',
      description: 'join_description',
      link: 'https://join.hassan-ammar.com',
      github: 'https://github.com/a94hassan/join',
      img: 'join.webp'
    },
    {
      name: 'El Pollo Loco',
      techStack: 'JavaScript | HTML | CSS',
      description: 'el_pollo_loco_description',
      link: 'https://el-pollo-loco.hassan-ammar.com',
      github: 'https://github.com/a94hassan/el_pollo_loco',
      img: 'el_pollo_loco.webp'
    },
    {
      name: 'Pokedex',
      techStack: 'JavaScript | HTML | CSS',
      description: 'pokedex_description',
      link: 'https://pokedex.hassan-ammar.com',
      github: 'https://github.com/a94hassan/pokedex',
      img: 'pokedex.webp'
    }
  ]
}
