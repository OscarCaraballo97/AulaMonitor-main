
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, switchMap, catchError, throwError, Subject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { finalize, take } from 'rxjs/operators';

export const jwtInterceptorFn: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const apiUrl = environment.apiUrl;
  const isApiUrl = req.url.startsWith(apiUrl);
  const isAuthPath = req.url.includes('/auth/register') || req.url.includes('/auth/authenticate') || req.url.includes('/auth/refresh-token') || req.url.includes('/auth/forgot-password') || req.url.includes('/auth/reset-password') || req.url.includes('/auth/verify-email');


  if (isApiUrl && !isAuthPath) {
    return from(authService.getToken()).pipe(
      switchMap(token => {
        let clonedReq = req;
        if (token) {
          clonedReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
        }

        return next(clonedReq).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
              return authService.refreshToken().pipe( 
                switchMap(newToken => {
                  if (newToken) {
                    const newClonedReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
                    return next(newClonedReq);
                  } else {
                    authService.logout();
                    return throwError(() => new Error('Session expired. Please log in again.'));
                  }
                }),
                catchError(refreshError => {
                  console.error('Refresh token failed:', refreshError);
                  authService.logout();
                  return throwError(() => new Error('Session expired. Please log in again.'));
                })
              );
            } else if (error.status === 403) {
             
              authService.handleError(error, 'acceso no autorizado');
              return throwError(() => new Error('No tienes permiso para acceder a este recurso.'));
            }
            return throwError(() => error);
          })
        );
      })
    );
  }
  return next(req);
};