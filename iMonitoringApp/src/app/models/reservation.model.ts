import { Classroom } from './classroom.model';
import { User } from './user.model';

export enum ReservationStatus {
  CONFIRMADA = 'CONFIRMADA',
  PENDIENTE = 'PENDIENTE',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA'
}

export interface Reservation {
  id?: string;
  classroomId: string;
  classroom?: Classroom;
  userId: string;
  user?: User;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  purpose?: string;
  createdAt?: string;
  updatedAt?: string;
}