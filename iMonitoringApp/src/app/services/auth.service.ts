import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, forkJoin, of, Subject, from, lastValueFrom } from 'rxjs';
import { catchError, tap, map, switchMap, finalize, take } from 'rxjs/operators'; // Added 'switchMap', 'finalize', 'take'
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { AuthResponse, LoginCredentials, RegisterData, PasswordResetRequest, PasswordChangeRequest } from '../models/auth.model';
import { Rol } from '../models/rol.model';
import { Storage } from '@ionic/storage-angular';
import { Router } from '@angular/router';

export interface AuthData {
  user: User | null;
  role: Rol | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private _storage: Storage | null = null;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();

  private currentUserRoleSubject = new BehaviorSubject<Rol | null>(null);
  public currentUserRole = this.currentUserRoleSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated = this.isAuthenticatedSubject.asObservable();

  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private isRefreshingToken = false;
  private tokenRefreshSubject: Subject<string | null> = new Subject<string | null>();

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private router: Router
  ) {
    this.initStorage().then(() => {
      this.loadToken();
    });
  }

  async initStorage() {
    if (!this._storage) {
        const storageInstance = await this.storage.create();
        this._storage = storageInstance;
        console.log('[AuthService] Storage inicializado.');
    }
  }

  public handleError(error: HttpErrorResponse, operation: string = 'operación') {
    let errorMessage = `Error en ${operation}: `;
    if (error.error instanceof ErrorEvent) {
      errorMessage += `Error de red o cliente: ${error.error.message}`;
    } else {
      const serverErrorMessage = error.error?.message || error.error?.error || error.message || 'Error del servidor desconocido';
      errorMessage += `Código ${error.status}, mensaje: ${serverErrorMessage}`;
      if (error.status === 0) {
        errorMessage = `No se pudo conectar con el servidor para ${operation}. Verifica la conexión o el estado del servidor.`;
      } else if (error.status === 401 && operation === 'login') {
        errorMessage = 'Correo electrónico o contraseña incorrectos.';
      } else if (error.status === 403) {
        errorMessage = 'No tienes permiso para realizar esta acción.';
      }
    }
    console.error(`[AuthService] ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/authenticate`, credentials)
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
        catchError(err => this.handleError(err, 'login'))
      );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data)
      .pipe(
        tap((response: AuthResponse) => {
          console.log('[AuthService - register] Respuesta:', response);
        }),
        catchError(err => this.handleError(err, 'registro'))
      );
  }

  public async processToken(token: string, refreshToken?: string) {
    if (!this._storage) await this.initStorage();

    await this._storage?.set(this.TOKEN_KEY, token);
    if (refreshToken) {
      await this._storage?.set(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    const decodedToken = this.decodeToken(token);

    if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
      const userRoleEnum = decodedToken.role ? decodedToken.role.toUpperCase() as Rol : undefined;
      const user: User = {
        id: decodedToken.userId,
        name: decodedToken.name,
        email: decodedToken.sub,
        role: userRoleEnum,
        avatarUrl: decodedToken.avatarUrl,
        enabled: decodedToken.enabled !== undefined ? decodedToken.enabled : true
      };
      this.currentUserSubject.next(user);
      this.currentUserRoleSubject.next(userRoleEnum || null);
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

  public refreshToken(): Observable<string | null> {
    if (this.isRefreshingToken) {
      return this.tokenRefreshSubject.asObservable().pipe(take(1));
    }

    this.isRefreshingToken = true;
    this.tokenRefreshSubject = new Subject<string | null>();

    return from(this.getRefreshToken()).pipe(
      switchMap((refreshToken: string | null) => {
        if (!refreshToken) {
          console.error('No refresh token found, logging out.');
          this.logout();
          this.tokenRefreshSubject.next(null);
          this.tokenRefreshSubject.complete();
          return of(null);
        }

        return this.http.post<AuthResponse>(`${this.apiUrl}/refresh-token`, { refreshToken: refreshToken })
          .pipe(
            tap(async (response: AuthResponse) => {
              if (response && response.token) {
                await this.processToken(response.token, response.refreshToken);
                this.tokenRefreshSubject.next(response.token);
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
      map(response => response?.token || null)
    );
  }

  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
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
    }
  }

  async logout(navigate: boolean = true) {
    if (!this._storage) await this.initStorage();
    await this._storage?.remove(this.TOKEN_KEY);
    await this._storage?.remove(this.REFRESH_TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.currentUserRoleSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    if (navigate) {
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  verifyEmail(token: string): Observable<string> {
    return this.http.get(`${this.apiUrl}/verify-email?token=${token}`, { responseType: 'text' })
      .pipe(catchError(err => this.handleError(err, 'verificación de email')));
  }

  requestPasswordReset(emailReq: { email: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, emailReq)
      .pipe(catchError(err => this.handleError(err, 'solicitud de reseteo de contraseña')));
  }

  resetPassword(data: PasswordResetRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, data)
      .pipe(catchError(err => this.handleError(err, 'reseteo de contraseña')));
  }

  changePassword(data: PasswordChangeRequest): Observable<any> {
      return this.http.patch<any>(`${environment.apiUrl}/users/me/password`, data)
          .pipe(catchError(err => this.handleError(err, 'cambio de contraseña')));
  }

  getCurrentUserWithRole(): Observable<AuthData | null> {
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

  public getCurrentUser(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  public getCurrentUserRole(): Observable<Rol | null> {
    return this.currentUserRoleSubject.asObservable();
  }

  public async getToken(): Promise<string | null> {
    if (!this._storage) await this.initStorage();
    return this._storage?.get(this.TOKEN_KEY);
  }

  public async getRefreshToken(): Promise<string | null> {
    if (!this._storage) await this.initStorage();
    return this._storage?.get(this.REFRESH_TOKEN_KEY);
  }

  private async loadTokenIfNotLoaded(): Promise<void> {
    if (!this.isAuthenticatedSubject.getValue() && this.currentUserSubject.getValue() === null) {
      await this.loadToken();
    }
  }

  public async hasAnyRole(allowedRoles: Rol[]): Promise<boolean> {
    await this.loadTokenIfNotLoaded();
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


  public updateCurrentUser(updatedUser: User) {
    const currentUser = this.currentUserSubject.getValue();
    if (currentUser && currentUser.id === updatedUser.id) {
        const newUserState = { ...currentUser, ...updatedUser };
        this.currentUserSubject.next(newUserState);
        if(updatedUser.role && updatedUser.role !== currentUser.role) {
            this.currentUserRoleSubject.next(updatedUser.role);
        }
        console.log('[AuthService] Current user updated in BehaviorSubject:', newUserState);
    }
  }
}