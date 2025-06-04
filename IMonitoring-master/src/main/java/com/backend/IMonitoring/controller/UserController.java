package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.UpdatePasswordRequest;
import com.backend.IMonitoring.dto.UserDTO;
import com.backend.IMonitoring.dto.ReservationResponseDTO;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.repository.UserRepository;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.service.ReservationService;
import com.backend.IMonitoring.service.UserService;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class UserController {

    private final UserService userService;
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

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> getCurrentUserDetails(@AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User appUser = getCurrentUserEntity(currentUserDetails);
        return ResponseEntity.ok(UserDTO.fromEntity(appUser));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<List<UserDTO>> getAllUsers(@AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User performingUser = getCurrentUserEntity(currentUserDetails);
        List<User> usersToProcess;

        if (performingUser.getRole() == Rol.ADMIN) {
            usersToProcess = userService.getAllUsers();
        } else if (performingUser.getRole() == Rol.COORDINADOR) {
            List<User> students = userService.getUsersByRole(Rol.ESTUDIANTE);
            List<User> tutors = userService.getUsersByRole(Rol.TUTOR);
            List<User> professors = userService.getUsersByRole(Rol.PROFESOR);
            usersToProcess = new ArrayList<>();
            if (students != null) usersToProcess.addAll(students);
            if (tutors != null) usersToProcess.addAll(tutors);
            if (professors != null) usersToProcess.addAll(professors);
        } else {
            throw new UnauthorizedAccessException("No tienes permiso para ver esta lista de usuarios.");
        }
        return ResponseEntity.ok(usersToProcess.stream().map(UserDTO::fromEntity).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('COORDINADOR') or #id == principal.id")
    public ResponseEntity<UserDTO> getUserById(@PathVariable String id, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User targetUser = userService.getUserById(id); 
        User performingUser = getCurrentUserEntity(currentUserDetails);

        boolean isAdmin = performingUser.getRole() == Rol.ADMIN;
        boolean isSelf = performingUser.getId().equals(id);

        if (isAdmin || isSelf) {
            return ResponseEntity.ok(UserDTO.fromEntity(targetUser));
        }
        if (performingUser.getRole() == Rol.COORDINADOR && 
            targetUser != null && (targetUser.getRole() == Rol.ESTUDIANTE || targetUser.getRole() == Rol.TUTOR || targetUser.getRole() == Rol.PROFESOR)) {
            return ResponseEntity.ok(UserDTO.fromEntity(targetUser));
        }
        throw new UnauthorizedAccessException("No tienes permiso para ver este usuario.");
    }

    @GetMapping("/role/{role}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<List<UserDTO>> getUsersByRole(@PathVariable Rol role, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User performingUser = getCurrentUserEntity(currentUserDetails);
        if (performingUser.getRole() == Rol.ADMIN || 
            (performingUser.getRole() == Rol.COORDINADOR && (role == Rol.ESTUDIANTE || role == Rol.TUTOR || role == Rol.PROFESOR))) {
            return ResponseEntity.ok(userService.getUsersByRole(role).stream().map(UserDTO::fromEntity).collect(Collectors.toList()));
        }
        throw new UnauthorizedAccessException("No tienes permiso para ver usuarios con este rol.");
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody UserDTO userDTO, @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User performingUser = getCurrentUserEntity(currentUserDetails);
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
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User performingUser = getCurrentUserEntity(currentUserDetails);
        User updatedUser = userService.updateUser(id, userDTO, performingUser);
        return ResponseEntity.ok(UserDTO.fromEntity(updatedUser));
    }

    @PatchMapping("/{id}/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> updateUserPassword(
            @PathVariable String id,
            @Valid @RequestBody UpdatePasswordRequest passwordRequest,
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User performingUser = getCurrentUserEntity(currentUserDetails);
        userService.updateUserPassword(id, passwordRequest.getCurrentPassword(), passwordRequest.getNewPassword(), performingUser);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{userId}/reservations")
    @PreAuthorize("hasRole('ADMIN') or hasRole('COORDINADOR') or #userId == principal.id")
    public ResponseEntity<List<ReservationResponseDTO>> getUserReservations(
            @PathVariable String userId,
            @RequestParam(required = false, defaultValue = "startTime") String sortField,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        List<ReservationResponseDTO> reservations = reservationService.getAllReservations(
                null, userId, null, null, null, sortField, sortDirection
        );
        return ResponseEntity.ok(reservations);
    }

    @GetMapping("/me/reservations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<ReservationResponseDTO>> getCurrentUserReservations(
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails,
            @RequestParam(name = "status", required = false) ReservationStatus status,
            @RequestParam(name = "sortField", required = false, defaultValue = "startTime") String sortField,
            @RequestParam(name = "sortDirection", required = false, defaultValue = "desc") String sortDirection,
            @RequestParam(name = "upcomingOnly", required = false) Boolean upcomingOnlyParam,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate, // CAMBIO AQUÍ
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,   // CAMBIO AQUÍ
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {  
        
        User currentAppUser = getCurrentUserEntity(currentUserDetails);
        Page<ReservationResponseDTO> userReservationsPage = reservationService.getFilteredUserReservations(
                currentAppUser.getId(), 
                status, 
                sortField, 
                sortDirection, 
                page, 
                size, 
                upcomingOnlyParam != null && upcomingOnlyParam,
                startDate, 
                endDate,
                currentAppUser 
        );
        return ResponseEntity.ok(userReservationsPage);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')") 
    public ResponseEntity<Void> deleteUser(
            @PathVariable String id, 
            @AuthenticationPrincipal UserDetailsImpl currentUserDetails) {
        User performingUser = getCurrentUserEntity(currentUserDetails);
        userService.deleteUser(id, performingUser); 
        return ResponseEntity.noContent().build();
    }
}