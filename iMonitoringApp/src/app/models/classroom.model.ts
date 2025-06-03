import { Building } from './building.model';
import { ClassroomType } from './classroom-type.enum';

export interface Classroom {
  id?: string;
  name: string;
  capacity: number;
  type: ClassroomType;
  resources?: string;
  buildingId: string;
  building?: Building;
}
export interface ClassroomSummary {
  id: string;
  name: string;
  buildingName?: string; 
}