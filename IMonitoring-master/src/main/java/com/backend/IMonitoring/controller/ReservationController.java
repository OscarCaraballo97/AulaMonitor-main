package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.ReservationRequestDTO;
import com.backend.IMonitoring.dto.ReservationResponseDTO;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.repository.UserRepository;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.service.ReservationService;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.Instant;
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
    private final UserRepository userRepository; 

    private User getCurrentUserEntity(UserDetails userDetails) {
        if (userDetails == null) {
            throw new UnauthorizedAccessException("No se pudo obtener el principal de autenticación.");
        }
        if (userDetails instanceof UserDetailsImpl) {
            User userFromImpl = ((UserDetailsImpl) userDetails).getUserEntity();
            if (userFromImpl != null) return userFromImpl;
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con email: " + userDetails.getUsername()));
    }

    @GetMapping("/filter")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<List<ReservationResponseDTO>> getAdminFilteredReservations(
            @RequestParam(required = false) String classroomId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) ReservationStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate, // CAMBIO AQUÍ
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,   // CAMBIO AQUÍ
            @RequestParam(required = false, defaultValue = "startTime") String sortField,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection) {
        
        List<ReservationResponseDTO> reservationDTOs = reservationService.getAllReservations(
                classroomId, userId, status, startDate, endDate, sortField, sortDirection
        );
        return ResponseEntity.ok(reservationDTOs);
    }

    @GetMapping("/my-list")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<ReservationResponseDTO>> getMyReservations(
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails,
            @RequestParam(required = false) ReservationStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate, // CAMBIO AQUÍ
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,   // CAMBIO AQUÍ
            @RequestParam(required = false, defaultValue = "startTime") String sortField,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            @RequestParam(name = "upcomingOnly", required = false) Boolean upcomingOnlyParam,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        Page<ReservationResponseDTO> reservationDTOsPage = reservationService.getFilteredUserReservations(
                currentAppUser.getId(), status, sortField, sortDirection, 
                page, size, 
                upcomingOnlyParam != null && upcomingOnlyParam, 
                startDate, endDate,
                currentAppUser 
        );
        return ResponseEntity.ok(reservationDTOsPage);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReservationResponseDTO> getReservationById(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        ReservationResponseDTO reservationDTO = reservationService.getReservationById(id, currentAppUser);
        return ResponseEntity.ok(reservationDTO);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE', 'PROFESOR', 'TUTOR')") 
    public ResponseEntity<ReservationResponseDTO> createReservation(
            @Valid @RequestBody ReservationRequestDTO reservationRequestDTO, 
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        ReservationResponseDTO createdReservationDTO = reservationService.createReservation(reservationRequestDTO, currentAppUser);

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdReservationDTO.getId())
                .toUri();
        return ResponseEntity.status(HttpStatus.CREATED).body(createdReservationDTO);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')") 
    public ResponseEntity<ReservationResponseDTO> updateReservationStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateStatusRequest statusRequest,
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        if (statusRequest.getStatus() == null) {
            throw new IllegalArgumentException("El nuevo estado es obligatorio.");
        }
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        ReservationResponseDTO updatedReservationDTO = reservationService.updateReservationStatus(id, statusRequest.getStatus(), currentAppUser);
        return ResponseEntity.ok(updatedReservationDTO);
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReservationResponseDTO> updateReservationDetails(
            @PathVariable String id,
            @Valid @RequestBody ReservationRequestDTO reservationRequestDTO, 
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        ReservationResponseDTO updatedReservationDTO = reservationService.updateReservation(id, reservationRequestDTO, currentAppUser);
        return ResponseEntity.ok(updatedReservationDTO);
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReservationResponseDTO> cancelMyReservation(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        ReservationResponseDTO cancelledReservationDTO = reservationService.cancelMyReservation(id, currentAppUser);
        return ResponseEntity.ok(cancelledReservationDTO);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteReservation(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        reservationService.deleteReservation(id, currentAppUser);
        return ResponseEntity.noContent().build();
    }
}