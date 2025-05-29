import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Classroom } from '../models/classroom.model';
import { ClassroomType } from '../models/classroom-type.enum';
import { Reservation } from '../models/reservation.model';

export interface ClassroomAvailabilitySummaryDTO {
  availableNow: number;
  occupiedNow: number;
  total: number;
}

export interface ClassroomRequestData {
  name: string;
  capacity: number;
  type: ClassroomType;
  resources?: string;
  buildingId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClassroomService {
  private apiUrl = `${environment.apiUrl}/classrooms`;

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación de aula') {
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
    console.error(`[ClassroomService] ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }

  getAllClassrooms(): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(this.apiUrl)
      .pipe(catchError(err => this.handleError(err, 'obtener todas las aulas')));
  }

  getClassroomById(id: string): Observable<Classroom> {
    return this.http.get<Classroom>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `obtener aula por ID ${id}`)));
  }

  createClassroom(classroomData: ClassroomRequestData): Observable<Classroom> {
    return this.http.post<Classroom>(this.apiUrl, classroomData)
      .pipe(catchError(err => this.handleError(err, 'crear aula')));
  }

  updateClassroom(id: string, classroomData: Partial<ClassroomRequestData>): Observable<Classroom> {
    return this.http.put<Classroom>(`${this.apiUrl}/${id}`, classroomData)
      .pipe(catchError(err => this.handleError(err, `actualizar aula ${id}`)));
  }

  deleteClassroom(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `eliminar aula ${id}`)));
  }

  getClassroomReservations(classroomId: string, startDateISO: string, endDateISO: string): Observable<Reservation[]> {
    let params = new HttpParams()
      .set('startDate', startDateISO)
      .set('endDate', endDateISO);
    return this.http.get<Reservation[]>(`${this.apiUrl}/${classroomId}/reservations-by-date`, { params })
      .pipe(catchError(err => this.handleError(err, `obtener reservas para aula ${classroomId} en rango de fechas`)));
  }
  
  getAvailabilitySummary(): Observable<ClassroomAvailabilitySummaryDTO> {
    return this.http.get<ClassroomAvailabilitySummaryDTO>(`${this.apiUrl}/stats/availability`)
      .pipe(catchError(err => this.handleError(err, 'obtener resumen de disponibilidad de aulas')));
  }

  checkClassroomAvailability(classroomId: string, startTimeISO: string, endTimeISO: string): Observable<boolean> {
    const params = new HttpParams()
      .set('startTime', startTimeISO)
      .set('endTime', endTimeISO);
    return this.http.get<{isAvailable: boolean}>(`${this.apiUrl}/${classroomId}/check-availability`, { params })
      .pipe(
        map((response: {isAvailable: boolean}) => response.isAvailable),
        catchError(err => this.handleError(err, `verificar disponibilidad para aula ${classroomId} en rango`))
      );
  }

   getClassroomsByType(type: ClassroomType): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(`${this.apiUrl}/type/${type}`)
      .pipe(catchError(err => this.handleError(err, `obtener aulas por tipo ${type}`)));
  }

  getClassroomsByMinCapacity(minCapacity: number): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(`${this.apiUrl}/capacity/${minCapacity}`)
      .pipe(catchError(err => this.handleError(err, `obtener aulas por capacidad mínima ${minCapacity}`)));
  }
}
