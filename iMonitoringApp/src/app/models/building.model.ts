export interface Building {
  id: string;
  name: string;
  location?: string;
}

export interface BuildingDTO {
  id: string;
  name: string;
  location?: string; 
}

export interface BuildingRequestDTO {
  name: string;
  location?: string;
}