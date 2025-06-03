import { Rol } from './rol.model'; 
import { ClassroomType } from './classroom-type.enum'; 
export interface ReservationClassroomDetails {
  id: string;
  name: string;
  buildingName?: string;
  type?: ClassroomType; 
}
export interface ReservationUserDetails {
  id: string;
  name: string;
  email: string;
  role?: Rol;
}

export enum ReservationStatus {
  CONFIRMADA = 'CONFIRMADA',
  PENDIENTE = 'PENDIENTE',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA'
}

export interface Reservation {
  id?: string;
  classroom?: ReservationClassroomDetails; 
  user?: ReservationUserDetails;           
  startTime: string;  
  endTime: string;   
  status: ReservationStatus;
  purpose?: string;
  createdAt?: string;   
  updatedAt?: string;
}

export interface ReservationCreationData {
  classroomId: string;
  startTime: string;   
  endTime: string;    
  purpose?: string;
  userId?: string;    
}