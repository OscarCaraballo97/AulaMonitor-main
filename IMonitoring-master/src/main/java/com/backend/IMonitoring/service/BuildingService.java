package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.BuildingRequestDTO;
import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.repository.BuildingRepository;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BuildingService {
    private final BuildingRepository buildingRepository;
    private final ClassroomRepository classroomRepository;

    public List<Building> getAllBuildings() {
        return buildingRepository.findAll();
    }

    public Building getBuildingById(String id) {
        return buildingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Edificio no encontrado con ID: " + id));
    }

    @Transactional
    public Building createBuilding(BuildingRequestDTO buildingRequestDTO) {
        Building building = Building.builder()
                .name(buildingRequestDTO.getName())
                .location(buildingRequestDTO.getLocation())
                .build();
        return buildingRepository.save(building);
    }

    @Transactional
    public Building updateBuilding(String id, BuildingRequestDTO buildingRequestDTO) {
        Building existingBuilding = getBuildingById(id);
        existingBuilding.setName(buildingRequestDTO.getName());
        existingBuilding.setLocation(buildingRequestDTO.getLocation());
        return buildingRepository.save(existingBuilding);
    }

    @Transactional
    public void deleteBuilding(String id) {
        Building building = getBuildingById(id);
        List<Classroom> classroomsInBuilding = classroomRepository.findByBuilding_Id(id); // CORREGIDO
        if (classroomsInBuilding != null && !classroomsInBuilding.isEmpty()) {
            throw new IllegalStateException("No se puede eliminar el edificio porque tiene aulas asociadas. Por favor, elimine o reasigne las aulas primero.");
        }
        buildingRepository.delete(building);
    }
}