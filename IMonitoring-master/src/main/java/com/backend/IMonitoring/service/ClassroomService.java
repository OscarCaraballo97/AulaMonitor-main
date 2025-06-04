package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.ClassroomAvailabilitySummaryDTO;
import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.dto.ClassroomDTO;
import com.backend.IMonitoring.dto.ClassroomRequestDTO;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.BuildingRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant; 
import java.util.List;
import java.util.stream.Collectors;
import java.util.Arrays;
import java.util.Collections;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final BuildingRepository buildingRepository;
    private final ReservationRepository reservationRepository;

    @Transactional(readOnly = true)
    public List<ClassroomDTO> getAllClassroomsDTO() {
        List<Classroom> classrooms = classroomRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return classrooms.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private ClassroomDTO convertToDTO(Classroom classroom) {
        if (classroom == null) {
            return null;
        }
        
        List<String> resourcesList;
        String resourcesString = classroom.getResources(); 
        if (resourcesString != null && !resourcesString.isEmpty()) {
            resourcesList = Arrays.asList(resourcesString.split("\\s*,\\s*"));
        } else {
            resourcesList = Collections.emptyList();
        }

        return ClassroomDTO.builder()
                .id(classroom.getId())
                .name(classroom.getName())
                .capacity(classroom.getCapacity())
                .type(classroom.getType())
                .resources(resourcesList) 
                .buildingId(classroom.getBuilding() != null ? classroom.getBuilding().getId() : null)
                .buildingName(classroom.getBuilding() != null ? classroom.getBuilding().getName() : null)
                .build();
    }

    @Transactional(readOnly = true)
    public Classroom getClassroomById(String id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Aula no encontrada con ID: " + id));
    }
    
    @Transactional(readOnly = true)
    public ClassroomDTO getClassroomDTOById(String id) {
        return convertToDTO(getClassroomById(id));
    }

    @Transactional
    public ClassroomDTO createClassroomFromDTO(ClassroomRequestDTO dto) { 
        Building building = buildingRepository.findById(dto.getBuildingId())
                .orElseThrow(() -> new ResourceNotFoundException("Edificio no encontrado con ID: " + dto.getBuildingId() + " al crear aula."));

        String resourcesString = null;
        if (dto.getResources() != null && !dto.getResources().isEmpty()) {
            resourcesString = String.join(",", dto.getResources());
        }

        Classroom classroom = Classroom.builder()
                .name(dto.getName())
                .capacity(dto.getCapacity())
                .type(dto.getType())
                .resources(resourcesString) 
                .building(building)
                .build();
        Classroom savedClassroom = classroomRepository.save(classroom);
        return convertToDTO(savedClassroom);
    }

    @Transactional
    public ClassroomDTO updateClassroomFromDTO(String classroomId, ClassroomRequestDTO dto) { 
        Classroom classroomToUpdate = getClassroomById(classroomId);
        Building building = buildingRepository.findById(dto.getBuildingId())
                .orElseThrow(() -> new ResourceNotFoundException("Edificio no encontrado con ID: " + dto.getBuildingId() + " al actualizar aula."));

        classroomToUpdate.setName(dto.getName());
        classroomToUpdate.setCapacity(dto.getCapacity());
        classroomToUpdate.setType(dto.getType());
        
        String resourcesString = null;
        if (dto.getResources() != null && !dto.getResources().isEmpty()) {
            resourcesString = String.join(",", dto.getResources());
        }
        classroomToUpdate.setResources(resourcesString); 

        classroomToUpdate.setBuilding(building);
        Classroom updatedClassroom = classroomRepository.save(classroomToUpdate);
        return convertToDTO(updatedClassroom);
    }

    @Transactional
    public void deleteClassroom(String id) {
        if (!classroomRepository.existsById(id)) {
            throw new ResourceNotFoundException("Aula no encontrada con ID: " + id + " para eliminar.");
        }
        List<Reservation> reservationsInClassroom = reservationRepository.findByClassroomId(id, Sort.unsorted());
        if (reservationsInClassroom != null && !reservationsInClassroom.isEmpty()) {
            reservationRepository.deleteAll(reservationsInClassroom);
        }
        classroomRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<ClassroomDTO> getClassroomsByType(ClassroomType type) { 
        List<Classroom> classrooms = classroomRepository.findByType(type, Sort.by(Sort.Direction.ASC, "name"));
        return classrooms.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClassroomDTO> getClassroomsByMinCapacity(Integer minCapacity) { 
        if (minCapacity == null || minCapacity < 0) {
            throw new IllegalArgumentException("La capacidad mínima debe ser un número positivo o cero.");
        }
        List<Classroom> classrooms = classroomRepository.findByCapacityGreaterThanEqual(minCapacity, Sort.by(Sort.Direction.ASC, "name"));
        return classrooms.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClassroomDTO> getAvailableNow() { 
        List<Classroom> classrooms = classroomRepository.findAvailableNow(Instant.now()); 
        return classrooms.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClassroomDTO> getUnavailableNow() { 
        List<Classroom> classrooms = classroomRepository.findUnavailableNow(Instant.now()); 
        return classrooms.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public boolean checkAvailability(AvailabilityRequest request) { 
        if (request == null || request.getClassroomId() == null || request.getStartTime() == null || request.getEndTime() == null) {
            throw new IllegalArgumentException("Datos incompletos para verificar disponibilidad.");
        }
        return classroomRepository.isAvailableConsideringAllStatuses(
                request.getClassroomId(),
                request.getStartTime(), 
                request.getEndTime()    
        );
    }

    @Transactional(readOnly = true)
    public ClassroomAvailabilitySummaryDTO getAvailabilitySummary() {
        List<Classroom> availableEntities = classroomRepository.findAvailableNow(Instant.now());
        List<Classroom> unavailableEntities = classroomRepository.findUnavailableNow(Instant.now());
        long total = classroomRepository.count();
        
        return new ClassroomAvailabilitySummaryDTO(
            availableEntities != null ? availableEntities.size() : 0, 
            unavailableEntities != null ? unavailableEntities.size() : 0, 
            (int) total
        );
    }

    @Transactional(readOnly = true)
    public List<Reservation> getClassroomReservationsForDateRange(
            String classroomId, 
            Instant startDate, 
            Instant endDate,   
            String sortField,  
            String sortDirection) {
        if (!classroomRepository.existsById(classroomId)) {
            throw new ResourceNotFoundException("Aula no encontrada con ID: " + classroomId);
        }
        Sort.Direction direction = (sortDirection == null || sortDirection.equalsIgnoreCase("desc")) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String field = (sortField == null || sortField.isEmpty()) ? "startTime" : sortField;

        return reservationRepository.findByClassroomIdAndStartTimeBetween(
            classroomId, 
            startDate, 
            endDate, 
            Sort.by(direction, field)
        );
    }
}