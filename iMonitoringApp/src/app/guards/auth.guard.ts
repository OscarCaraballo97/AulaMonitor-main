import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated.pipe(
    take(1), 
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      } else {
        console.log('[AuthGuard] Usuario no autenticado, redirigiendo a login.');
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
    })
  );
};