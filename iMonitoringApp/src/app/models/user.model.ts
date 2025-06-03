import { Rol } from './rol.model';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: Rol; 
  avatarUrl?: string;
  enabled?: boolean;
}