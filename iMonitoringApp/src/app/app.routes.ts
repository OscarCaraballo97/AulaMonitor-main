import { Routes } from '@angular/router';
import { authGuardFn } from './guards/auth.guard'; 
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Rol } from './models/rol.model';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email/verify-email.page').then(m => m.VerifyEmailPage)
  },
  {
    path: 'app',
    loadComponent: () => import('./main-layout/main-layout.page').then(m => m.MainLayoutPage),
    canActivate: [authGuardFn],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: { title: 'Dashboard' }
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
        data: { title: 'Mi Perfil' }
      },
      {
        path: 'users',
        loadChildren: () => import('./pages/users/users.routes').then(m => m.USER_ROUTES),
        canMatch: [() => inject(AuthService).hasAnyRole([Rol.ADMIN, Rol.COORDINADOR])],
        data: { title: 'Gestión de Usuarios' }
      },
      {
        path: 'reservations',
        loadChildren: () => import('./pages/reservations/reservations.routes').then(m => m.RESERVATIONS_ROUTES),
        data: { title: 'Reservas' }
      },
      {
        path: 'classrooms',
        loadChildren: () => import('./pages/classrooms/classrooms.routes').then(m => m.CLASSROOMS_ROUTES),
        data: { title: 'Aulas' }
      },
      {
        path: 'buildings',
        loadChildren: () => import('./pages/buildings/buildings.routes').then(m => m.BUILDING_ROUTES),
        canMatch: [() => inject(AuthService).hasRole(Rol.ADMIN)],
        data: { title: 'Edificios' }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];