import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Reservation, ReservationCreationData, ReservationStatus } from '../models/reservation.model';

export interface PaginatedReservations {
  content: Reservation[]; 
  pageable: {
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number; 
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface ReservationListFilters {
  classroomId?: string;
  userId?: string;
  status?: ReservationStatus;
  startDate?: string; 
  endDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/api/reservations`; 

  constructor(private http: HttpClient) {}

  getAllReservations(filters: ReservationListFilters): Observable<PaginatedReservations> {
    let params = new HttpParams();
    if (filters.classroomId) params = params.append('classroomId', filters.classroomId);
    if (filters.userId) params = params.append('userId', filters.userId);
    if (filters.status) params = params.append('status', filters.status);
    if (filters.startDate) params = params.append('startDate', filters.startDate);
    if (filters.endDate) params = params.append('endDate', filters.endDate);
    if (filters.sortField) params = params.append('sortField', filters.sortField);
    if (filters.sortDirection) params = params.append('sortDirection', filters.sortDirection);
    if (filters.page !== undefined) params = params.append('page', filters.page.toString());
    if (filters.size !== undefined) params = params.append('size', filters.size.toString());

    return this.http.get<PaginatedReservations>(`${this.apiUrl}/filter`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getReservationsByClassroomAndDateRange(classroomId: string, startDateTime: string, endDateTime: string): Observable<Reservation[]> {
    let params = new HttpParams();
    params = params.append('classroomId', classroomId);
    params = params.append('startTime', startDateTime);
    params = params.append('endTime', endDateTime);
    return this.http.get<Reservation[]>(`${this.apiUrl}/classroom-availability`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getMyReservations(
    sortField: string = 'startTime',
    sortDirection: 'desc' | 'asc' = 'desc',
    page: number = 0,
    size: number = 10,
    status?: ReservationStatus,
    upcomingOnly: boolean = false,
    startDate?: string,
    endDate?: string
  ): Observable<PaginatedReservations> {
    let params = new HttpParams();
    params = params.append('sortField', sortField);
    params = params.append('sortDirection', sortDirection);
    params = params.append('page', page.toString());
    params = params.append('size', size.toString());
    if (status) params = params.append('status', status);
    params = params.append('upcomingOnly', upcomingOnly.toString());
    if (startDate) params = params.append('startDate', startDate);
    if (endDate) params = params.append('endDate', endDate);

    return this.http.get<PaginatedReservations>(`${this.apiUrl}/my-list`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getReservationById(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createReservation(reservationData: ReservationCreationData): Observable<Reservation> {
    return this.http.post<Reservation>(this.apiUrl, reservationData).pipe(
      catchError(this.handleError)
    );
  }

  updateReservation(id: string, reservationData: ReservationCreationData): Observable<Reservation> {
    return this.http.put<Reservation>(`${this.apiUrl}/${id}`, reservationData).pipe(
      catchError(this.handleError)
    );
  }

  updateReservationStatus(id: string, status: ReservationStatus): Observable<Reservation> {
    
    const statusUpdatePayload = { status: status };
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/status`, statusUpdatePayload).pipe(
      catchError(this.handleError)
    );
  }

  cancelReservation(id: string): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/cancel`, {}).pipe(
      catchError(this.handleError)
    );
  }

  deleteReservation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      console.error(`Backend returned code ${error.status}, body was: ${error.error}`);
      if (error.status === 401) {
        errorMessage = 'Unauthorized: Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'Forbidden: You do not have permission to perform this action.';
      } else if (error.error && error.error.message) {
        errorMessage = `${error.error.message}`;
      } else if (error.statusText) {
        errorMessage = `Error ${error.status}: ${error.statusText}`;
      } else {
        errorMessage = `Error ${error.status}: Something went wrong on the server.`;
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}