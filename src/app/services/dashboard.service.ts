import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
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
  groups = signal<Group[]>([]);
  displayedGroups = signal<Group[]>([]);
  searchGroups = signal<string>('');
  selectedGroup = signal<GroupDetail | null>(null);
  titles = signal<Title[]>([]);
  displayedTitles = signal<Title[]>([]);
  searchTitles = signal<string>('');


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
  openMyGroupsTitles(group: Group): void {
    this.dashboardPage.set('my-groups-titles');
    this.router.navigate(['/group', group._id]);
  }

  backToMyGroups(): void {
    this.dashboardPage.set('my-groups');
    this.location.back();
  }

  openTitle(bookId: string): void {
    this.router.navigate(['/book', bookId]);
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
  }
}