import { ClassroomsPage } from "../pages/classrooms/classrooms.page";

export interface Building {
  id?: string;
  name: string;
  location: string;
  classrooms?: ClassroomsPage[];
}