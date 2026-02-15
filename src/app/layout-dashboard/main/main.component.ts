import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { permissionDict, titleStateDict, titleStateFilterDict } from '../../app.config';
import { Group, GroupPage, Permission, Position, User, UserInGroup } from '../../app.types';
import { defer, getDate } from '../../utils/utils';
import { OverlayScrollbars } from 'overlayscrollbars';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, Subscription, switchMap, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { Title } from '@angular/platform-browser';
import { ToastComponent } from '../../components/toast/toast.component';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'app-main-groups',
  imports: [FormsModule, CommonModule, OverlayModule, ToastComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  dashSvc = inject(DashboardService);
  uiSvc = inject(UiService);
  authSvc = inject(AuthService);
  private title = inject(Title);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private paramsOnGroupId = new Subscription();

  getDate = getDate;
  maxUsers: number = 3;
  maxGroups: number = 3;
  tableHasScrollbar = signal<boolean>(false);

  @ViewChild('bodyScroll', { static: false }) bodyScroll!: ElementRef<HTMLDivElement>;
  private osInstance?: ReturnType<typeof OverlayScrollbars>;


  /* ------------------------------
    DIFFERENT PAGES INITIAL FETCHES
  ------------------------------ */
  ngOnInit() {
    
    // Subscribe to params
    this.paramsOnGroupId = this.activatedRoute.paramMap
      .pipe(
        map(params => params.get('group_id') || ''),
        switchMap(group_id => { 
          const path = this.router.url;
          const page = path.match(/^\/([^\/]+)/)?.[1] ?? null;

          switch (page) {

            // Groups
            case 'groups':
              return this.dashSvc.fetchGroups().pipe(
                tap((res: Group[]) => {
                  this.dashSvc.dashboardPage.set('groups');
                  this.dashSvc.groups.set(res);
                  this.dashSvc.displayedGroups.set(this.dashSvc.groups());
                }),
                catchError(err => {
                  console.error('Fetching groups failed:', err);
                  throw err;
                })
              );

            // Titles
            case 'group':
              return this.dashSvc.fetchTitles(group_id).pipe(
                tap((res: GroupPage) => {
                  this.dashSvc.dashboardPage.set('titles');
                  this.dashSvc.selectedGroupPage.set(res);
                  this.dashSvc.titles.set(res.titles);
                  this.dashSvc.displayedTitles.set(res.titles);
                  this.title.setTitle(`Skupina: ${res.name} | Skeny`);
                  
                  this.authSvc.canReadTitle.set(false);
                  if (this.authSvc.user()?.permissions.find(group => group.group_id === group_id && group.permission.includes('read_title'))) this.authSvc.canReadTitle.set(true);
                  
                  clearTimeout(this.timerTooltip);
                  this.visibleTooltip = false;
                }),
                catchError(err => {
                  if (err.status === 403) this.router.navigate(['/forbidden']);
                  console.error('Fetching titles failed:', err);
                  throw err;
                })
              );

            // Users
            case 'users':
              return this.dashSvc.fetchUsers().pipe(
                tap((res: User[]) => {
                  this.dashSvc.dashboardPage.set('users');
                  this.dashSvc.users.set(res);
                  this.dashSvc.displayedUsers.set(res);
                }),
                catchError(err => {
                  if (err.status === 403) this.router.navigate(['/forbidden']);
                  console.error('Fetching users failed:', err);
                  throw err;
                })
              );

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

            this.tableHasScrollbar.set(this.osInstance.state().hasOverflow.y);
          }, 100);
        });
  }

  ngOnDestroy(): void {
    this.paramsOnGroupId.unsubscribe();
    this.osInstance?.destroy();
    this.osInstance = undefined;
  }


  /* ------------------------------
    GROUPS
  ------------------------------ */
  permissionDict = permissionDict;
  
  get totalGroupsLabel(): string {
    const length = this.dashSvc.displayedGroups().length;
    return `Celkem ${length} skupin${length === 1 ? 'a' : [2, 3, 4].includes(length) ? 'y' : '' }`;
  }

  filterGroups(): void {
    const searchGroups = this.dashSvc.searchGroups();
    this.dashSvc.displayedGroups.set(this.dashSvc.groups().filter(g => 
      g.name.toLowerCase().includes(searchGroups)
      || g.description.toLowerCase().includes(searchGroups)
      || g._id.toLowerCase().includes(searchGroups)
    ));
  }

  getUsersShort(group: Group): UserInGroup[] {
    return group.users?.slice(0, this.maxUsers) ?? [];
  }

  getUsersLong(group: Group): UserInGroup[] {
    return group.users ?? [];
  }


  /* ------------------------------
    TITLES
  ------------------------------ */
  titleStateDict = titleStateDict;

  get totalTitlesLabel(): string {
    const length = this.dashSvc.displayedTitles().length;
    return `Celkem ${length} knih${length === 1 ? 'a' : [2, 3, 4].includes(length) ? 'y' : '' }`;
  }

  filterTitles(): void {
    const searchTitles = this.dashSvc.searchTitles();
    this.dashSvc.displayedTitles.set(this.dashSvc.titles().filter(t => 
      (t.external_id ?? '').toLowerCase().includes(searchTitles)
      || t._id.toLowerCase().includes(searchTitles)
      || (t.model ?? '').toLowerCase().includes(searchTitles)
    ));
  }

  shouldHaveLink(state: string): boolean {
    return ['ready', 'user_approved', 'completed'].includes(state);
  }

  // Hover
  visibleTooltip = false;
  positionTooltip: Position = { x: 0, y: 0 };
  private timerTooltip: any;

  showTooltip(event: MouseEvent, isClickable: boolean): void {
    this.clearTimerTooltip();
    if (!isClickable) return;

    this.timerTooltip = setTimeout(() => {
      this.visibleTooltip = true;
      this.updatePosition(event);
    }, 500);
  }

  onActionsHover(event: MouseEvent): void {
    event.stopPropagation();
    this.clearTimerTooltip();
    this.visibleTooltip = false;
  }

  clearTimerTooltip(): void {
    clearTimeout(this.timerTooltip);
    this.visibleTooltip = false;
  }

  private updatePosition(event: MouseEvent): void {
    this.positionTooltip = {
      x: event.clientX + 12,
      y: event.clientY + 12
    };
  }

  // State filter
  titleStateFilterDict = titleStateFilterDict;
  stateDropdownOpen = false;
  selectedState: string | null = 'all';
  stateOptions = Object.keys(titleStateFilterDict);

  toggleStateDropdown(): void {
    this.stateDropdownOpen = !this.stateDropdownOpen;
  }

  onStateChange(stateValue: string): void {
    this.selectedState = stateValue;
    this.stateDropdownOpen = false;

    switch (stateValue) {
      case 'all':
        this.dashSvc.displayedTitles.set(this.dashSvc.titles());
        break;
      case 'saved':
        this.dashSvc.displayedTitles.set(this.dashSvc.titles().filter(t => ['user_approved', 'completed'].includes(t.state)));
        break;
      default:
        this.dashSvc.displayedTitles.set(this.dashSvc.titles().filter(t => t.state === stateValue));
        break;
    }
  }


  /* ------------------------------
    USERS
  ------------------------------ */
  get totalUsersLabel(): string {
    const length = this.dashSvc.displayedUsers().length;
    return `Celkem ${length} uživatel${[2, 3, 4].includes(length) ? 'é' : 'ů' }`;
  }

  filterUsers(): void {
    this.dashSvc.displayedUsers.set(this.dashSvc.users().filter(u => u.full_name.toLowerCase().includes(this.dashSvc.searchUsers())));

    const searchUsers = this.dashSvc.searchUsers();
    this.dashSvc.displayedUsers.set(this.dashSvc.users().filter(u => 
      u.full_name.toLowerCase().includes(searchUsers)
      || u.email.toLowerCase().includes(searchUsers)
      || u._id.toLowerCase().includes(searchUsers)
    ));
  }

  getGroupsShort(user: User): Permission[] {
    return user.permissions.slice(0, this.maxGroups);
  }

  getGroupsLong(user: User): Permission[] {
    return user.permissions;
  }
}
