package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.AvailabilityRequest;
import com.backend.IMonitoring.dto.ClassroomDTO;
import com.backend.IMonitoring.dto.ClassroomRequestDTO;
import com.backend.IMonitoring.model.ClassroomType;
import com.backend.IMonitoring.model.Reservation; 
import com.backend.IMonitoring.service.ClassroomService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.Instant; 
import java.util.List;

@RestController
@RequestMapping("/api/classrooms")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class ClassroomController {

    private final ClassroomService classroomService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClassroomDTO> createClassroom(@Valid @RequestBody ClassroomRequestDTO classroomRequestDTO) {
        ClassroomDTO createdClassroomDTO = classroomService.createClassroomFromDTO(classroomRequestDTO);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdClassroomDTO.getId())
                .toUri();
        return ResponseEntity.status(HttpStatus.CREATED).body(createdClassroomDTO);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassroomDTO> getClassroomById(@PathVariable String id) {
        ClassroomDTO classroomDTO = classroomService.getClassroomDTOById(id);
        return ResponseEntity.ok(classroomDTO);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClassroomDTO> updateClassroom(@PathVariable String id, @Valid @RequestBody ClassroomRequestDTO classroomRequestDTO) {
        ClassroomDTO updatedClassroomDTO = classroomService.updateClassroomFromDTO(id, classroomRequestDTO);
        return ResponseEntity.ok(updatedClassroomDTO);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteClassroom(@PathVariable String id) {
        classroomService.deleteClassroom(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<ClassroomDTO>> getAllClassrooms() {
        List<ClassroomDTO> classrooms = classroomService.getAllClassroomsDTO();
        return ResponseEntity.ok(classrooms);
    }

    @GetMapping(params = "type")
    public ResponseEntity<List<ClassroomDTO>> getClassroomsByType(@RequestParam ClassroomType type) {
        List<ClassroomDTO> classrooms = classroomService.getClassroomsByType(type);
        return ResponseEntity.ok(classrooms);
    }

    @GetMapping(params = "minCapacity")
    public ResponseEntity<List<ClassroomDTO>> getClassroomsByMinCapacity(@RequestParam Integer minCapacity) {
        List<ClassroomDTO> classrooms = classroomService.getClassroomsByMinCapacity(minCapacity);
        return ResponseEntity.ok(classrooms);
    }

    @GetMapping("/available-now")
    public ResponseEntity<List<ClassroomDTO>> getAvailableClassroomsNow() {
        List<ClassroomDTO> classrooms = classroomService.getAvailableNow();
        return ResponseEntity.ok(classrooms);
    }
    
    @GetMapping("/unavailable-now")
    public ResponseEntity<List<ClassroomDTO>> getUnavailableClassroomsNow() {
        List<ClassroomDTO> classrooms = classroomService.getUnavailableNow();
        return ResponseEntity.ok(classrooms);
    }

    @PostMapping("/check-availability")
    public ResponseEntity<Boolean> checkClassroomAvailability(@Valid @RequestBody AvailabilityRequest availabilityRequest) {
        boolean isAvailable = classroomService.checkAvailability(availabilityRequest);
        return ResponseEntity.ok(isAvailable);
    }

    @GetMapping("/{classroomId}/reservations")
    public ResponseEntity<List<Reservation>> getReservationsForClassroom(
            @PathVariable String classroomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate, 
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,   
            @RequestParam(defaultValue = "startTime") String sortField,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        List<Reservation> reservations = classroomService.getClassroomReservationsForDateRange(classroomId, startDate, endDate, sortField, sortDirection);
        return ResponseEntity.ok(reservations);
    }
}