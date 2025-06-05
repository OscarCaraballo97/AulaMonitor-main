import { User } from './user.model';
import { Classroom, ClassroomSummary } from './classroom.model'; 

export enum ReservationStatus {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  CANCELADA = 'CANCELADA',
  RECHAZADA = 'RECHAZADA',
}

export interface Reservation {
  id?: string;
  purpose: string;
  startTime: string;
  endTime: string;
  userId?: string;
  user?: User;
  classroomId: string;
   classroom?: Classroom;
  status: ReservationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReservationCreationData {
  purpose: string;
  startTime: string;
  endTime: string;
  classroomId: string;
  userId?: string;
  status?: ReservationStatus;
}