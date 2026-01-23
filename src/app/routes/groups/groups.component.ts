import { Component } from '@angular/core';
import { LeftPanelComponent } from '../../layout-groups/left-panel/left-panel.component';
import { MainComponent } from '../../layout-groups/main/main.component';

@Component({
  selector: 'app-groups',
  imports: [LeftPanelComponent, MainComponent],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss'
})
export class GroupsComponent {

}
