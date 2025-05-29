import { Rol } from './rol.model';

export interface AuthRequest {
  email: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  message?: string; 
}

export interface RegisterRequest {
  name: string;
  email: string;
  password?: string;
  role: Rol;

}