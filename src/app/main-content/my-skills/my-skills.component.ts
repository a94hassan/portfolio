import { Component, inject } from '@angular/core';
import { SkillsService } from '../../shared/services/skills.service';

@Component({
  selector: 'app-my-skills',
  standalone: true,
  imports: [],
  templateUrl: './my-skills.component.html',
  styleUrl: './my-skills.component.scss'
})
export class MySkillsComponent {
  skillsService = inject(SkillsService);
}
