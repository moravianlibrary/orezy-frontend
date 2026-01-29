import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { getDate } from '../../utils/utils';
import { permissionDict } from '../../app.config';

@Component({
  selector: 'app-drawer',
  imports: [],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
  host: { '[class.open]': 'dashSvc.drawerOpen()' },
})
export class DrawerComponent {
  dashSvc = inject(DashboardService);

  getDate = getDate;
  permissionDict = permissionDict;
}
