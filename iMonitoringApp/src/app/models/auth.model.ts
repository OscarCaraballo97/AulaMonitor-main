import { Rol } from './rol.model';
import { User } from './user.model'; 

export interface AuthResponse {
  token: string;
  refreshToken?: string;
}

export interface LoginCredentials { 
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: Rol;
}

export interface PasswordResetRequest {
  token: string;
  newPassword: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}