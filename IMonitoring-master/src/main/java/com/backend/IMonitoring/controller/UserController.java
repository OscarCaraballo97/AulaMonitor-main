package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.UpdatePasswordRequest;
import com.backend.IMonitoring.dto.UserDTO;
import com.backend.IMonitoring.dto.ReservationResponseDTO;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.service.ReservationService;
import com.backend.IMonitoring.service.UserService;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor

public class UserController {
    private final UserService userService;
    private final ReservationService reservationService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> getCurrentUserDetails(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        return ResponseEntity.ok(UserDTO.fromEntity(currentUser.getUserEntity()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<List<UserDTO>> getAllUsers(@AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        List<User> usersToProcess;
        if (currentUserDetails.getRoleEnum() == Rol.ADMIN) {
            usersToProcess = userService.getAllUsers();
        } else if (currentUserDetails.getRoleEnum() == Rol.COORDINADOR) {
            List<User> students = userService.getUsersByRole(Rol.ESTUDIANTE);
            List<User> tutors = userService.getUsersByRole(Rol.TUTOR);
            List<User> professors = userService.getUsersByRole(Rol.PROFESOR);
            usersToProcess = new ArrayList<>();
            usersToProcess.addAll(students);
            usersToProcess.addAll(tutors);
            usersToProcess.addAll(professors);
        } else {

            throw new UnauthorizedAccessException("No tienes permiso para ver esta lista de usuarios.");
        }
        return ResponseEntity.ok(usersToProcess.stream().map(UserDTO::fromEntity).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
   
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR') or #id == authentication.principal.id")
    public ResponseEntity<UserDTO> getUserById(@PathVariable String id, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User targetUser = userService.getUserById(id);

        boolean isAdmin = currentUserDetails.getRoleEnum() == Rol.ADMIN;
        boolean isCoordinator = currentUserDetails.getRoleEnum() == Rol.COORDINADOR;
        boolean isSelf = currentUserDetails.getId().equals(id);

        if (isAdmin || isSelf) {
            return ResponseEntity.ok(UserDTO.fromEntity(targetUser));
        }
        if (isCoordinator && (targetUser.getRole() == Rol.ESTUDIANTE || targetUser.getRole() == Rol.TUTOR || targetUser.getRole() == Rol.PROFESOR)) {
            return ResponseEntity.ok(UserDTO.fromEntity(targetUser));
        }
     
        throw new UnauthorizedAccessException("No tienes permiso para ver este usuario.");
    }

    @GetMapping("/role/{role}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<List<UserDTO>> getUsersByRole(@PathVariable Rol role, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        boolean isAdmin = currentUserDetails.getRoleEnum() == Rol.ADMIN;
        boolean isCoordinator = currentUserDetails.getRoleEnum() == Rol.COORDINADOR;

        if (isAdmin) {
             return ResponseEntity.ok(userService.getUsersByRole(role).stream().map(UserDTO::fromEntity).collect(Collectors.toList()));
        }
        if (isCoordinator && (role == Rol.ESTUDIANTE || role == Rol.TUTOR || role == Rol.PROFESOR)) {
             return ResponseEntity.ok(userService.getUsersByRole(role).stream().map(UserDTO::fromEntity).collect(Collectors.toList()));
        }

        throw new UnauthorizedAccessException("No tienes permiso para ver usuarios con este rol.");
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody UserDTO userDTO, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) { // Añadido currentUserDetails
        User performingUser = currentUserDetails.getUserEntity();
        User createdUser = userService.createUser(userDTO, performingUser);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdUser.getId())
                .toUri();
        return ResponseEntity.created(location).body(UserDTO.fromEntity(createdUser));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> updateUser(
            @PathVariable String id,
            @Valid @RequestBody UserDTO userDTO,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User performingUser = currentUser.getUserEntity();
        User updatedUser = userService.updateUser(id, userDTO, performingUser);
        return ResponseEntity.ok(UserDTO.fromEntity(updatedUser));
    }

    @PatchMapping("/{id}/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> updateUserPassword(
            @PathVariable String id,
            @Valid @RequestBody UpdatePasswordRequest passwordRequest,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        userService.updateUserPassword(id, passwordRequest.getCurrentPassword(), passwordRequest.getNewPassword(), currentUser.getUserEntity());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{userId}/reservations")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR') or #userId == authentication.principal.id")
    public ResponseEntity<List<ReservationResponseDTO>> getUserReservations(@PathVariable String userId) {
        List<ReservationResponseDTO> reservations = reservationService.getReservationsByUserIdDTO(userId);
        return ResponseEntity.ok(reservations);
    }

    @GetMapping("/me/reservations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ReservationResponseDTO>> getCurrentUserReservations(
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails,
            @RequestParam(name = "status", required = false) ReservationStatus status,
            @RequestParam(name = "sortField", required = false, defaultValue = "startTime") String sortField,
            @RequestParam(name = "sortDirection", required = false, defaultValue = "asc") String sortDirection,
            @RequestParam(name = "limit", required = false) Integer limit,
            @RequestParam(name = "futureOnly", required = false, defaultValue = "false") boolean futureOnly,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "1000") int size) { 
        String currentUserId = currentUserDetails.getId();

        List<ReservationResponseDTO> userReservationsDTO = reservationService.getFilteredUserReservations(
            currentUserId, status, sortField, sortDirection, page, size, futureOnly, startDate, endDate
        );

        if (limit != null && limit > 0 && userReservationsDTO.size() > limit && page == 0) { 
            userReservationsDTO = userReservationsDTO.subList(0, Math.min(limit, userReservationsDTO.size()));
        }
        return ResponseEntity.ok(userReservationsDTO);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')") 
    public ResponseEntity<Void> deleteUser(@PathVariable String id, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) { // Añadido currentUserDetails
        User performingUser = currentUserDetails.getUserEntity();
        userService.deleteUser(id, performingUser); 
        return ResponseEntity.noContent().build();
    }
}