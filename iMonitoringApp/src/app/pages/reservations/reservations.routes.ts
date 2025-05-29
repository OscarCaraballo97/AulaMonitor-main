import { Routes } from '@angular/router';
import { ReservationListPage } from './reservation-list/reservation-list.page';
import { ReservationFormPage } from './reservation-form/reservation-form.page';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service'; 
import { Rol } from '../../models/rol.model';  

export const RESERVATIONS_ROUTES: Routes = [
  {
    path: 'my-list',
    component: ReservationListPage,
    data: { viewContext: 'my', title: 'Mis Reservas' }
  },
  {
    path: 'all',
    component: ReservationListPage,
    data: { viewContext: 'all', title: 'Gestión de Reservas' },
    canMatch: [() => inject(AuthService).hasAnyRole([Rol.ADMIN, Rol.COORDINADOR])]
  },
  {
    path: 'new',
    component: ReservationFormPage,
    data: { title: 'Nueva Reserva' }
  },
  {
    path: 'edit/:id',
    component: ReservationFormPage,
    data: { title: 'Editar Reserva' }
  },
  {
    path: '',
    redirectTo: 'my-list',
    pathMatch: 'full'
  }
];
