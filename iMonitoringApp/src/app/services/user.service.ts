import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { Rol } from '../models/rol.model'; 

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) { }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      let errorMessage = `Error en ${operation}: `;
      if (error.error instanceof ErrorEvent) {
        errorMessage += `Error: ${error.error.message}`;
      } else {
        errorMessage += `Código ${error.status}, mensaje: ${error.error?.message || error.message || 'Error del servidor'}`;
      }
      console.error(errorMessage, error);
      return throwError(() => new Error(errorMessage));
    };
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl)
      .pipe(catchError(this.handleError<User[]>('obtener todos los usuarios', [])));
  }

  getUsersByRole(role: Rol): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/role/${role}`)
      .pipe(catchError(this.handleError<User[]>(`obtener usuarios por rol ${role}`, [])));
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError<User>(`obtener usuario por ID ${id}`)));
  }

  createUser(user: Partial<User>): Observable<User> { 
    return this.http.post<User>(this.apiUrl, user)
      .pipe(catchError(this.handleError<User>('crear usuario')));
  }

  updateUser(id: string, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user).pipe(
        tap(updatedUser => console.log(`Usuario actualizado con ID=${updatedUser.id}`)),
        catchError(this.handleError<User>(`actualizar usuario ${id}`))
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError<void>(`eliminar usuario ${id}`)));
  }

  updateUserPassword(userId: string, passwordData: { currentPassword?: string, newPassword?: string, oldPassword?: string }): Observable<string> {

    let actualPayload = passwordData;
    if (passwordData.currentPassword) { 
        actualPayload = { oldPassword: passwordData.currentPassword, newPassword: passwordData.newPassword };
    }

    return this.http.patch<string>(`${this.apiUrl}/${userId}/password`, actualPayload, { responseType: 'text' as 'json' }).pipe(
        tap(response => console.log('Respuesta de actualización de contraseña:', response)),
        catchError(this.handleError<string>(`actualizar contraseña para usuario ${userId}`))
    );
  }
}