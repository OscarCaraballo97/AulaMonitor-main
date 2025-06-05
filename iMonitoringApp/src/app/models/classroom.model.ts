import { ClassroomType } from './classroom-type.enum';

export interface Classroom {
  id: string;
  name: string;
  capacity: number;
  type: ClassroomType;
  resources: string | string[];
  buildingId?: string;
  buildingName?: string;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  type: ClassroomType;
  buildingName: string;
}