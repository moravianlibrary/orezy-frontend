import { Component, inject } from '@angular/core';
import { MenuComponent } from "../../components/menu/menu.component";
import { AuthService } from '../../services/auth.service';
import { userRolesDict } from '../../app.config';
import { DashboardService } from '../../services/dashboard.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-top-panel-dashboard',
  // imports: [MenuComponent],
  templateUrl: './top-panel.component.html',
  styleUrl: './top-panel.component.scss'
})
export class TopPanelComponent {
  authSvc = inject(AuthService);
  dashSvc = inject(DashboardService);
  router = inject(Router);

  userRolesDict = userRolesDict;
}
