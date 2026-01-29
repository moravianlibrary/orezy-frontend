import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { DashboardPage, DrawerButton, DrawerContentType, Group, GroupDetail, Title } from '../app.types';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService);
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
  groupName = signal<string>('');


  /* ------------------------------
    API
  ------------------------------ */
  fetchGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.authSvc.apiUrl}/groups`, { headers: this.authSvc.authHeaders() });
  }

  fetchTitles(group_id: string): Observable<GroupDetail> {
    return this.http.get<GroupDetail>(`${this.authSvc.apiUrl}/groups/${group_id}`, { headers: this.authSvc.authHeaders() });
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

  addGroup(): void {
    console.log('add group');
  }

  deleteGroup(): void {
    console.log('delete group');
  }

  openGroupDetail(group: Group): void {
    this.selectedGroup.set(group);
    this.groupName.set(group.name);
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

  copy(text: string) {
    navigator.clipboard.writeText(text);
  }
}