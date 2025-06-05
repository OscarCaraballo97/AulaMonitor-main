import { Routes } from '@angular/router';
import { ReservationListPage } from './reservation-list/reservation-list.page';
import { ReservationFormPage } from './reservation-form/reservation-form.page';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model';

const canAccessAllReservations = () => inject(AuthService).hasAnyRole([Rol.ADMIN, Rol.COORDINADOR]);
const canCreateOrEditReservations = () => inject(AuthService).hasAnyRole([Rol.ADMIN, Rol.COORDINADOR, Rol.PROFESOR, Rol.ESTUDIANTE, Rol.TUTOR]);

export const RESERVATIONS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'my-list',
    pathMatch: 'full',
  },
  {
    path: 'list', 
    component: ReservationListPage,
    canActivate: [canAccessAllReservations],
    data: { title: 'Todas las Reservas' }
  },
  {
    path: 'my-list',
    component: ReservationListPage,
    data: { title: 'Mis Reservas' }
  },
  {
    path: 'new',
    component: ReservationFormPage,
    canActivate: [canCreateOrEditReservations],
    data: { title: 'Nueva Reserva' }
  },
  {
    path: 'edit/:id',
    component: ReservationFormPage,
    canActivate: [canCreateOrEditReservations],
    data: { title: 'Editar Reserva' }
  },
];