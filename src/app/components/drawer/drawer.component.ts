import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { getDate } from '../../utils/utils';
import { permissionDict, titleStateDict } from '../../app.config';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { UiService } from '../../services/ui.service';
import { SelectComponent } from '../select/select.component';
import { catchError } from 'rxjs';
import { Models } from '../../app.types';

@Component({
  selector: 'app-drawer',
  imports: [FormsModule, SelectComponent],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
  host: { '[class.open]': 'uiSvc.drawerOpen()' },
})
export class DrawerComponent {
  dashSvc = inject(DashboardService);
  authSvc = inject(AuthService);
  uiSvc = inject(UiService);

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

  openEditMode(): void {
    this.uiSvc.drawerEditMode.set(true)
    const dashSvc = this.dashSvc;

    if (dashSvc.dashboardPage() === 'groups') {
      dashSvc.fetchModels().pipe(
        catchError(err => {
          this.uiSvc.showToast('Nepodařilo se načíst dostupné AI modely. Zkuste panel zavřít a znovu otevřít.', { type: 'error' });
          console.error(err);
          throw err;
        })
      ).subscribe((res: Models) => {
        dashSvc.availableModels.set(res.available_models.map(m => ({ value: m, label: m })));
        dashSvc.selectedModel.set(dashSvc.selectedGroupDetail()?.default_model ?? res.available_models[0]);
        dashSvc.selectedModelUsed.set(false);
      });
    }
  }
}
