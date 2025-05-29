
import { Routes } from '@angular/router';
export const BUILDING_ROUTES: Routes = [ 
  {
    path: '',
    loadComponent: () => import('./building-list/building-list.page').then(m => m.BuildingListPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./building-form/building-form.page').then(m => m.BuildingFormPage),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./building-form/building-form.page').then(m => m.BuildingFormPage),
  },
];