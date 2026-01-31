import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { permissionDict, titleStateDict } from '../../app.config';
import { Group, GroupDetail, UserInGroup } from '../../app.types';
import { defer, getDate } from '../../utils/utils';
import { OverlayScrollbars } from 'overlayscrollbars';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, Subscription, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-main-groups',
  imports: [FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  dashSvc = inject(DashboardService);
  authSvc = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private paramsOnGroupId = new Subscription();

  getDate = getDate;
  maxUsers: number = 3;

  @ViewChild('bodyScroll', { static: false }) bodyScroll!: ElementRef<HTMLDivElement>;
  private osInstance?: ReturnType<typeof OverlayScrollbars>;


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
                  this.dashSvc.myGroups.set(res);
                  this.dashSvc.displayedMyGroups.set(res);
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
                  this.dashSvc.selectedMyGroup.set(res);
                  this.dashSvc.titles.set(res.titles);
                  this.dashSvc.displayedTitles.set(res.titles);
                }),
                catchError(err => {
                  if (err.status === 403) this.router.navigate(['/']);
                  console.error('Fetching titles failed:', err);
                  throw err;
                })
              );

            // Groups
            case 'groups':
              return this.dashSvc.fetchGroups().pipe(
                tap((res: Group[]) => {
                  this.dashSvc.dashboardPage.set('groups');
                  this.dashSvc.myGroups.set(res);
                  this.dashSvc.displayedGroups.set(this.dashSvc.groups());
                }),
                catchError(err => {
                  console.error('Fetching groups failed:', err);
                  throw err;
                })
              );

            // Users
            // case 'users':
              // some fetching

            default:
              return of(null);
          }
        })).subscribe(() => {      
          defer(() => {
            const el = this.bodyScroll?.nativeElement;
            this.osInstance = OverlayScrollbars(el, {
              overflow: { x: 'hidden', y: 'scroll' },
              scrollbars: {
                theme: 'os-theme-orezy',
                autoHide: 'leave',
                autoHideDelay: 250,
                dragScroll: true,
                clickScroll: true,
              },
            });
            el.classList.remove('os-pending');
          }, 100);
        });
  }

  ngOnDestroy(): void {
    this.paramsOnGroupId.unsubscribe();
    this.osInstance?.destroy();
    this.osInstance = undefined;
  }


  /* ------------------------------
    MY GROUPS
  ------------------------------ */
  permissionDict = permissionDict;
  
  get totalMyGroupsLabel(): string {
    const length = this.dashSvc.displayedMyGroups().length;
    return `Celkem ${length} skupin${length === 1 ? 'a' : [2, 3, 4].includes(length) ? 'y' : '' }`;
  }

  filterMyGroups(): void {
    this.dashSvc.displayedMyGroups.set(this.dashSvc.myGroups().filter(g => g.name.toLowerCase().includes(this.dashSvc.searchMyGroups())));
  }


  /* ------------------------------
    MY GROUPS - TITLES
  ------------------------------ */
  titleStateDict = titleStateDict;

  get totalTitlesLabel(): string {
    const length = this.dashSvc.displayedTitles().length;
    return `Celkem ${length} knih${length === 1 ? 'a' : [2, 3, 4].includes(length) ? 'y' : '' }`;
  }

  filterTitles(): void {
    this.dashSvc.displayedTitles.set(this.dashSvc.titles().filter(t => t._id.includes(this.dashSvc.searchTitles())));
  }

  shouldHaveLink(state: string): boolean {
    return ['ready', 'user_approved', 'completed'].includes(state);
  }


  /* ------------------------------
    GROUPS
  ------------------------------ */
  get totalGroupsLabel(): string {
    const length = this.dashSvc.displayedGroups().length;
    return `Celkem ${length} skupin${length === 1 ? 'a' : [2, 3, 4].includes(length) ? 'y' : '' }`;
  }

  filterGroups(): void {
    this.dashSvc.displayedGroups.set(this.dashSvc.groups().filter(g => g.name.toLowerCase().includes(this.dashSvc.searchGroups())));
  }

  getUsersShort(group: Group): UserInGroup[] {
    return group.users?.slice(0,this.maxUsers) ?? [];
  }

  getUsersLong(group: Group): UserInGroup[] {
    return group.users ?? [];
  }
}
