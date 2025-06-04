import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Reservation, ReservationCreationData, ReservationStatus } from '../models/reservation.model';

export interface ReservationListFilters {
  classroomId?: string;
  userId?: string;
  status?: ReservationStatus | 'ALL';
  startDate?: string; 
  endDate?: string;   
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface PaginatedReservations { 
  data: Reservation[];
  totalPages: number;
  totalItems?: number;   
  currentPage?: number;  
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) { }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`[ReservationService] ${operation} failed: Código ${error.status}, mensaje: ${error.message}`, error.error);
      const errMsgFromServer = error.error?.message || error.error?.error || (typeof error.error === 'string' ? error.error : '');
      const userMessage = `Error en ${operation.toLowerCase()}: ${errMsgFromServer || error.statusText || 'Error desconocido del servidor'}.`;
      
      if (result !== undefined) {
        return of(result as T);
      } else {
        return throwError(() => new Error(userMessage));
      }
    };
  }

  getAllReservations(filters: ReservationListFilters): Observable<Reservation[]> {
    let params = new HttpParams();
    if (filters.classroomId) params = params.set('classroomId', filters.classroomId);
    if (filters.userId) params = params.set('userId', filters.userId);
    if (filters.status && filters.status !== 'ALL') params = params.set('status', filters.status);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.sortField) params = params.set('sortField', filters.sortField);
    if (filters.sortDirection) params = params.set('sortDirection', filters.sortDirection);
    if (filters.page !== undefined) params = params.set('page', filters.page.toString());
    if (filters.size !== undefined) params = params.set('size', filters.size.toString());

   
    return this.http.get<Reservation[]>(`${this.apiUrl}/filter`, { params })
      .pipe(catchError(this.handleError<Reservation[]>('obtener todas las reservas filtradas', [])));
  }


  getMyReservations( 
    sortField: string = 'startTime', 
    sortDirection: 'asc' | 'desc' = 'desc',
    page: number = 0,
    size: number = 10,
    status?: ReservationStatus | 'ALL', 
    upcomingOnly?: boolean 
  ): Observable<PaginatedReservations> {
    let params = new HttpParams()
      .set('sortField', sortField)
      .set('sortDirection', sortDirection)
      .set('page', page.toString())
      .set('size', size.toString());
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }
    if (upcomingOnly !== undefined) {
      params = params.set('upcomingOnly', upcomingOnly.toString());
    }
    
    return this.http.get<PaginatedReservations>(`${this.apiUrl}/my-list`, { params })
      .pipe(catchError(this.handleError<PaginatedReservations>('obtener mis reservas', { data:[], totalPages: 0, totalItems: 0, currentPage:0 })));
  }
  
  getReservationsByClassroomAndDateRange(classroomId: string, startDate: string, endDate: string): Observable<Reservation[]> {
    return this.getAllReservations({ classroomId, startDate, endDate, sortField: 'startTime', sortDirection: 'asc' });
  }

  getMyUpcomingReservations(limit: number = 5): Observable<Reservation[]> {
    return this.getMyReservations('startTime', 'asc', 0, limit, undefined, true)
      .pipe(
        map(response => response.data || []), 
        catchError(this.handleError<Reservation[]>('obtener próximas reservas', []))
      );
  }

  getReservationById(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError<Reservation>(`obtener reserva id=${id}`)));
  }

  createReservation(reservation: ReservationCreationData): Observable<Reservation> {
    return this.http.post<Reservation>(this.apiUrl, reservation)
      .pipe(catchError(this.handleError<Reservation>('crear reserva')));
  }

  updateReservation(id: string, reservation: Partial<ReservationCreationData>): Observable<Reservation> {
    return this.http.put<Reservation>(`${this.apiUrl}/${id}`, reservation)
      .pipe(catchError(this.handleError<Reservation>('actualizar reserva')));
  }
  
  updateReservationStatus(id: string, status: ReservationStatus): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/status`, { status })
      .pipe(catchError(this.handleError<Reservation>('actualizar estado de reserva')));
  }

  cancelMyReservation(id: string): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/cancel`, {})
      .pipe(catchError(this.handleError<Reservation>('cancelar reserva')));
  }

  deleteReservation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError<void>('eliminar reserva')));
  }
}