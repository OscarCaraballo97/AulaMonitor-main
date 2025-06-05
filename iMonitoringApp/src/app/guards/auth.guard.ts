import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs'; 
import { map, take, switchMap, tap } from 'rxjs/operators';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthReady.pipe(
    take(1), 
    switchMap(isReady => {
      if (!isReady) {
        console.warn('[AuthGuard] AuthService no está listo, redirigiendo a login.');
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return of(false);
      }
      return authService.isAuthenticated.pipe(
        take(1),
        tap(isAuthenticated => {
          if (!isAuthenticated) {
            console.log('[AuthGuard] Usuario no autenticado, redirigiendo a login.');
            router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          }
        }),
        map(isAuthenticated => isAuthenticated)
      );
    })
  );
};