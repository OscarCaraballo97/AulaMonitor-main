package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.BuildingRequestDTO;
import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.repository.BuildingRepository;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort; 
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BuildingService {

    private final BuildingRepository buildingRepository;
    private final ClassroomRepository classroomRepository;

    @Transactional(readOnly = true)
    public List<Building> getAllBuildings() {
        return buildingRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    @Transactional(readOnly = true)
    public Building getBuildingById(String id) {
        return buildingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Edificio no encontrado con ID: " + id));
    }

    @Transactional
    public Building createBuilding(BuildingRequestDTO buildingRequestDTO) {
        Building building = new Building();
        building.setName(buildingRequestDTO.getName());
        building.setLocation(buildingRequestDTO.getLocation());
        return buildingRepository.save(building);
    }

    @Transactional
    public Building updateBuilding(String id, BuildingRequestDTO buildingRequestDTO) {
        Building building = getBuildingById(id);
        building.setName(buildingRequestDTO.getName());
        if (buildingRequestDTO.getLocation() != null) {
             building.setLocation(buildingRequestDTO.getLocation());
        }
        return buildingRepository.save(building);
    }

    @Transactional
    public void deleteBuilding(String id) {
        Building building = getBuildingById(id);
        List<Classroom> classroomsInBuilding = classroomRepository.findByBuilding_Id(id); 
        if (classroomsInBuilding != null && !classroomsInBuilding.isEmpty()) {
            throw new IllegalStateException("No se puede eliminar el edificio porque tiene aulas asociadas. Elimine o reasigne las aulas primero.");
        }
        buildingRepository.delete(building);
    }

    @Transactional(readOnly = true)
    public List<Classroom> getClassroomsByBuildingId(String buildingId) {
        if (!buildingRepository.existsById(buildingId)) {
            throw new ResourceNotFoundException("Edificio no encontrado con ID: " + buildingId);
        }
        return classroomRepository.findByBuilding_Id(buildingId); 
    }
}