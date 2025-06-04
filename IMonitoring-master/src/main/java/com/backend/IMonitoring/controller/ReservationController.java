package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.ReservationRequestDTO;
import com.backend.IMonitoring.dto.ReservationResponseDTO;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.service.ReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;

class UpdateStatusRequest {
    private ReservationStatus status;
    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus status) { this.status = status; }
}

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class ReservationController {

    private final ReservationService reservationService;


    @GetMapping("/filter")
    public ResponseEntity<List<ReservationResponseDTO>> getAdminFilteredReservations(
            @RequestParam(required = false) String classroomId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) ReservationStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false, defaultValue = "startTime") String sortField,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection) {
        
        List<ReservationResponseDTO> reservationDTOs = reservationService.getAdminFilteredReservations(
                classroomId, userId, status, startDate, endDate, sortField, sortDirection
        );
        return ResponseEntity.ok(reservationDTOs);
    }

    @GetMapping("/my-list")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ReservationResponseDTO>> getMyReservations(
            @AuthenticationPrincipal UserDetails currentUserDetails,
            @RequestParam(required = false) ReservationStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false, defaultValue = "startTime") String sortField,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            @RequestParam(required = false) Boolean futureOnly,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        String currentAuthUserId = userDetailsImpl.getId();

        List<ReservationResponseDTO> reservationDTOs = reservationService.getFilteredUserReservations(
                currentAuthUserId, status, sortField, sortDirection, 
                page, size, 
                futureOnly != null && futureOnly, 
                startDate, endDate
        );
        
        return ResponseEntity.ok(reservationDTOs);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReservationResponseDTO> getReservationById(@PathVariable String id) {
        return ResponseEntity.ok(reservationService.getReservationByIdDTO(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE', 'PROFESOR', 'TUTOR')") 
    public ResponseEntity<ReservationResponseDTO> createReservation(
            @Valid @RequestBody ReservationRequestDTO reservationRequestDTO,
            @AuthenticationPrincipal UserDetails currentUserDetails) {
        
        Reservation reservation = new Reservation();
        
        if (reservationRequestDTO.getClassroomId() != null) {
            Classroom partialClassroom = new Classroom();
            partialClassroom.setId(reservationRequestDTO.getClassroomId());
            reservation.setClassroom(partialClassroom);
        } else {
            throw new IllegalArgumentException("El ID del aula es obligatorio.");
        }

        if (reservationRequestDTO.getUserId() != null && !reservationRequestDTO.getUserId().isEmpty()) {
            User targetUser = new User();
            targetUser.setId(reservationRequestDTO.getUserId());
            reservation.setUser(targetUser);
        }
        
        if (reservationRequestDTO.getStatus() != null) { 
            reservation.setStatus(reservationRequestDTO.getStatus());
        }

        reservation.setStartTime(reservationRequestDTO.getStartTime());
        reservation.setEndTime(reservationRequestDTO.getEndTime());
        reservation.setPurpose(reservationRequestDTO.getPurpose());

        Reservation createdReservationEntity = reservationService.createReservation(reservation, currentUserDetails);
        ReservationResponseDTO responseDTO = reservationService.convertToDTO(createdReservationEntity);

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(responseDTO.getId())
                .toUri();
        return ResponseEntity.created(location).body(responseDTO);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')") 
    public ResponseEntity<ReservationResponseDTO> updateReservationStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateStatusRequest statusRequest,
            @AuthenticationPrincipal UserDetails currentUserDetails) {
        if (statusRequest.getStatus() == null) {
            throw new IllegalArgumentException("El nuevo estado es obligatorio.");
        }
        Reservation updatedReservationEntity = reservationService.updateReservationStatus(id, statusRequest.getStatus(), currentUserDetails);
        return ResponseEntity.ok(reservationService.convertToDTO(updatedReservationEntity));
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReservationResponseDTO> updateReservationDetails(
            @PathVariable String id,
            @Valid @RequestBody ReservationRequestDTO reservationRequestDTO, 
            @AuthenticationPrincipal UserDetails currentUserDetails) {
        
        Reservation reservationDetailsToUpdate = new Reservation();
        if (reservationRequestDTO.getClassroomId() != null) {
            Classroom partialClassroom = new Classroom();
            partialClassroom.setId(reservationRequestDTO.getClassroomId());
            reservationDetailsToUpdate.setClassroom(partialClassroom);
        }
        if (reservationRequestDTO.getUserId() != null && !reservationRequestDTO.getUserId().isEmpty()) {
            User partialUser = new User();
            partialUser.setId(reservationRequestDTO.getUserId());
            reservationDetailsToUpdate.setUser(partialUser);
        }
        if (reservationRequestDTO.getStatus() != null) {
            reservationDetailsToUpdate.setStatus(reservationRequestDTO.getStatus());
        }
        reservationDetailsToUpdate.setStartTime(reservationRequestDTO.getStartTime());
        reservationDetailsToUpdate.setEndTime(reservationRequestDTO.getEndTime());
        reservationDetailsToUpdate.setPurpose(reservationRequestDTO.getPurpose());
        
        Reservation updatedReservationEntity = reservationService.updateReservation(id, reservationDetailsToUpdate, currentUserDetails);
        return ResponseEntity.ok(reservationService.convertToDTO(updatedReservationEntity));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReservationResponseDTO> cancelMyReservation(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails currentUserDetails) {
        Reservation cancelledReservation = reservationService.cancelMyReservation(id, currentUserDetails);
        return ResponseEntity.ok(reservationService.convertToDTO(cancelledReservation));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteReservation(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails currentUserDetails) {
        reservationService.deleteReservation(id, currentUserDetails);
        return ResponseEntity.noContent().build();
    }
}