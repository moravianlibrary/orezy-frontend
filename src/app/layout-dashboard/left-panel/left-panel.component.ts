import { Component, inject } from '@angular/core';
import { MenuComponent } from "../../components/menu/menu.component";
import { AuthService } from '../../services/auth.service';
import { userRolesDict } from '../../app.config';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-left-panel-groups',
  // imports: [MenuComponent],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss'
})
export class LeftPanelComponent {
  authSvc = inject(AuthService);
  dashSvc = inject(DashboardService);

  userRolesDict = userRolesDict;
}
