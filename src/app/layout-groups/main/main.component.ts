import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { catchError } from 'rxjs';
import { Group } from '../../app.types';

@Component({
  selector: 'app-main-groups',
  imports: [],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  dashSvc = inject(DashboardService);

  get totalGroupsLabel(): string {
    const length = this.dashSvc.displayedGroups().length;
    return `Celkem ${length} skupin${length === 1 ? 'a' : [2, 3, 4].includes(length) ? 'y' : '' }`;
  }

  ngOnInit(): void {
    this.dashSvc.fetchGroups().pipe(
      catchError((err) => {
        console.error('Fetching groups failed: ', err);
        throw err;
      })
    ).subscribe((res: Group[]) => {
      this.dashSvc.groups.set(res);
      this.dashSvc.displayedGroups.set(res);
    });
  }
}
