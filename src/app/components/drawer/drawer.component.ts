import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { getDate } from '../../utils/utils';
import { permissionDict } from '../../app.config';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-drawer',
  imports: [FormsModule],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
  host: { '[class.open]': 'dashSvc.drawerOpen()' },
})
export class DrawerComponent {
  dashSvc = inject(DashboardService);
  authSvc = inject(AuthService);

  getDate = getDate;
  permissionDict = permissionDict;
}
