import { Routes } from '@angular/router';

export const CLASSROOMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./classroom-list/classroom-list.page').then(m => m.ClassroomListPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./classroom-form/classroom-form.page').then(m => m.ClassroomFormPage),
   
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./classroom-form/classroom-form.page').then(m => m.ClassroomFormPage),

  },
  {
    path: 'availability',
    loadComponent: () => import('./classroom-availability/classroom-availability.page').then(m => m.ClassroomAvailabilityPage),

  },
  {
    path: ':classroomId/availability',
    loadComponent: () => import('./classroom-availability/classroom-availability.page').then(m => m.ClassroomAvailabilityPage),
  }
];
