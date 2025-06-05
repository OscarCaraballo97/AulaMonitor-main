import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, from, throwError, forkJoin, of, lastValueFrom, Subject } from 'rxjs';
import { catchError, map, tap, switchMap, finalize, take } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../environments/environment';
import { LoginCredentials, AuthResponse, PasswordChangeRequest, PasswordResetRequest, RegisterData } from '../models/auth.model';
import { User } from '../models/user.model';
import { Rol } from '../models/rol.model';

export interface AuthData {
  user: User | null;
  role: Rol | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private _storage: Storage | null = null;

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated = this.isAuthenticatedSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();

  private currentUserRoleSubject = new BehaviorSubject<Rol | null>(null);
  public currentUserRole = this.currentUserRoleSubject.asObservable();

  private isAuthReadySubject = new BehaviorSubject<boolean>(false);
  public isAuthReady = this.isAuthReadySubject.asObservable();

  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private isRefreshingToken = false;
  private tokenRefreshSubject: Subject<AuthResponse | null> = new Subject<AuthResponse | null>();


  constructor() {
    this.initStorage().then(() => {
      this.loadToken();
    });
  }

  async initStorage() {
    const storageInstance = new Storage({
      name: '__aulamonitor_db',
      storeName: 'auth_data',
      driverOrder: ['indexeddb', 'sqlite', 'websql']
    });
    this._storage = await storageInstance.create();
    console.log('[AuthService] Storage inicializado.');
  }

  public handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = `Error en la operación: `;
    if (error.error instanceof ErrorEvent) {
      errorMessage += `Error de red o cliente: ${error.error.message}`;
    } else {
      const serverErrorMessage = error.error?.message || error.error?.error || error.message || 'Error del servidor desconocido';
      errorMessage += `Código ${error.status}, mensaje: ${serverErrorMessage}`;
      if (error.status === 0) {
        errorMessage = `No se pudo conectar con el servidor. Verifica la conexión o el estado del servidor.`;
      } else if (error.status === 401) {
        errorMessage = 'Correo electrónico o contraseña incorrectos, o sesión expirada.';
      } else if (error.status === 403) {
        errorMessage = 'No tienes permiso para realizar esta acción.';
      }
    }
    console.error(`[AuthService] ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }


  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/authenticate`, credentials)
      .pipe(
        tap(async (response: AuthResponse) => {
          if (response && response.token) {
            await this.processToken(response.token, response.refreshToken);
          } else {
            this.isAuthenticatedSubject.next(false);
            this.currentUserSubject.next(null);
            this.currentUserRoleSubject.next(null);
          }
        }),
        catchError(err => this.handleError(err))
      );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/register`, data)
      .pipe(
        tap((response: AuthResponse) => {
          console.log('[AuthService - register] Respuesta:', response);
        }),
        catchError(err => this.handleError(err))
      );
  }

  public async processToken(token: string, refreshToken?: string) {
    if (!this._storage) await this.initStorage();

    await this._storage?.set(this.TOKEN_KEY, token);
    if (refreshToken) {
      await this._storage?.set(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    const decodedToken: any = this.decodeToken(token);

    if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
      const userRoleEnum: Rol = decodedToken.role ? Rol[decodedToken.role as keyof typeof Rol] : Rol.ESTUDIANTE;
      const user: User = {
        id: decodedToken.userId,
        name: decodedToken.name,
        email: decodedToken.sub,
        role: userRoleEnum,
        avatarUrl: decodedToken.avatarUrl,
        enabled: decodedToken.enabled !== undefined ? decodedToken.enabled : true
      };
      this.currentUserSubject.next(user);
      this.currentUserRoleSubject.next(userRoleEnum);
      this.isAuthenticatedSubject.next(true);
    } else {
      console.log('Access token expired during processToken, attempting refresh...');
      try {
        const newToken = await lastValueFrom(this.refreshToken());
        if (!newToken) {
          throw new Error('Refresh token failed to provide a new access token.');
        }
      } catch (refreshErr) {
        console.error('Failed to refresh token during processToken, logging out:', refreshErr);
        await this.logout(false);
      }
    }
  }

  public refreshToken(): Observable<AuthResponse | null> {
    if (this.isRefreshingToken) {
      return this.tokenRefreshSubject.asObservable().pipe(take(1));
    }

    this.isRefreshingToken = true;
    this.tokenRefreshSubject = new Subject<AuthResponse | null>();

    return from(this.getRefreshToken()).pipe(
      switchMap((refreshToken: string | null) => {
        if (!refreshToken) {
          console.error('No refresh token found, logging out.');
          this.logout();
          this.tokenRefreshSubject.next(null);
          this.tokenRefreshSubject.complete();
          return of(null);
        }

        return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/refresh-token`, { refreshToken: refreshToken })
          .pipe(
            tap(async (response: AuthResponse) => {
              if (response && response.token) {
                await this.processToken(response.token, response.refreshToken);
                this.tokenRefreshSubject.next(response);
                this.tokenRefreshSubject.complete();
              } else {
                console.error('Refresh token response invalid, logging out.');
                this.logout();
                this.tokenRefreshSubject.next(null);
                this.tokenRefreshSubject.complete();
              }
            }),
            catchError(err => {
              console.error('Error refreshing token:', err);
              this.logout();
              this.tokenRefreshSubject.next(null);
              this.tokenRefreshSubject.complete();
              return throwError(() => new Error('Failed to refresh token.'));
            }),
            finalize(() => {
              this.isRefreshingToken = false;
            })
          );
      }),
      map(response => response || null)
    );
  }

  private decodeToken(token: string): any {
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error("[AuthService] Error decodificando token:", error);
      return null;
    }
  }

  async loadToken() {
    if (!this._storage) await this.initStorage();
    try {
        const token = await this._storage?.get(this.TOKEN_KEY);
        if (token) {
            await this.processToken(token);
        } else {
            this.isAuthenticatedSubject.next(false);
            this.currentUserSubject.next(null);
            this.currentUserRoleSubject.next(null);
        }
    } catch (error) {
        this.isAuthenticatedSubject.next(false);
        console.error('[AuthService] Error en loadToken:', error);
    } finally {
        this.isAuthReadySubject.next(true);
    }
  }

  async logout(navigate: boolean = true) {
    if (!this._storage) await this.initStorage();
    await this._storage?.remove(this.TOKEN_KEY);
    await this._storage?.remove(this.REFRESH_TOKEN_KEY);
    await this._storage?.remove('current-user');
    this.currentUserSubject.next(null);
    this.currentUserRoleSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    if (navigate) {
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  verifyEmail(token: string): Observable<string> {
    return this.http.get(`${environment.apiUrl}/api/auth/verify-email?token=${token}`, { responseType: 'text' })
      .pipe(catchError(err => this.handleError(err)));
  }

  requestPasswordReset(emailReq: { email: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/api/auth/forgot-password`, emailReq)
      .pipe(catchError(err => this.handleError(err)));
  }

  resetPassword(data: PasswordResetRequest): Observable<any> {
    return this.http.post(`${environment.apiUrl}/api/auth/reset-password`, data)
      .pipe(catchError(err => this.handleError(err)));
  }

  changePassword(data: PasswordChangeRequest): Observable<any> {
      return this.http.patch<any>(`${environment.apiUrl}/api/users/me/password`, data)
          .pipe(catchError(err => this.handleError(err)));
  }

  public getCurrentUser(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  public getCurrentUserRole(): Observable<Rol | null> {
    return this.currentUserRoleSubject.asObservable();
  }

  public getCurrentUserWithRole(): Observable<AuthData | null> {
    return forkJoin({
      user: this.getCurrentUser(),
      role: this.getCurrentUserRole()
    }).pipe(
      map(results => {
        if (results.user !== null && results.role !== null) {
          return { user: results.user, role: results.role };
        }
        return null;
      })
    );
  }

  public async getToken(): Promise<string | null> {
    if (!this._storage) await this.initStorage();
    return this._storage?.get(this.TOKEN_KEY);
  }

  public async getRefreshToken(): Promise<string | null> {
    if (!this._storage) await this.initStorage();
    return this._storage?.get(this.REFRESH_TOKEN_KEY);
  }

  public updateCurrentUser(updatedUser: User) {
    const current = this.currentUserSubject.getValue();
    if (current && current.id === updatedUser.id) {
      const newUserState = { ...current, ...updatedUser };
      this.currentUserSubject.next(newUserState);
      if(updatedUser.role && updatedUser.role !== current.role) {
        this.currentUserRoleSubject.next(updatedUser.role);
      }
      this._storage?.set('current-user', newUserState);
      console.log('[AuthService] Current user updated in BehaviorSubject and Storage:', newUserState);
    }
  }

  public async hasAnyRole(allowedRoles: Rol[]): Promise<boolean> {
    await lastValueFrom(this.isAuthReady.pipe(take(1)));
    const currentRole = this.currentUserRoleSubject.getValue();
    const isAuthenticated = this.isAuthenticatedSubject.getValue();
    const hasPermission = isAuthenticated && currentRole !== null && allowedRoles.includes(currentRole);
    if(!hasPermission) {
        console.warn(`[AuthGuard] Acceso denegado por rol. Rol actual: ${currentRole}, Roles permitidos: ${allowedRoles.join(', ')}`);
    }
    return hasPermission;
  }

  public async hasRole(role: Rol): Promise<boolean> {
    return this.hasAnyRole([role]);
  }

}