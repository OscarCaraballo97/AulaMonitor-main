// Ruta: iMonitoringApp/src/app/interceptor/jwt.interceptor.ts

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, switchMap, catchError, throwError, Subject } from 'rxjs';
import { AuthService } from '../services/auth.service'; // Importar AuthResponse
import { environment } from '../../environments/environment';
import { finalize, take } from 'rxjs/operators';
import { AuthResponse } from '../models/auth.model';

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
            if (error.status === 401 && !clonedReq.url.includes('/auth/refresh-token')) { // Asegurarse de no entrar en un bucle con el refresh token
              return authService.refreshToken().pipe(
                switchMap((response: AuthResponse | null) => { // Tipar 'response'
                  if (response && response.token) {
                    const newClonedReq = req.clone({ setHeaders: { Authorization: `Bearer ${response.token}` } });
                    return next(newClonedReq);
                  } else {
                    authService.logout();
                    return throwError(() => new Error('Sesión expirada. Por favor, inicia sesión de nuevo.'));
                  }
                }),
                catchError(refreshError => {
                  console.error('Refresh token failed:', refreshError);
                  authService.logout();
                  return throwError(() => new Error('Sesión expirada. Por favor, inicia sesión de nuevo.'));
                })
              );
            } else if (error.status === 403) {
              // CORRECCIÓN: Llamar a handleError con un solo argumento
              authService.handleError(error); // handleError ya maneja el mensaje de error
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