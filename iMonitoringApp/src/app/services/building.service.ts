import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BuildingDTO, BuildingRequestDTO } from '../models/building.model'; 
import { Classroom } from '../models/classroom.model'; 

@Injectable({
  providedIn: 'root'
})
export class BuildingService {
  private apiUrl = `${environment.apiUrl}/buildings`;

  constructor(private http: HttpClient) { }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`[BuildingService] ${operation} failed: Código ${error.status}, mensaje: ${error.message}`, error.error);
      const errMsgFromServer = error.error?.message || error.error?.error || (typeof error.error === 'string' ? error.error : '');
      const userMessage = `Error en ${operation.toLowerCase()}: ${errMsgFromServer || error.statusText || 'Error desconocido del servidor'}.`;
      return throwError(() => new Error(userMessage));
    };
  }

  getAllBuildings(): Observable<BuildingDTO[]> { 
    console.log('BuildingService: Solicitando todos los edificios...');
    return this.http.get<BuildingDTO[]>(this.apiUrl)
      .pipe(catchError(this.handleError<BuildingDTO[]>('obtener todos los edificios', [])));
  }

  getBuildingById(id: string): Observable<BuildingDTO> {
    return this.http.get<BuildingDTO>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError<BuildingDTO>(`obtener edificio id=${id}`)));
  }

  createBuilding(buildingData: BuildingRequestDTO): Observable<BuildingDTO> { 
    return this.http.post<BuildingDTO>(this.apiUrl, buildingData)
      .pipe(catchError(this.handleError<BuildingDTO>('crear edificio')));
  }

  updateBuilding(id: string, buildingData: BuildingRequestDTO): Observable<BuildingDTO> { 
    return this.http.put<BuildingDTO>(`${this.apiUrl}/${id}`, buildingData)
      .pipe(catchError(this.handleError<BuildingDTO>('actualizar edificio')));
  }

  deleteBuilding(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError<void>('eliminar edificio')));
  }

  getClassroomsByBuildingId(buildingId: string): Observable<Classroom[]> { 
    const url = `${environment.apiUrl}/classrooms/building/${buildingId}`; 
    return this.http.get<Classroom[]>(url) 
        .pipe(catchError(this.handleError<Classroom[]>('obtener aulas por edificio', [])));
  }
}