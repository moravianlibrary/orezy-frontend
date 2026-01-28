import { Component, inject } from '@angular/core';
import { LeftPanelComponent } from '../../layout-dashboard/left-panel/left-panel.component';
import { MainComponent } from '../../layout-dashboard/main/main.component';
import { DrawerComponent } from '../../components/drawer/drawer.component';
import { DashboardService } from '../../services/dashboard.service';
import { catchError, map, of, Subscription, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Group, GroupDetail } from '../../app.types';

@Component({
  selector: 'app-dashboard',
  imports: [LeftPanelComponent, MainComponent, DrawerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  dashSvc = inject(DashboardService);
  authSvc = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private paramsOnGroupId = new Subscription();


  ngOnInit() {
    
    // Subscribe to params
    this.paramsOnGroupId = this.activatedRoute.paramMap
      .pipe(
        map(params => params.get('group_id') || ''),
        switchMap(group_id => { 
          const path = this.router.url;
          const page = path.match(/^\/([^\/]+)/)?.[1] ?? null;

          switch (page) {
            
            // My groups
            case null:
              return this.dashSvc.fetchGroups().pipe(
                tap((res: Group[]) => {
                  this.dashSvc.dashboardPage.set('my-groups');
                  this.dashSvc.groups.set(res);
                  this.dashSvc.displayedGroups.set(res);
                }),
                catchError(err => {
                  console.error('Fetching groups failed:', err);
                  throw err;
                })
              );

            // My groups - titles
            case 'group':
              return this.dashSvc.fetchTitles(group_id).pipe(
                tap((res: GroupDetail) => {
                  this.dashSvc.dashboardPage.set('my-groups-titles');
                  this.dashSvc.selectedGroup.set(res);
                  this.dashSvc.titles.set(res.titles);
                  this.dashSvc.displayedTitles.set(res.titles);
                }),
                catchError(err => {
                  console.error('Fetching titles failed:', err);
                  throw err;
                })
              );

            // Groups
            // case 'groups':
              // some fetching

            // Users
            // case 'users':
              // some fetching

            default:
              return of(null);
          }
        })).subscribe();
  }

  ngOnDestroy(): void {
    this.paramsOnGroupId.unsubscribe();
  }
}
