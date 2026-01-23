import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Group, Title } from '../app.types';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService);

  groups = signal<Group[]>([]);
  displayedGroups = signal<Group[]>([]);


  /* ------------------------------
    API
  ------------------------------ */
  fetchGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.authSvc.apiUrl}/groups/`, { headers: this.authSvc.authHeaders() });
  }

  fetchAllTitles(): Observable<Title[]> {
    return this.http.get<Title[]>(`${this.authSvc.apiUrl}/titles`, { headers: this.authSvc.authHeaders() });
  }
}