
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service'; 
import { environment } from '../../environments/environment';

export const jwtInterceptorFn: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const apiUrl = environment.apiUrl;
    const isApiUrl = req.url.startsWith(apiUrl);
    const isAuthPath = req.url.includes('/auth/register') || req.url.includes('/auth/authenticate');

    if (isApiUrl && !isAuthPath) {
        return from(authService.getToken()).pipe(
            switchMap(token => {
                if (token) {
                    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
                }
                return next(req);
            })
        );
    }
    return next(req);
};