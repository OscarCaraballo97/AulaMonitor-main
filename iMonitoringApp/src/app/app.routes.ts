import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard'; 
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service'; 
import { Rol } from './models/rol.model';  

const canMatchAdminOrCoordinator = () => inject(AuthService).hasAnyRole([Rol.ADMIN, Rol.COORDINADOR]);
const canMatchAdmin = () => inject(AuthService).hasRole(Rol.ADMIN); // Asegúrate de que esta línea esté presente si la usas en otro lugar

export const routes: Routes = [
  {
    path: '',
   redirectTo: 'login',
   pathMatch: 'full',
  },
  {
   path: 'login',
   loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email/verify-email.page').then( m => m.VerifyEmailPage)
  },
  {
   path: 'app',
    loadComponent: () => import('./main-layout/main-layout.page').then((m) => m.MainLayoutPage),
    canActivate: [authGuard], 
    children: [
      {
       path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'reservations',
        loadChildren: () => import('./pages/reservations/reservations.routes').then(m => m.RESERVATIONS_ROUTES)
      },
      {
        path: 'classrooms',
        loadChildren: () => import('./pages/classrooms/classrooms.routes').then(m => m.CLASSROOMS_ROUTES),
       // Se ha eliminado canMatch para permitir acceso a todos los usuarios autenticados
      },
      {
        path: 'buildings',
        loadChildren: () => import('./pages/buildings/buildings.routes').then(m => m.BUILDING_ROUTES),
        canMatch: [canMatchAdminOrCoordinator]
      },
      {
        path: 'users',
        loadChildren: () => import('./pages/users/users.routes').then(m => m.USER_ROUTES),
        canMatch: [canMatchAdminOrCoordinator]
        },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
      },
      {
        path: 'test-ionic',
        loadComponent: () => import('./pages/test-ionic/test-ionic.page').then( m => m.TestIonicPage)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  { path: '**', redirectTo: '/login', pathMatch: 'full' } 
];