import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Reservation, ReservationStatus, ReservationCreationData } from '../models/reservation.model';
import { AuthService } from './auth.service';

export interface ReservationListFilters {
  classroomId?: string;
  userId?: string;
  status?: ReservationStatus | 'ALL';
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  futureOnly?: boolean;
  startDate?: string; 
  endDate?: string;
  page?: number;
  size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/reservations`;

  constructor(
    private http: HttpClient,
    private authService: AuthService 
  ) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación') {
    let errorMessage = `Error en ${operation}: `;
    if (error.error instanceof ErrorEvent) {
      errorMessage += `Error de red o cliente: ${error.error.message}`;
    } else {
      const serverErrorMessage = error.error?.message || error.error?.error || error.message || 'Error del servidor desconocido';
      errorMessage += `Código ${error.status}, mensaje: ${serverErrorMessage}`;
      if (error.status === 0) {
        errorMessage = `No se pudo conectar con el servidor para ${operation}. Verifica la conexión o el estado del servidor.`;
      } else if (error.status === 404 && (operation.includes("filter") || operation.includes("rango de fechas"))) {
        errorMessage = `Endpoint de filtro no encontrado (${error.url}). Verifica la configuración del backend. (Error 404)`;
      }
    }
    console.error(`[ReservationService] ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }

  getAllReservations(filters?: ReservationListFilters): Observable<Reservation[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'ALL') {
          params = params.set(key, String(value));
        }
      });
    }
    console.log(`[ReservationService] getAllReservations (llamando a ${this.apiUrl}/filter) con params:`, params.toString());
    return this.http.get<Reservation[]>(`${this.apiUrl}/filter`, { params })
      .pipe(catchError(err => this.handleError(err, 'obtener todas las reservas filtradas')));
  }

  getMyReservations(filters?: ReservationListFilters): Observable<Reservation[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'ALL') {
          params = params.set(key, String(value));
        }
      });
    }
    console.log(`[ReservationService] getMyReservations (llamando a ${this.apiUrl}/my-list) con params:`, params.toString());
    return this.http.get<Reservation[]>(`${this.apiUrl}/my-list`, { params })
        .pipe(catchError(err => this.handleError(err, 'obtener mis reservas')));
  }
  
  getReservationById(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `obtener reserva ID ${id}`)));
  }

  createReservation(reservationData: ReservationCreationData): Observable<Reservation> {
    console.log("[ReservationService] Creando reserva con payload:", reservationData);
    return this.http.post<Reservation>(this.apiUrl, reservationData)
      .pipe(catchError(err => this.handleError(err, 'crear reserva')));
  }

  updateReservation(id: string, reservationData: Partial<ReservationCreationData>): Observable<Reservation> {
    return this.http.put<Reservation>(`${this.apiUrl}/${id}`, reservationData)
      .pipe(catchError(err => this.handleError(err, `actualizar reserva ${id}`)));
  }

  updateReservationStatus(id: string, status: ReservationStatus): Observable<Reservation> {
    console.log(`[ReservationService] Actualizando estado de reserva ID: ${id} a ${status}`);
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/status`, { status })
      .pipe(catchError(err => this.handleError(err, `actualizar estado de reserva ${id}`)));
  }

  cancelMyReservation(id: string): Observable<Reservation> {
    console.log(`[ReservationService] Solicitando cancelarMiReserva para ID: ${id}`);
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/cancel`, {})
      .pipe(catchError(err => this.handleError(err, `cancelar mi reserva ${id}`)));
  }

  deleteReservation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `eliminar reserva ${id}`)));
  }

  getReservationsByClassroomAndDateRange(classroomId: string, startDateISO: string, endDateISO: string): Observable<Reservation[]> {
    const filters: ReservationListFilters = { 
        classroomId: classroomId,
        startDate: startDateISO,
        endDate: endDateISO,
        sortField: 'startTime', 
        sortDirection: 'asc'
    };
    console.log(`[ReservationService] getReservationsByClassroomAndDateRange llamando a getAllReservations (endpoint /filter) con filtros:`, filters);
    return this.getAllReservations(filters).pipe(
        map(reservations => {
            console.log(`[ReservationService] Aula ${classroomId}: ${reservations.length} recibidas, antes de filtro de solapamiento exacto en frontend.`);
            const viewStart = new Date(startDateISO).getTime();
            const viewEnd = new Date(endDateISO).getTime();
            const filtered = reservations.filter(res => {
                const resStart = new Date(res.startTime).getTime();
                const resEnd = new Date(res.endTime).getTime();
                return resStart < viewEnd && resEnd > viewStart; 
            });
            console.log(`[ReservationService] Aula ${classroomId}: ${filtered.length} después de filtro de solapamiento exacto en frontend.`);
            return filtered;
        }),
        catchError(err => this.handleError(err, `obtener reservas para aula ${classroomId} en rango de fechas`))
    );
  }

  getMyUpcomingReservations(limit: number = 3): Observable<Reservation[]> {
    const filters: ReservationListFilters = {
        status: ReservationStatus.CONFIRMADA,
        sortField: 'startTime',
        sortDirection: 'asc',
        limit: limit,
        futureOnly: true
    };
    return this.getMyReservations(filters)
        .pipe(catchError(err => this.handleError(err, 'obtener mis próximas reservas')));
  }
}