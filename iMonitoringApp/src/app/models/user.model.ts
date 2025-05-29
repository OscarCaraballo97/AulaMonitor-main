import { Rol } from './rol.model';

export interface User {
  id?: string;
  email: string;
  password?: string;
  role: Rol;
  name?: string;    
  avatarUrl?: string;
}