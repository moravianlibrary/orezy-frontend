import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-drawer',
  imports: [],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
  host: { '[class.open]': 'dashSvc.drawerOpen()' },
})
export class DrawerComponent {
  dashSvc = inject(DashboardService);
}
