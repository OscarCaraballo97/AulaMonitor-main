package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.dto.ClassroomAvailabilitySummaryDTO;
import com.backend.IMonitoring.dto.ClassroomDTO; // Importar ClassroomDTO
import com.backend.IMonitoring.dto.ClassroomRequestDTO;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.service.ClassroomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/classrooms")
@RequiredArgsConstructor
public class ClassroomController {
    private final ClassroomService classroomService;

    // Modificado para devolver List<ClassroomDTO>
    @GetMapping
    public ResponseEntity<List<ClassroomDTO>> getAllClassrooms() {
        return ResponseEntity.ok(classroomService.getAllClassroomsDTO());
    }

    // El resto de métodos que devuelven Classroom individuales podrían ser modificados a ClassroomDTO también si se desea consistencia
    // Por ahora, solo se cambia getAllClassrooms para abordar el error de la lista.
    @GetMapping("/{id}")
    public ResponseEntity<Classroom> getClassroomById(@PathVariable String id) {
        return ResponseEntity.ok(classroomService.getClassroomById(id));
    }

    @PostMapping
    public ResponseEntity<Classroom> createClassroom(@Valid @RequestBody ClassroomRequestDTO classroomRequestDTO) {
        Classroom createdClassroom = classroomService.createClassroomFromDTO(classroomRequestDTO);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdClassroom.getId())
                .toUri();
        return ResponseEntity.created(location).body(createdClassroom);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Classroom> updateClassroom(@PathVariable String id, @Valid @RequestBody ClassroomRequestDTO classroomRequestDTO) {
        Classroom updatedClassroom = classroomService.updateClassroomFromDTO(id, classroomRequestDTO);
        return ResponseEntity.ok(updatedClassroom);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClassroom(@PathVariable String id) {
        classroomService.deleteClassroom(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/type/{type}")
    public ResponseEntity<List<Classroom>> getClassroomsByType(@PathVariable ClassroomType type) {
        return ResponseEntity.ok(classroomService.getClassroomsByType(type));
    }

    @GetMapping("/capacity/{minCapacity}")
    public ResponseEntity<List<Classroom>> getClassroomsByMinCapacity(@PathVariable Integer minCapacity) {
        return ResponseEntity.ok(classroomService.getClassroomsByMinCapacity(minCapacity));
    }

    @GetMapping("/available-now")
    public ResponseEntity<List<Classroom>> getAvailableClassroomsNow() {
        return ResponseEntity.ok(classroomService.getAvailableNow());
    }

    @GetMapping("/unavailable-now")
    public ResponseEntity<List<Classroom>> getUnavailableClassroomsNow() {
        return ResponseEntity.ok(classroomService.getUnavailableNow());
    }

    @GetMapping("/stats/availability")
    public ResponseEntity<ClassroomAvailabilitySummaryDTO> getAvailabilitySummary() {
        return ResponseEntity.ok(classroomService.getAvailabilitySummary());
    }

    @PostMapping("/check-availability")
    public ResponseEntity<Map<String, Boolean>> checkClassroomAvailability(@Valid @RequestBody AvailabilityRequest request) {
        boolean isAvailable = classroomService.checkAvailability(request);
        return ResponseEntity.ok(Map.of("isAvailable", isAvailable));
    }

    @GetMapping("/{classroomId}/reservations-by-date")
    public ResponseEntity<List<Reservation>> getClassroomReservationsForDateRange(
            @PathVariable String classroomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate, // Espera formato ISO
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        List<Reservation> reservations = classroomService.getClassroomReservationsForDateRange(classroomId, startDate, endDate);
        return ResponseEntity.ok(reservations);
    }
}