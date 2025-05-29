import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Building } from '../models/building.model';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {
  private apiUrl = `${environment.apiUrl}/buildings`;

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación de edificio') {
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
    console.error(`[BuildingService] ${errorMessage}`, error);
    return throwError(() => new Error(errorMessage));
  }

  getAllBuildings(): Observable<Building[]> {
    console.log("BuildingService: Solicitando todos los edificios...");
    return this.http.get<Building[]>(this.apiUrl)
      .pipe(catchError(err => this.handleError(err, 'obtener todos los edificios')));
  }

  getBuildingById(id: string): Observable<Building> {
    return this.http.get<Building>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `obtener edificio por ID ${id}`)));
  }

  createBuilding(buildingData: Omit<Building, 'id' | 'classrooms'>): Observable<Building> {
    return this.http.post<Building>(this.apiUrl, buildingData)
      .pipe(catchError(err => this.handleError(err, 'crear edificio')));
  }

  updateBuilding(id: string, buildingData: Partial<Omit<Building, 'id' | 'classrooms'>>): Observable<Building> {
    return this.http.put<Building>(`${this.apiUrl}/${id}`, buildingData)
      .pipe(catchError(err => this.handleError(err, `actualizar edificio ${id}`)));
  }

  deleteBuilding(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `eliminar edificio ${id}`)));
  }
}
