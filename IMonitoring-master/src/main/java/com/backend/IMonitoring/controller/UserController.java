package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.service.ReservationService;
import com.backend.IMonitoring.service.UserService;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDateTime; 
import java.util.List;
import java.util.ArrayList;


@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final ReservationService reservationService; 

    @GetMapping
    public ResponseEntity<List<User>> getAllUsers(Authentication authentication) {
        UserDetailsImpl currentUserDetails = (UserDetailsImpl) authentication.getPrincipal();
        if (currentUserDetails.getRole() == Rol.ADMIN) {
            return ResponseEntity.ok(userService.getAllUsers());
        } else if (currentUserDetails.getRole() == Rol.COORDINADOR) {
            List<User> students = userService.getUsersByRole(Rol.ESTUDIANTE);
            List<User> tutors = userService.getUsersByRole(Rol.TUTOR);
            List<User> professors = userService.getUsersByRole(Rol.PROFESOR);

            List<User> combinedList = new ArrayList<>();
            combinedList.addAll(students);
            combinedList.addAll(tutors);
            combinedList.addAll(professors);
            
            return ResponseEntity.ok(combinedList);
        }
        throw new UnauthorizedAccessException("No tienes permiso para ver esta lista de usuarios.");
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable String id, Authentication authentication) {
        UserDetailsImpl currentUserDetails = (UserDetailsImpl) authentication.getPrincipal();
        User targetUser = userService.getUserById(id);

        if (currentUserDetails.getRole() == Rol.ADMIN) {
            return ResponseEntity.ok(targetUser);
        } else if (currentUserDetails.getRole() == Rol.COORDINADOR &&
                   (targetUser.getRole() == Rol.ESTUDIANTE || targetUser.getRole() == Rol.TUTOR || targetUser.getRole() == Rol.PROFESOR)) {
            return ResponseEntity.ok(targetUser);
        } else if (currentUserDetails.getId().equals(id)) {
             return ResponseEntity.ok(targetUser);
        }
        throw new UnauthorizedAccessException("No tienes permiso para ver este usuario.");
    }

    @GetMapping("/role/{role}")
    public ResponseEntity<List<User>> getUsersByRole(@PathVariable Rol role, Authentication authentication) {
        UserDetailsImpl currentUserDetails = (UserDetailsImpl) authentication.getPrincipal();
        if (currentUserDetails.getRole() == Rol.ADMIN) {
             return ResponseEntity.ok(userService.getUsersByRole(role));
        }
        else if (currentUserDetails.getRole() == Rol.COORDINADOR &&
                 (role == Rol.ESTUDIANTE || role == Rol.TUTOR || role == Rol.PROFESOR)) {
             return ResponseEntity.ok(userService.getUsersByRole(role));
        }
        
        throw new UnauthorizedAccessException("No tienes permiso para esta operación.");
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User createdUser = userService.createUser(user);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdUser.getId())
                .toUri();
        return ResponseEntity.created(location).body(createdUser);
    }

    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable String id, @RequestBody User userDetails, Authentication authentication) {
        UserDetailsImpl currentUserDetails = (UserDetailsImpl) authentication.getPrincipal();
        User userToUpdate = userService.getUserById(id);
        Rol performingUserRole = currentUserDetails.getRole();

  
        User updatedUser = userService.updateUser(id, userDetails, performingUserRole);
        return ResponseEntity.ok(updatedUser);
    }


    @GetMapping("/{userId}/reservations")
    public ResponseEntity<List<Reservation>> getUserReservations(@PathVariable String userId, Authentication authentication) {
        UserDetailsImpl currentUserDetails = (UserDetailsImpl) authentication.getPrincipal();
        User targetUser = userService.getUserById(userId); 

        if (currentUserDetails.getRole() == Rol.ADMIN) {
  
            return ResponseEntity.ok(reservationService.getReservationsByUserId(userId));
        } else if (currentUserDetails.getRole() == Rol.COORDINADOR &&
                   (targetUser.getRole() == Rol.ESTUDIANTE || targetUser.getRole() == Rol.TUTOR || targetUser.getRole() == Rol.PROFESOR) ) {
            return ResponseEntity.ok(reservationService.getReservationsByUserId(userId));
        } else if (currentUserDetails.getId().equals(userId)) {
            return ResponseEntity.ok(reservationService.getReservationsByUserId(userId));
        }
        throw new UnauthorizedAccessException("No tienes permiso para ver las reservas de este usuario.");
    }

    @GetMapping("/me/reservations")
    public ResponseEntity<List<Reservation>> getCurrentUserReservations(
            @RequestParam(name = "status", required = false) ReservationStatus status,
            @RequestParam(name = "sort", required = false, defaultValue = "startTime,asc") String sort,
            @RequestParam(name = "limit", required = false, defaultValue = "10") int limit,
            @RequestParam(name = "futureOnly", required = false, defaultValue = "false") boolean futureOnly,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate
    ) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String currentUserId = userDetails.getId();

        String sortField = "startTime";
        String sortDirection = "asc";
        if (sort != null && sort.contains(",")) {
            String[] sortParams = sort.split(",");
            sortField = sortParams[0];
            if (sortParams.length > 1) sortDirection = sortParams[1];
        }
        List<Reservation> userReservations = reservationService.getFilteredUserReservations(
            currentUserId, status, sortDirection, sortField, 0, limit, futureOnly,
            startDate, endDate 
        );
        
        return ResponseEntity.ok(userReservations);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {

        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}