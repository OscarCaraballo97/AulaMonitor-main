package com.backend.IMonitoring.service;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import com.backend.IMonitoring.exceptions.InvalidReservationException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReservationService {
    private final ReservationRepository reservationRepository;
    private final ClassroomRepository classroomRepository;
    private final UserService userService;

    public List<Reservation> getAllReservations() {
        return reservationRepository.findAll(Sort.by(Sort.Direction.DESC, "startTime"));
    }

    public List<Reservation> getAdminFilteredReservations(
            String classroomId, String userId, ReservationStatus status,
            LocalDateTime startDate, LocalDateTime endDate) {
        
        Sort sort = Sort.by(Sort.Direction.DESC, "startTime");

        if (startDate != null && endDate != null) {
            if (classroomId != null) return reservationRepository.findByClassroomIdAndStartTimeBetween(classroomId, startDate, endDate, sort);
            if (userId != null) return reservationRepository.findByUserIdAndStartTimeBetween(userId, startDate, endDate, sort);
            if (status != null) return reservationRepository.findByStatusAndStartTimeBetween(status, startDate, endDate, sort);
            return reservationRepository.findByStartTimeBetween(startDate, endDate, sort);
        } else { 
            if (status != null) return reservationRepository.findByStatus(status, sort);
            if (userId != null) return reservationRepository.findByUserId(userId, sort);
            if (classroomId != null) return reservationRepository.findByClassroomId(classroomId, sort);
        }
        return getAllReservations();
    }

    public Reservation getReservationById(String id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + id));
    }
    
    public List<Reservation> getFilteredUserReservations(
            String userId,
            ReservationStatus status,
            String sortDirection,
            String sortField,
            int page, 
            int size,
            boolean futureOnly, // Este se usa si startDate y endDate son null
            LocalDateTime startDate,
            LocalDateTime endDate
    ) {
        Sort sortObj = Sort.by(sortDirection.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortField);
        
        if (startDate != null && endDate != null) {
            if (status != null) {
                return reservationRepository.findByUserIdAndStatusAndStartTimeBetween(userId, status, startDate, endDate, sortObj);
            } else {
                return reservationRepository.findByUserIdAndStartTimeBetween(userId, startDate, endDate, sortObj);
            }
        } else if (futureOnly) { // Solo aplica si no se especificó un rango de fechas
            LocalDateTime now = LocalDateTime.now();
            if (status != null) {
                return reservationRepository.findByUserIdAndStatusAndStartTimeAfter(userId, status, now, sortObj);
            } else {
                return reservationRepository.findByUserIdAndStartTimeAfter(userId, now, sortObj);
            }
        } else { // Sin filtro de fecha específico
             if (status != null) {
                return reservationRepository.findByUserIdAndStatus(userId, status, sortObj);
            } else {
                return reservationRepository.findByUserId(userId, sortObj);
            }
        }
    }

    @Transactional
    public Reservation createReservation(Reservation reservationInput, UserDetails currentUserDetails) {
        if (reservationInput.getClassroom() == null || reservationInput.getClassroom().getId() == null) {
            throw new InvalidReservationException("ID del aula es requerido para crear una reserva.");
        }
        Classroom classroom = classroomRepository.findById(reservationInput.getClassroom().getId())
            .orElseThrow(() -> new ResourceNotFoundException("Aula no encontrada con ID: " + reservationInput.getClassroom().getId()));
        reservationInput.setClassroom(classroom);

        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userMakingReservation = userDetailsImpl.getUserEntity();

        User userToReserveFor;
        if ((userMakingReservation.getRole() == Rol.ADMIN || userMakingReservation.getRole() == Rol.COORDINADOR) &&
            reservationInput.getUser() != null && reservationInput.getUser().getId() != null &&
            !Objects.equals(reservationInput.getUser().getId(), userMakingReservation.getId())) {
            User targetUser = userService.getUserById(reservationInput.getUser().getId());
            if (userMakingReservation.getRole() == Rol.COORDINADOR && targetUser.getRole() != Rol.ESTUDIANTE) {
                throw new UnauthorizedAccessException("Coordinadores solo pueden crear reservas para estudiantes.");
            }
            userToReserveFor = targetUser;
        } else {
            userToReserveFor = userMakingReservation;
        }
        reservationInput.setUser(userToReserveFor);

        if (reservationInput.getStartTime() == null || reservationInput.getEndTime() == null) {
            throw new InvalidReservationException("Las fechas de inicio y fin son requeridas.");
        }
        
        boolean isAvailable = classroomRepository.isAvailable(
                reservationInput.getClassroom().getId(),
                reservationInput.getStartTime(),
                reservationInput.getEndTime()
        );

        if (!isAvailable) {
            throw new InvalidReservationException("La sala no está disponible en el horario solicitado: " +
                reservationInput.getClassroom().getName() + " de " +
                reservationInput.getStartTime() + " a " + reservationInput.getEndTime());
        }

        reservationInput.setStatus(ReservationStatus.PENDIENTE); 
        return reservationRepository.save(reservationInput);
    }

    @Transactional
    public Reservation updateReservationStatus(String id, ReservationStatus newStatus, UserDetails adminOrCoordinatorDetails) {
        UserDetailsImpl userDetails = (UserDetailsImpl) adminOrCoordinatorDetails;
        User userPerformingAction = userDetails.getUserEntity();
        Reservation reservation = getReservationById(id);

        boolean isAdmin = userPerformingAction.getRole() == Rol.ADMIN;
        boolean isCoordinator = userPerformingAction.getRole() == Rol.COORDINADOR;

        if (!isAdmin && !isCoordinator) {
            throw new UnauthorizedAccessException("Solo Administradores o Coordinadores pueden cambiar el estado de una reserva.");
        }

        if (isCoordinator && (reservation.getUser() == null || reservation.getUser().getRole() != Rol.ESTUDIANTE)) {
            throw new UnauthorizedAccessException("Coordinadores solo pueden modificar el estado de reservas de estudiantes.");
        }
        
        if (reservation.getStatus() == ReservationStatus.PENDIENTE &&
            (newStatus == ReservationStatus.CONFIRMADA || newStatus == ReservationStatus.RECHAZADA)) {
            reservation.setStatus(newStatus);
        } else if ( (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) &&
                   newStatus == ReservationStatus.CANCELADA ) {
             reservation.setStatus(newStatus);
        }
        else if (isAdmin && reservation.getStatus() != newStatus) { 
            reservation.setStatus(newStatus);
        }
        else {
            throw new InvalidReservationException("Transición de estado no permitida (" + reservation.getStatus() + " -> " + newStatus + ") o acción no permitida para tu rol.");
        }
        return reservationRepository.save(reservation);
    }
    
    @Transactional
    public Reservation updateReservation(String reservationId, Reservation updatedReservationData, UserDetails currentUserDetails) {
        Reservation existingReservation = getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userUpdating = userDetailsImpl.getUserEntity();

        boolean isAdmin = userUpdating.getRole().equals(Rol.ADMIN);
        boolean isCoordinator = userUpdating.getRole().equals(Rol.COORDINADOR);
        boolean isOwner = existingReservation.getUser() != null && Objects.equals(existingReservation.getUser().getId(), userUpdating.getId());

        if (!isAdmin && !isCoordinator && !isOwner) {
            throw new UnauthorizedAccessException("No tienes permiso para modificar esta reserva.");
        }
        if (isCoordinator && (existingReservation.getUser() == null || existingReservation.getUser().getRole() != Rol.ESTUDIANTE) && !isOwner) {
             throw new UnauthorizedAccessException("Coordinadores solo pueden modificar reservas de estudiantes (o las propias).");
        }
        if (!isAdmin && !isCoordinator && isOwner && existingReservation.getStatus() != ReservationStatus.PENDIENTE) {
             throw new InvalidReservationException("Solo puedes modificar tus propias reservas si están en estado PENDIENTE.");
        }

        existingReservation.setStartTime(updatedReservationData.getStartTime());
        existingReservation.setEndTime(updatedReservationData.getEndTime());
        existingReservation.setPurpose(updatedReservationData.getPurpose());

        if (isAdmin || (isCoordinator && existingReservation.getUser() != null && existingReservation.getUser().getRole() == Rol.ESTUDIANTE)) {
            if (updatedReservationData.getClassroom() != null && updatedReservationData.getClassroom().getId() != null &&
                !Objects.equals(existingReservation.getClassroom().getId(), updatedReservationData.getClassroom().getId())) {
                Classroom newClassroom = classroomRepository.findById(updatedReservationData.getClassroom().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Aula no encontrada con ID: " + updatedReservationData.getClassroom().getId()));
                existingReservation.setClassroom(newClassroom);
            }
            if (isAdmin && updatedReservationData.getUser() != null && updatedReservationData.getUser().getId() != null &&
                !Objects.equals(existingReservation.getUser().getId(), updatedReservationData.getUser().getId())) {
                User newUser = userService.getUserById(updatedReservationData.getUser().getId());
                existingReservation.setUser(newUser);
            }
        }

        boolean isAvailable = classroomRepository.isAvailable(
                existingReservation.getClassroom().getId(),
                existingReservation.getStartTime(),
                existingReservation.getEndTime(),
                existingReservation.getId() 
        );
        if (!isAvailable) {
            throw new InvalidReservationException("La sala no está disponible en el nuevo horario solicitado.");
        }
        return reservationRepository.save(existingReservation);
    }

    @Transactional
    public Reservation cancelMyReservation(String reservationId, UserDetails currentUserDetails) {
        Reservation reservation = getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userCancelling = userDetailsImpl.getUserEntity();

        boolean isAdmin = userCancelling.getRole() == Rol.ADMIN;
        boolean isCoordinator = userCancelling.getRole() == Rol.COORDINADOR;
        boolean isOwner = reservation.getUser() != null && Objects.equals(reservation.getUser().getId(), userCancelling.getId());

        if (!isOwner && !isAdmin && !(isCoordinator && reservation.getUser() != null && reservation.getUser().getRole() == Rol.ESTUDIANTE)) {
             throw new UnauthorizedAccessException("No tienes permiso para cancelar esta reserva.");
        }

        if (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) {
            reservation.setStatus(ReservationStatus.CANCELADA);
            return reservationRepository.save(reservation);
        } else {
            throw new InvalidReservationException("Solo se pueden cancelar reservas pendientes o confirmadas. Estado actual: " + reservation.getStatus());
        }
    }
    
    @Transactional
    public void deleteReservation(String reservationId, UserDetails currentUserDetails) {
        Reservation reservation = getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userDeleting = userDetailsImpl.getUserEntity();

        boolean isAdmin = userDeleting.getRole() == Rol.ADMIN;
        boolean isCoordinatorDeletingStudentReservation = userDeleting.getRole() == Rol.COORDINADOR && 
                                                          reservation.getUser() != null && 
                                                          reservation.getUser().getRole() == Rol.ESTUDIANTE;
        boolean isOwnerAndAllowedStatus = reservation.getUser() != null && 
                                          Objects.equals(reservation.getUser().getId(), userDeleting.getId()) &&
                                          (reservation.getStatus() == ReservationStatus.PENDIENTE || 
                                           reservation.getStatus() == ReservationStatus.CANCELADA ||
                                           reservation.getStatus() == ReservationStatus.RECHAZADA);
                                           
        if (isAdmin || isOwnerAndAllowedStatus || isCoordinatorDeletingStudentReservation) {
            reservationRepository.deleteById(reservationId);
        } else {
            throw new UnauthorizedAccessException("No tienes permiso para eliminar esta reserva o el estado actual no lo permite.");
        }
    }
    
    public List<Reservation> getReservationsByStatus(ReservationStatus status) {
        return reservationRepository.findByStatus(status, Sort.by(Sort.Direction.DESC, "startTime"));
    }

    public List<Reservation> getUpcomingReservations(int limit) {
        return reservationRepository.findByStartTimeAfter(LocalDateTime.now(), Sort.by(Sort.Direction.ASC, "startTime"))
            .stream().limit(limit).collect(Collectors.toList());
    }
    
    public List<Reservation> getMyUpcomingReservations(String userId, int limit) {
        Sort sort = Sort.by(Sort.Direction.ASC, "startTime");
        return reservationRepository.findUpcomingConfirmedByUserId(userId, LocalDateTime.now(), sort)
            .stream().limit(limit).collect(Collectors.toList());
    }

    public List<Reservation> getCurrentReservations() {
        LocalDateTime now = LocalDateTime.now();
        return reservationRepository.findCurrentReservations(now);
    }

    public List<Reservation> getReservationsByUserId(String userId) {
        return reservationRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "startTime"));
    }
}