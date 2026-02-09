import { Routes } from '@angular/router';
import { AuthService } from './services/auth.service';

export const routes: Routes = [
  {
    path: 'login',
    pathMatch: 'full',
    loadComponent: () => import('./routes/login/login.component').then((m) => m.LoginComponent),
    title: 'Přihlášení | Skeny'
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./routes/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Moje skupiny | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'group/:group_id',
    pathMatch: 'full',
    loadComponent: () => import('./routes/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Moje skupiny - Knihy | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'groups',
    pathMatch: 'full',
    loadComponent: () => import('./routes/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Správa skupin | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'users',
    pathMatch: 'full',
    loadComponent: () => import('./routes/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Správa uživatelů | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'book/:book_id',
    pathMatch: 'full',
    loadComponent: () => import('./routes/editor/editor.component').then((m) => m.EditorComponent),
    title: 'Kontrola a úpravy | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./routes/errors/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
    title: 'Nemáte oprávnění | Skeny'
  },
  {
    path: '**',
    loadComponent: () => import('./routes/errors/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Stránka nenalezena | Skeny'
  }
];
