import { BuildingDTO } from './building.model';
import { ClassroomType } from './classroom-type.enum';

export interface Classroom {
  id: string;
  name: string;
  capacity: number;
  type: ClassroomType;
  resources?: string;
  buildingId: string;
  building?: BuildingDTO;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  type?: ClassroomType;
  capacity?: number;
}