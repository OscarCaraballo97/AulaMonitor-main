import { User } from './user.model';
import { Rol } from './rol.model';

export interface AuthResponse {
  token: string;
  message?: string;
  user?: User;
}

export interface LoginCredentials {
  email: string;
  password: string; 
}

export interface RegisterData {
  name: string;
  email: string;
  password_hash: string;
  role: Rol;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password_hash: string;
  confirmPassword_hash?: string;
  role: Rol;
}

export interface PasswordResetRequest {
  token: string;
  newPassword_hash: string;
}

export interface PasswordChangeRequest {
  currentPassword_hash: string;
  newPassword_hash: string;
}