import { Component, inject, signal } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { permissionDict, titleStateDict } from '../../app.config';
import { Group, UserInGroup } from '../../app.types';

@Component({
  selector: 'app-main-groups',
  imports: [FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  dashSvc = inject(DashboardService);
  authSvc = inject(AuthService);

  maxUsers: number = 3;


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

  getDate(input: string): string[] {
    const date = new Date(input);
    return date
      .toLocaleString('cs-CZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      .replace(/\. /g, '.')
      .split(' ');
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
