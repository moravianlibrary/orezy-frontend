import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { getDate } from '../../utils/utils';
import { permissionDict, titleStateDict } from '../../app.config';
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
  titleStateDict = titleStateDict;

  copied: Record<string, boolean> = {};
  private copiedTimers: Record<string, number> = {};

  copy(key: string, text: string): void {
    navigator.clipboard.writeText(text);

    this.copied[key] = true;
    window.clearTimeout(this.copiedTimers[key]);
    this.copiedTimers[key] = window.setTimeout(() => this.copied[key] = false, 1200);
  }
}
