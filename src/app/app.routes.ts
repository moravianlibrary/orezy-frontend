import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'book/'
  },
  {
    path: 'book',
    pathMatch: 'full',
    redirectTo: 'book/'
  },
  {
    path: 'book/:id',
    pathMatch: 'full',
    loadComponent: () => import('./routes/editor/editor.component').then((m) => m.EditorComponent)
  },
  {
    path: 'books',
    pathMatch: 'full',
    loadComponent: () => import('./routes/examples/examples.component').then((m) => m.ExamplesComponent)
  }
];
