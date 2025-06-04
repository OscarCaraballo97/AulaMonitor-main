import { UserSummary, User } from './user.model'; 
import { ClassroomSummary, Classroom } from './classroom.model'; 

export enum ReservationStatus {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA'
}

export interface Reservation {
  id: string;
  purpose: string;
  startTime: string;
  endTime: string; 
  status: ReservationStatus;
  createdAt?: string; 
  user?: UserSummary | User;
  classroom?: ClassroomSummary | Classroom;
  userId?: string;
  classroomId?: string;
}

export interface ReservationCreationData {
  purpose: string;
  classroomId: string;
  startTime: string;
  endTime: string; 
  userId?: string | null;
  status?: ReservationStatus; 
}