import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { AuthService } from './auth.service'; 

export interface ReservationCreationData {
  classroomId: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  userId?: string; 
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/reservations`; 
  private userApiUrl = `${environment.apiUrl}/users`;  

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación de reserva') {
    let errorMessage = `Error en ${operation}: `;
    if (error.error instanceof ErrorEvent) {
      errorMessage += `Error: ${error.error.message}`;
    } else {
      const serverErrorMessage = error.error?.message || error.error?.error || error.message;
      errorMessage += `Código ${error.status}, mensaje: ${serverErrorMessage || 'Error del servidor desconocido'}`;
      if (error.status === 0) {
        errorMessage = `No se pudo conectar con el servidor para ${operation}. Verifica la conexión o el estado del servidor.`;
      }
    }
    console.error(`[ReservationService] ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }

  
  getAllReservations(filters?: { classroomId?: string, userId?: string, status?: ReservationStatus }): Observable<Reservation[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.classroomId) params = params.set('classroomId', filters.classroomId);
      if (filters.userId) params = params.set('userId', filters.userId);
      if (filters.status) params = params.set('status', filters.status.toString());
    }
    console.log(`[ReservationService] getAllReservations con params:`, params.toString());
    return this.http.get<Reservation[]>(this.apiUrl, { params })
      .pipe(catchError(err => this.handleError(err, 'obtener todas las reservas')));
  }


  getReservationsByClassroomAndDateRange(classroomId: string, startDate: string, endDate: string): Observable<Reservation[]> {
    console.log(`[ReservationService] Solicitando TODAS las reservas para classroomId: ${classroomId} para filtrar por fecha en frontend.`);
    
    return this.getAllReservations({ classroomId }).pipe( 
      map(reservations => {
        if (!reservations) {
          console.log(`[ReservationService] No se recibieron reservaciones para el aula ${classroomId}.`);
          return [];
        }
        const startFilterTime = new Date(startDate).getTime();
        const endFilterTime = new Date(endDate).getTime();

        const filtered = reservations.filter(res => {
          const resStartTime = new Date(res.startTime).getTime();
          const resEndTime = new Date(res.endTime).getTime();
          return resStartTime < endFilterTime && resEndTime > startFilterTime;
        });
        console.log(`[ReservationService] Reservas filtradas en frontend para ${classroomId} (${startDate} - ${endDate}): ${filtered.length} de ${reservations.length} iniciales.`, filtered);
        return filtered;
      }),
      catchError(err => this.handleError(err, `obtener y filtrar reservas por aula ${classroomId} y rango de fechas`))
    );
  }

  getMyReservations(filters?: { status?: ReservationStatus, sort?: string, limit?: number, futureOnly?: boolean }): Observable<Reservation[]> {
    const url = `${this.userApiUrl}/me/reservations`;
    let params = new HttpParams();
    if (filters) {
        if (filters.status) params = params.set('status', filters.status);
        if (filters.sort) params = params.set('sort', filters.sort);
        if (filters.limit) params = params.set('limit', filters.limit.toString());
        if (filters.futureOnly !== undefined) params = params.set('futureOnly', filters.futureOnly.toString());
    }
    return this.http.get<Reservation[]>(url, { params })
        .pipe(catchError(err => this.handleError(err, 'obtener mis reservas')));
  }

  getReservationById(id: string): Observable<Reservation> {
    const url = `${this.apiUrl}/${id}`;
    return this.http.get<Reservation>(url)
      .pipe(catchError(err => this.handleError(err, `obtener reserva por ID ${id}`)));
  }

  createReservation(reservationData: ReservationCreationData): Observable<Reservation> {
    let dataToSend: any = { ...reservationData };
    const currentUserId = this.authService.currentUser.value?.id;

    if (dataToSend.userId && currentUserId && dataToSend.userId === currentUserId) {
      console.log("[ReservationService] El userId proporcionado es el del usuario actual. El backend debería tomarlo del token. Eliminando userId del payload.");
      delete dataToSend.userId;
    } else if (dataToSend.userId) {
      console.log("[ReservationService] Se proporciona un userId explícito. Asumiendo que un admin/coordinador crea para otro. El backend debe validar permisos.");
    } else {
      console.log("[ReservationService] No se proporciona userId. El backend lo tomará del token del usuario autenticado.");
    }

    console.log("[ReservationService] Creando reserva con datos finales:", dataToSend);
    return this.http.post<Reservation>(this.apiUrl, dataToSend)
      .pipe(catchError(err => this.handleError(err, 'crear reserva')));
  }

  updateReservation(id: string, reservationData: Partial<Reservation>): Observable<Reservation> {
    const url = `${this.apiUrl}/${id}`;
    return this.http.put<Reservation>(url, reservationData)
      .pipe(catchError(err => this.handleError(err, `actualizar reserva ${id}`)));
  }

  updateReservationStatus(id: string, status: ReservationStatus): Observable<Reservation> {
    const url = `${this.apiUrl}/${id}/status`;
    console.log(`[ReservationService] Actualizando estado de reserva ID: ${id} a ${status}. URL: ${url}. Payload:`, { status });
    return this.http.patch<Reservation>(url, { status })
      .pipe(catchError(err => this.handleError(err, `actualizar estado de reserva ${id}`)));
  }

  cancelMyReservation(id: string): Observable<Reservation> {
    const url = `${this.apiUrl}/${id}/cancel`;
    console.log(`[ReservationService] Solicitando cancelarMiReserva para ID: ${id}. URL: ${url}`);
    return this.http.patch<Reservation>(url, {})
      .pipe(catchError(err => this.handleError(err, `cancelar mi reserva ${id}`)));
  }

  deleteReservation(id: string): Observable<void> { 
    const url = `${this.apiUrl}/${id}`;
    return this.http.delete<void>(url)
      .pipe(catchError(err => this.handleError(err, `eliminar reserva ${id}`)));
  }

  getReservationsByUserId(userId: string): Observable<Reservation[]> { 
    const url = `${this.userApiUrl}/${userId}/reservations`;
    return this.http.get<Reservation[]>(url)
        .pipe(catchError(err => this.handleError(err, `obtener reservas para usuario ${userId}`)));
  }

  getMyUpcomingReservations(limit: number = 3): Observable<Reservation[]> {
    const url = `${this.userApiUrl}/me/reservations`;
    const params = new HttpParams()
      .set('status', ReservationStatus.CONFIRMADA.toString())
      .set('sort', 'startTime,asc')
      .set('limit', limit.toString())
      .set('futureOnly', 'true');
    return this.http.get<Reservation[]>(url, { params })
      .pipe(catchError(err => this.handleError(err, 'obtener mis próximas reservas')));
  }
}