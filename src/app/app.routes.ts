import { Routes } from '@angular/router';
import { AuthService } from './services/auth.service';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./routes/groups/groups.component').then((m) => m.GroupsComponent),
    title: 'Skupiny | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'admin',
    pathMatch: 'full',
    loadComponent: () => import('./routes/admin/admin.component').then((m) => m.AdminComponent),
    title: 'Admin | Skeny',
    canActivate: [ AuthService ]
  },
  {
    path: 'login',
    pathMatch: 'full',
    loadComponent: () => import('./routes/login/login.component').then((m) => m.LoginComponent),
    title: 'Přihlášení | Skeny'
  },
  {
    path: 'book/:id',
    pathMatch: 'full',
    loadComponent: () => import('./routes/editor/editor.component').then((m) => m.EditorComponent),
    title: 'Kontrola a úpravy | Skeny',
    canActivate: [ AuthService ]
  },  
  {
    path: '**',
    loadComponent: () => import('./routes/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Stránka nenalezena | Skeny'
  }
];
