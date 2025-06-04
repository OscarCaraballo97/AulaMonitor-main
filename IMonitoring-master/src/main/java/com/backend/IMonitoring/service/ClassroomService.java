package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.ClassroomAvailabilitySummaryDTO;
import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.dto.ClassroomDTO; // Importar ClassroomDTO
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors; // Importar Collectors

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final BuildingRepository buildingRepository;
    private final ReservationRepository reservationRepository;

    @Transactional
    public List<ClassroomDTO> getAllClassroomsDTO() { // Modificado para devolver List<ClassroomDTO>
        List<Classroom> classrooms = classroomRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return classrooms.stream()
                .map(this::convertToDTO) // Mapear cada entidad a DTO
                .collect(Collectors.toList());
    }

    // Nuevo método para convertir entidad Classroom a ClassroomDTO
    private ClassroomDTO convertToDTO(Classroom classroom) {
        if (classroom == null) {
            return null;
        }
        return ClassroomDTO.builder()
                .id(classroom.getId())
                .name(classroom.getName())
                .capacity(classroom.getCapacity())
                .type(classroom.getType())
                .resources(classroom.getResources())
                .buildingId(classroom.getBuilding() != null ? classroom.getBuilding().getId() : null) // Asegurarse de obtener el buildingId
                .build();
    }


    public Classroom getClassroomById(String id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Aula no encontrada con ID: " + id));
    }

    @Transactional
    public Classroom createClassroomFromDTO(ClassroomRequestDTO dto) {
        Building building = buildingRepository.findById(dto.getBuildingId())
                .orElseThrow(() -> new ResourceNotFoundException("Edificio no encontrado con ID: " + dto.getBuildingId() + " al crear aula."));

        Classroom classroom = Classroom.builder()
                .name(dto.getName())
                .capacity(dto.getCapacity())
                .type(dto.getType())
                .resources(dto.getResources())
                .building(building)
                .build();
        return classroomRepository.save(classroom);
    }

    @Transactional
    public Classroom updateClassroomFromDTO(String classroomId, ClassroomRequestDTO dto) {
        Classroom classroomToUpdate = getClassroomById(classroomId);
        Building building = buildingRepository.findById(dto.getBuildingId())
                .orElseThrow(() -> new ResourceNotFoundException("Edificio no encontrado con ID: " + dto.getBuildingId() + " al actualizar aula."));

        classroomToUpdate.setName(dto.getName());
        classroomToUpdate.setCapacity(dto.getCapacity());
        classroomToUpdate.setType(dto.getType());
        classroomToUpdate.setResources(dto.getResources());
        classroomToUpdate.setBuilding(building);
        return classroomRepository.save(classroomToUpdate);
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

    public List<Classroom> getClassroomsByType(ClassroomType type) {
        return classroomRepository.findByType(type);
    }

    public List<Classroom> getClassroomsByMinCapacity(Integer minCapacity) {
        if (minCapacity == null || minCapacity < 0) {
            throw new IllegalArgumentException("La capacidad mínima debe ser un número positivo o cero.");
        }
        return classroomRepository.findByCapacityGreaterThanEqual(minCapacity);
    }

    public List<Classroom> getAvailableNow() {
        return classroomRepository.findAvailableNow(LocalDateTime.now());
    }

    public List<Classroom> getUnavailableNow() {
        return classroomRepository.findUnavailableNow(LocalDateTime.now());
    }

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

    public ClassroomAvailabilitySummaryDTO getAvailabilitySummary() {
    
        List<Classroom> available = this.getAvailableNow(); 
        List<Classroom> unavailable = this.getUnavailableNow();
        long total = classroomRepository.count();
        return new ClassroomAvailabilitySummaryDTO(available.size(), unavailable.size(), (int) total);
    }

    public List<Reservation> getClassroomReservationsForDateRange(String classroomId, LocalDateTime startDate, LocalDateTime endDate) {
        if (!classroomRepository.existsById(classroomId)) {
            throw new ResourceNotFoundException("Aula no encontrada con ID: " + classroomId);
        }
        return reservationRepository.findByClassroomIdAndStartTimeBetween(classroomId, startDate, endDate, Sort.by(Sort.Direction.ASC, "startTime"));
    }
}