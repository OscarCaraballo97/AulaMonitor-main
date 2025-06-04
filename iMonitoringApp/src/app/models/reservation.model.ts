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

export interface ReservationCreationData {
  classroomId: string;
  startTime: string;   
  endTime: string;    
  purpose?: string;
  userId?: string;    
}
export interface Reservation {
  id: string;
  purpose: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus; 
  user?: ReservationUserDetails; 
  classroom?: ReservationClassroomDetails;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReservationUserDetails {
  id: string;
  name: string;
  email: string;
  role?: Rol; 
  avatarUrl?: string;
}