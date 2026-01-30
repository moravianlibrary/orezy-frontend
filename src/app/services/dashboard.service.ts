import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { DashboardPage, DrawerButton, DrawerContentType, Group, GroupDetail, NewGroup, PermissionType, Title } from '../app.types';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { EditorService } from './editor.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService);
  private edtSvc = inject(EditorService);
  private router = inject(Router);
  private location = inject(Location)

  dashboardPage = signal<DashboardPage>('my-groups');

  // My groups
  myGroups = signal<Group[]>([]);
  displayedMyGroups = signal<Group[]>([]);
  searchMyGroups = signal<string>('');
  selectedMyGroup = signal<GroupDetail | null>(null);
  titles = signal<Title[]>([]);
  displayedTitles = signal<Title[]>([]);
  searchTitles = signal<string>('');

  // Groups
  groups = computed(() => this.myGroups().filter(g => g.permission === 'manage'));
  displayedGroups = signal<Group[]>([]);
  searchGroups = signal<string>('');
  selectedGroup = signal<Group | null>(null);
  selectedGroupId = signal<string>('');
  newGroupName = signal<string>('');
  newGroupDescription = signal<string>('');


  /* ------------------------------
    API
  ------------------------------ */
  fetchGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.authSvc.apiUrl}/groups`, { headers: this.authSvc.authHeaders() });
  }

  fetchTitles(group_id: string): Observable<GroupDetail> {
    return this.http.get<GroupDetail>(`${this.authSvc.apiUrl}/groups/${group_id}`, { headers: this.authSvc.authHeaders() });
  }

  createGroup(): Observable<NewGroup> {
    const payload = {
      name: this.newGroupName(),
      description: this.newGroupDescription()
    };
    return this.http.post<NewGroup>(`${this.authSvc.apiUrl}/groups`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }

  deleteGroup(group_id: string): Observable<void> {
    return this.http.delete<void>(`${this.authSvc.apiUrl}/groups/${group_id}`, { headers: this.authSvc.authHeaders() });
  }


  /* ------------------------------
    DASHBOARD PAGES
  ------------------------------ */
  navigateToMyGroups(): void {
    this.closeDrawer();
    this.dashboardPage.set('my-groups');
    this.router.navigate(['/']);
  }
  
  openMyGroupsTitles(group: Group): void {
    this.dashboardPage.set('my-groups-titles');
    this.router.navigate(['/group', group._id]);
  }

  backToMyGroups(): void {
    this.dashboardPage.set('my-groups');
    this.location.back();
  }

  openTitle(bookId: string): void {
    window.location.href = `${this.authSvc.baseUri}/book/${bookId}`;
    // this.router.navigate(['/book', bookId]);
  }

  navigateToGroups(): void {
    this.closeDrawer();
    this.dashboardPage.set('groups');
    this.router.navigate(['/groups']);
  }


  /* ------------------------------
    DRAWER ACTIONS
  ------------------------------ */
  drawerOpen = signal<boolean>(false);
  drawerTitle = signal<string>('');
  drawerContent = signal<boolean>(false);
  drawerContentType = signal<DrawerContentType | null>(null);
  drawerDescription = signal<string | null>(null);
  drawerButtons = signal<DrawerButton[]>([]);
  
  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);

    if (this.dashboardPage() === 'groups') this.selectedGroup.set(null);
  }

  openGroupDetail(group: Group | null): void {
    if (!group) return;
    
    this.selectedGroup.set(group);
    this.drawerTitle.set(group.name);
    this.drawerContent.set(true);
    this.drawerContentType.set('groups');
    this.drawerButtons.set([
      {
        label: 'Zavřít',
        action: () => this.closeDrawer()
      },
      {
        label: 'Uložit změny',
        primary: true,
        action: () => {
          console.log('save');
        }
      }
    ])

    this.openDrawer();
  }

  createGroupDialog(): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Nová skupina');
    edtSvc.dialogContent.set(true);
    edtSvc.dialogContentType.set('new-group');
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Vytvořit',
        primary: true,
        action: () => this.createGroup().pipe(
          tap((res: NewGroup) => {
            const now = Date();
            const newGroup = {
              _id: res.id,
              name: this.newGroupName(),
              api: res?.api ?? '',
              description: this.newGroupDescription(),
              created_at: now,
              modified_at: now,
              title_count: 0,
              permission: 'manage' as PermissionType
            };

            this.myGroups.update(prev => [ ...prev, newGroup ]);
            this.displayedGroups.set(this.myGroups());
            this.selectedGroup.set(newGroup);
            this.newGroupName.set('');
            this.newGroupDescription.set('');
          }),
          catchError(err => {
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.openGroupDetail(this.selectedGroup()))
      }
    ])

    this.closeDrawer();
    edtSvc.openDialog();
  }

  deleteGroupDialog(group: Group | null): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Smazat skupinu');
    edtSvc.dialogDescription.set(`Opravdu chcete smazat skupinu${' ' + group?.name}?`);
    edtSvc.dialogContent.set(false);
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Smazat skupinu',
        primary: true,
        destructive: true,
        action: () => this.deleteGroup(group?._id ?? '').pipe(
          tap(() => {
            const updated = this.myGroups().filter(g => g._id !== group?._id);
            this.myGroups.set(updated);
            this.displayedGroups.set(updated);
            this.selectedGroup.set(null);
          }),
          catchError(err => {
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.closeDrawer())
      }
    ])

    edtSvc.openDialog();
  }

  copy(text: string) {
    navigator.clipboard.writeText(text);
  }
}