package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.ReservationResponseDTO;
import com.backend.IMonitoring.dto.ClassroomSummaryDTO;
import com.backend.IMonitoring.dto.UserSummaryDTO;
import com.backend.IMonitoring.model.*;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import com.backend.IMonitoring.exceptions.InvalidReservationException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public ReservationResponseDTO convertToDTO(Reservation reservation) {
        if (reservation == null) {
            return null;
        }
        User userEntity = reservation.getUser();
        UserSummaryDTO userSummary = null;
        if (userEntity != null) {
            userSummary = new UserSummaryDTO(userEntity.getId(), userEntity.getName(), userEntity.getEmail(), userEntity.getRole());
        }

        Classroom classroomEntity = reservation.getClassroom();
        ClassroomSummaryDTO classroomSummary = null;
        if (classroomEntity != null) {
            String buildingName = (classroomEntity.getBuilding() != null) ? classroomEntity.getBuilding().getName() : null;
            classroomSummary = new ClassroomSummaryDTO(classroomEntity.getId(), classroomEntity.getName(), buildingName);
        }

        return ReservationResponseDTO.builder()
                .id(reservation.getId())
                .classroom(classroomSummary)
                .user(userSummary)
                .startTime(reservation.getStartTime())
                .endTime(reservation.getEndTime())
                .status(reservation.getStatus())
                .purpose(reservation.getPurpose())
                .createdAt(reservation.getCreatedAt()) 
                .updatedAt(reservation.getUpdatedAt())
                .build();
    }

    private List<ReservationResponseDTO> convertToDTOList(List<Reservation> reservations) {
        if (reservations == null) {
            return List.of();
        }
        return reservations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }


    public Reservation getReservationById(String id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + id));
    }
    
    public ReservationResponseDTO getReservationByIdDTO(String id) {
        Reservation reservation = getReservationById(id);
        return convertToDTO(reservation);
    }

    public List<ReservationResponseDTO> getAdminFilteredReservations(
            String classroomId, String userId, ReservationStatus status,
            LocalDateTime startDate, LocalDateTime endDate,
            String sortField, String sortDirection) {
        Sort sort;
        if (sortField != null && !sortField.isEmpty()) {
            Sort.Direction direction = (sortDirection != null && sortDirection.equalsIgnoreCase("desc")) ?
                                         Sort.Direction.DESC : Sort.Direction.ASC;
            sort = Sort.by(direction, sortField);
        } else {
            sort = Sort.by(Sort.Direction.DESC, "startTime"); 
        }
        
        List<Reservation> reservationsList;
        
        if (status != null) {
            reservationsList = reservationRepository.findByStatus(status, sort);
        } else if (classroomId != null && !classroomId.isEmpty() && startDate != null && endDate != null) {
            reservationsList = reservationRepository.findByClassroomIdAndStartTimeBetween(classroomId, startDate, endDate, sort);
        } else if (userId != null && !userId.isEmpty()) {
            reservationsList = reservationRepository.findByUserId(userId, sort);
        }
          else {
            reservationsList = reservationRepository.findAll(sort);
        }
        return convertToDTOList(reservationsList);
    }

    public List<ReservationResponseDTO> getFilteredUserReservations(
            String userIdAuth, ReservationStatus status,
            String sortField, String sortDirection, 
            Integer page, Integer size, 
            boolean futureOnly,
            LocalDateTime startDate, LocalDateTime endDate) {
        Sort sort;
        if (sortField != null && !sortField.isEmpty()) {
            Sort.Direction direction = (sortDirection != null && sortDirection.equalsIgnoreCase("desc")) ?
                                       Sort.Direction.DESC : Sort.Direction.ASC;
            sort = Sort.by(direction, sortField);
        } else {
            sort = Sort.by(Sort.Direction.DESC, "startTime");
        }
        
        List<Reservation> reservationsList;
        if (startDate != null && endDate != null) {
            reservationsList = (status != null) ?
                        reservationRepository.findByUserIdAndStatusAndStartTimeBetween(userIdAuth, status, startDate, endDate, sort) :
                        reservationRepository.findByUserIdAndStartTimeBetween(userIdAuth, startDate, endDate, sort);
        } else if (futureOnly) {
            LocalDateTime now = LocalDateTime.now();
            reservationsList = (status != null) ?
                        reservationRepository.findByUserIdAndStatusAndStartTimeAfter(userIdAuth, status, now, sort) :
                        reservationRepository.findByUserIdAndStartTimeAfter(userIdAuth, now, sort);
        } else {
            reservationsList = (status != null) ?
                        reservationRepository.findByUserIdAndStatus(userIdAuth, status, sort) :
                        reservationRepository.findByUserId(userIdAuth, sort);
        }
        return convertToDTOList(reservationsList);
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
            userToReserveFor = userService.getUserById(reservationInput.getUser().getId());
        } else {
            userToReserveFor = userMakingReservation;
        }
        reservationInput.setUser(userToReserveFor);

        if (reservationInput.getStartTime() == null || reservationInput.getEndTime() == null) {
            throw new InvalidReservationException("Las fechas de inicio y fin son requeridas.");
        }
        if (reservationInput.getStartTime().isAfter(reservationInput.getEndTime()) || reservationInput.getStartTime().isEqual(reservationInput.getEndTime())) {
            throw new InvalidReservationException("La fecha de inicio debe ser anterior a la fecha de fin.");
        }

        boolean isAvailable = classroomRepository.isAvailableConsideringAllStatuses(
                reservationInput.getClassroom().getId(),
                reservationInput.getStartTime(),
                reservationInput.getEndTime()
        );

        if (!isAvailable) {
            throw new InvalidReservationException("El aula no está disponible en el horario solicitado: " +
                    classroom.getName() +
                    " de " + reservationInput.getStartTime() + " a " + reservationInput.getEndTime() +
                    ". (Puede haber una reserva PENDIENTE o CONFIRMADA en esta franja).");
        }

        ReservationStatus finalStatus = ReservationStatus.PENDIENTE;

        if (userMakingReservation.getRole() == Rol.ADMIN) {
            finalStatus = ReservationStatus.CONFIRMADA;
        } else if (userMakingReservation.getRole() == Rol.COORDINADOR) {
            if (userToReserveFor.getRole() == Rol.ESTUDIANTE) {
                finalStatus = ReservationStatus.CONFIRMADA;
            } else {
                finalStatus = ReservationStatus.PENDIENTE;
            }
        }
        
        if (userMakingReservation.getRole() == Rol.ADMIN && reservationInput.getStatus() != null) {
            reservationInput.setStatus(reservationInput.getStatus());
        } else {
            reservationInput.setStatus(finalStatus);
        }

        return reservationRepository.save(reservationInput);
    }

    @Transactional
    public Reservation updateReservationStatus(String id, ReservationStatus newStatus, UserDetails adminOrCoordinatorDetails) {
        UserDetailsImpl userDetails = (UserDetailsImpl) adminOrCoordinatorDetails;
        User userPerformingAction = userDetails.getUserEntity();
        Reservation reservation = this.getReservationById(id);

        boolean isAdmin = userPerformingAction.getRole() == Rol.ADMIN;
        boolean isCoordinator = userPerformingAction.getRole() == Rol.COORDINADOR;

        if (!isAdmin && !isCoordinator) {
            throw new UnauthorizedAccessException("Solo Administradores o Coordinadores pueden cambiar el estado de una reserva.");
        }
        if (isCoordinator && (reservation.getUser() == null || reservation.getUser().getRole() != Rol.ESTUDIANTE) && !Objects.equals(reservation.getUser().getId(), userPerformingAction.getId())) {
             throw new UnauthorizedAccessException("Coordinadores solo pueden modificar el estado de reservas de estudiantes o sus propias reservas.");
        }
        
        ReservationStatus currentStatus = reservation.getStatus();
        boolean statusChanged = false;

        if (currentStatus == ReservationStatus.PENDIENTE) {
            if (newStatus == ReservationStatus.CONFIRMADA || newStatus == ReservationStatus.RECHAZADA || newStatus == ReservationStatus.CANCELADA) {
                if (newStatus == ReservationStatus.CONFIRMADA) {
                    if (!classroomRepository.isAvailableExcludingReservationConsideringAllStatuses(
                                reservation.getClassroom().getId(),
                                reservation.getStartTime(),
                                reservation.getEndTime(),
                                reservation.getId()
                    )) {
                        throw new InvalidReservationException("No se puede confirmar la reserva. El aula y horario ahora entran en conflicto con otra reserva (pendiente o confirmada).");
                    }
                }
                reservation.setStatus(newStatus);
                statusChanged = true;
            }
        } else if (currentStatus == ReservationStatus.CONFIRMADA) {
            if (newStatus == ReservationStatus.CANCELADA) {
                reservation.setStatus(newStatus);
                statusChanged = true;
            } else if (isAdmin && newStatus != currentStatus) { 
                reservation.setStatus(newStatus);
                statusChanged = true;
            }
        } else if (isAdmin && newStatus != currentStatus) { 
            if (newStatus == ReservationStatus.CONFIRMADA &&
                (currentStatus == ReservationStatus.RECHAZADA || currentStatus == ReservationStatus.CANCELADA)) {
                if (!classroomRepository.isAvailableExcludingReservationConsideringAllStatuses(
                                reservation.getClassroom().getId(),
                                reservation.getStartTime(),
                                reservation.getEndTime(),
                                reservation.getId() 
                 )) {
                     throw new InvalidReservationException("No se puede reactivar y confirmar la reserva. El aula y horario ahora entran en conflicto.");
                 }
            }
            reservation.setStatus(newStatus);
            statusChanged = true;
        }

        if (!statusChanged) {
            throw new InvalidReservationException("Transición de estado no permitida (" + currentStatus + " -> " + newStatus + ") o acción no permitida para tu rol.");
        }
        return reservationRepository.save(reservation);
    }

    @Transactional
    public Reservation updateReservation(String reservationId, Reservation updatedReservationData, UserDetails currentUserDetails) {
        Reservation existingReservation = this.getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userUpdating = userDetailsImpl.getUserEntity();

        boolean isAdmin = userUpdating.getRole().equals(Rol.ADMIN);
        boolean isCoordinator = userUpdating.getRole().equals(Rol.COORDINADOR);
        boolean isOwner = existingReservation.getUser() != null && Objects.equals(existingReservation.getUser().getId(), userUpdating.getId());

        if (!isAdmin) {
            if (isCoordinator) {
                boolean isStudentReservation = existingReservation.getUser() != null && existingReservation.getUser().getRole() == Rol.ESTUDIANTE;
                if (!((isStudentReservation && (existingReservation.getStatus() == ReservationStatus.PENDIENTE || existingReservation.getStatus() == ReservationStatus.CONFIRMADA)) ||
                      (isOwner && existingReservation.getStatus() == ReservationStatus.PENDIENTE))) {
                    throw new UnauthorizedAccessException("Coordinadores pueden modificar reservas de estudiantes (pendientes o confirmadas), o las propias si están pendientes.");
                }
            } else if (isOwner) {
                if (existingReservation.getStatus() != ReservationStatus.PENDIENTE) {
                    throw new InvalidReservationException("Solo puedes modificar tus propias reservas si están en estado PENDIENTE.");
                }
            } else {
                throw new UnauthorizedAccessException("No tienes permiso para modificar esta reserva.");
            }
        }

        existingReservation.setStartTime(updatedReservationData.getStartTime());
        existingReservation.setEndTime(updatedReservationData.getEndTime());
        existingReservation.setPurpose(updatedReservationData.getPurpose());

        if (updatedReservationData.getClassroom() != null && updatedReservationData.getClassroom().getId() != null &&
            !Objects.equals(existingReservation.getClassroom().getId(), updatedReservationData.getClassroom().getId())) {
            boolean canChangeClassroom = isAdmin || 
                                         ((isCoordinator || isOwner) && existingReservation.getStatus() == ReservationStatus.PENDIENTE);
            if (!canChangeClassroom) {
                 throw new UnauthorizedAccessException("No tienes permiso para cambiar el aula de esta reserva en su estado actual.");
            }
            Classroom newClassroom = classroomRepository.findById(updatedReservationData.getClassroom().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Aula no encontrada con ID: " + updatedReservationData.getClassroom().getId()));
            existingReservation.setClassroom(newClassroom);
        }

        if (updatedReservationData.getUser() != null && updatedReservationData.getUser().getId() != null &&
            !Objects.equals(existingReservation.getUser().getId(), updatedReservationData.getUser().getId())) {
            if (!isAdmin && !isCoordinator) { 
                 throw new UnauthorizedAccessException("No tienes permiso para reasignar el usuario de esta reserva.");
            }
            User newUser = userService.getUserById(updatedReservationData.getUser().getId());
             if (isCoordinator && newUser.getRole() != Rol.ESTUDIANTE && !Objects.equals(newUser.getId(), userUpdating.getId())) {
                 throw new UnauthorizedAccessException("Coordinadores solo pueden reasignar reservas a estudiantes (o a sí mismos si la reserva era originalmente suya y está pendiente).");
            }
            existingReservation.setUser(newUser);
        }
        
        if (isAdmin && updatedReservationData.getStatus() != null && existingReservation.getStatus() != updatedReservationData.getStatus()) {
            if (updatedReservationData.getStatus() == ReservationStatus.CONFIRMADA) {
                 if (!classroomRepository.isAvailableExcludingReservationConsideringAllStatuses(
                                existingReservation.getClassroom().getId(),
                                existingReservation.getStartTime(),
                                existingReservation.getEndTime(), // Aquí había un error, debería ser endTime en lugar de classroomId
                                existingReservation.getId() 
                 )) {
                     throw new InvalidReservationException("No se puede confirmar la reserva al actualizar. El aula y horario entran en conflicto.");
                 }
            }
            existingReservation.setStatus(updatedReservationData.getStatus());
        }

        boolean isAvailable = classroomRepository.isAvailableExcludingReservationConsideringAllStatuses(
                existingReservation.getClassroom().getId(),
                existingReservation.getStartTime(),
                existingReservation.getEndTime(), // Corregido: Era existingReservation.getClassroom().getId() dos veces
                existingReservation.getId()
        );
        if (!isAvailable) {
            throw new InvalidReservationException("El aula no está disponible en el nuevo horario o aula solicitada debido a un conflicto con otra reserva (pendiente o confirmada).");
        }
        return reservationRepository.save(existingReservation);
    }

    @Transactional
    public Reservation cancelMyReservation(String reservationId, UserDetails currentUserDetails) {

        Reservation reservation = this.getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userCancelling = userDetailsImpl.getUserEntity();

        boolean isAdmin = userCancelling.getRole() == Rol.ADMIN;
        boolean isCoordinator = userCancelling.getRole() == Rol.COORDINADOR;
        boolean isOwner = reservation.getUser() != null && Objects.equals(reservation.getUser().getId(), userCancelling.getId());

        if (!isAdmin) {
            if (isCoordinator) {
                boolean isStudentReservation = reservation.getUser() != null && reservation.getUser().getRole() == Rol.ESTUDIANTE;
                if (!isStudentReservation && !isOwner) {
                    throw new UnauthorizedAccessException("Coordinadores solo pueden cancelar reservas de estudiantes o las propias.");
                }
            } else if (!isOwner) {
                 throw new UnauthorizedAccessException("No tienes permiso para cancelar esta reserva.");
            }
        }

        if (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) {
            reservation.setStatus(ReservationStatus.CANCELADA);
            return reservationRepository.save(reservation);
        } else {
            throw new InvalidReservationException("Solo se pueden cancelar reservas PENDIENTES o CONFIRMADAS. Estado actual: " + reservation.getStatus());
        }
    }

    @Transactional
    public void deleteReservation(String reservationId, UserDetails currentUserDetails) {
      
        Reservation reservation = this.getReservationById(reservationId);
        UserDetailsImpl userDetailsImpl = (UserDetailsImpl) currentUserDetails;
        User userDeleting = userDetailsImpl.getUserEntity();

        boolean isAdmin = userDeleting.getRole() == Rol.ADMIN;
        boolean isCoordinatorWithPermission = userDeleting.getRole() == Rol.COORDINADOR &&
                reservation.getUser() != null &&
                (reservation.getUser().getRole() == Rol.ESTUDIANTE || Objects.equals(reservation.getUser().getId(), userDeleting.getId())) &&
                (reservation.getStatus() == ReservationStatus.PENDIENTE ||
                 reservation.getStatus() == ReservationStatus.CANCELADA ||
                 reservation.getStatus() == ReservationStatus.RECHAZADA);
                 
        boolean isOwnerAndAllowedStatus = reservation.getUser() != null &&
                Objects.equals(reservation.getUser().getId(), userDeleting.getId()) &&
                (reservation.getStatus() == ReservationStatus.PENDIENTE ||
                 reservation.getStatus() == ReservationStatus.CANCELADA ||
                 reservation.getStatus() == ReservationStatus.RECHAZADA);

        if (isAdmin || isOwnerAndAllowedStatus || isCoordinatorWithPermission) {
            reservationRepository.deleteById(reservationId);
        } else {
            throw new UnauthorizedAccessException("No tienes permiso para eliminar esta reserva o el estado actual no lo permite.");
        }
    }

    
    public List<ReservationResponseDTO> getReservationsByStatusDTO(ReservationStatus status) {
        return convertToDTOList(reservationRepository.findByStatus(status, Sort.by(Sort.Direction.DESC, "startTime")));
    }

    public List<ReservationResponseDTO> getUpcomingReservationsDTO(int limit) {
        Sort sort = Sort.by(Sort.Direction.ASC, "startTime");
        List<Reservation> reservations = reservationRepository.findByStatusAndStartTimeAfter(ReservationStatus.CONFIRMADA, LocalDateTime.now(), sort)
            .stream().limit(limit).collect(Collectors.toList());
        return convertToDTOList(reservations);
    }

    public List<ReservationResponseDTO> getMyUpcomingReservationsDTO(String userId, int limit) {
        Sort sort = Sort.by(Sort.Direction.ASC, "startTime");
        List<Reservation> reservations = reservationRepository.findUpcomingConfirmedByUserId(userId, LocalDateTime.now(), sort)
                .stream().limit(limit).collect(Collectors.toList());
        return convertToDTOList(reservations);
    }

    public List<ReservationResponseDTO> getCurrentReservationsDTO() {
        LocalDateTime now = LocalDateTime.now();
        List<Reservation> reservations = reservationRepository.findCurrentReservations(now);
        return convertToDTOList(reservations);
    }

    public List<ReservationResponseDTO> getReservationsByUserIdDTO(String userId) {
        List<Reservation> reservations = reservationRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "startTime"));
        return convertToDTOList(reservations);
    }
}