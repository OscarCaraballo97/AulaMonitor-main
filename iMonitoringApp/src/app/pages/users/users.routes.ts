import { Routes } from '@angular/router';

export const USER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list/user-list.page').then(m => m.UserListPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./user-form/user-form.page').then(m => m.UserFormPage),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./user-form/user-form.page').then(m => m.UserFormPage),
  },
];