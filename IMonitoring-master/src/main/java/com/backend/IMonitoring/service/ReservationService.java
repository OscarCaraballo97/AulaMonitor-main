package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.ReservationRequestDTO;
import com.backend.IMonitoring.dto.ReservationResponseDTO;
import com.backend.IMonitoring.exceptions.InvalidReservationException;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import com.backend.IMonitoring.model.*;
import com.backend.IMonitoring.repository.ClassroomRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReservationService {

    private static final Logger logger = LoggerFactory.getLogger(ReservationService.class);

    @Autowired
    private ReservationRepository reservationRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ClassroomRepository classroomRepository;

    @Transactional
    public ReservationResponseDTO createReservation(ReservationRequestDTO reservationDTO, User currentUser) {
        logger.info("Attempting to create reservation with DTO: {} by user: {}", reservationDTO, currentUser.getEmail());

        User userToAssign;
        // Logic for assigning user to reservation (Admin/Coordinator can assign, others reserve for self)
        if (reservationDTO.getUserId() != null && (currentUser.getRole() == Rol.ADMIN || currentUser.getRole() == Rol.COORDINADOR)) {
            userToAssign = userRepository.findById(reservationDTO.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuario especificado para la reserva no encontrado con ID: " + reservationDTO.getUserId()));
        } else {
            userToAssign = currentUser; // If userId is null or user is not Admin/Coordinator, assign to current user
        }
        logger.info("Reservation will be assigned to user: {}", userToAssign.getEmail());

        Classroom classroom = classroomRepository.findById(reservationDTO.getClassroomId())
                .orElseThrow(() -> new ResourceNotFoundException("Aula no encontrada con ID: " + reservationDTO.getClassroomId()));
        logger.info("Reservation for classroom: {}", classroom.getName());

        Reservation reservation = new Reservation();
        reservation.setPurpose(reservationDTO.getPurpose());
        reservation.setStartTime(reservationDTO.getStartTime());
        reservation.setEndTime(reservationDTO.getEndTime());
        reservation.setClassroom(classroom);
        reservation.setUser(userToAssign);
        reservation.setCreatedAt(LocalDateTime.now());

        // Set initial status
        reservation.setStatus(ReservationStatus.PENDIENTE);
        // If Admin or Coordinator is creating, and a status is provided in DTO, use it. Otherwise, default to CONFIRMADA.
        if (currentUser.getRole() == Rol.ADMIN || currentUser.getRole() == Rol.COORDINADOR) {
            reservation.setStatus(reservationDTO.getStatus() != null ? reservationDTO.getStatus() : ReservationStatus.CONFIRMADA);
        }
        logger.info("Reservation status set to: {} for user {}", reservation.getStatus(), userToAssign.getEmail());

        // Check for overlapping reservations with PENDING or CONFIRMADA status
        List<Reservation> overlappingReservations = reservationRepository.findOverlappingReservations(
                reservation.getClassroom().getId(),
                reservation.getStartTime(),
                reservation.getEndTime()
        );
        overlappingReservations = overlappingReservations.stream()
                .filter(r -> (r.getStatus() == ReservationStatus.PENDIENTE || r.getStatus() == ReservationStatus.CONFIRMADA))
                .collect(Collectors.toList());

        if (!overlappingReservations.isEmpty()) {
            logger.warn("Overlapping reservation found for classroom {} from {} to {}",
                    classroom.getName(), reservation.getStartTime(), reservation.getEndTime());
            throw new InvalidReservationException(
                    String.format("El aula no está disponible en el horario solicitado: %s de %s a %s. (Puede haber una reserva PENDIENTE o CONFIRMADA en esta franja).",
                            classroom.getName(), reservation.getStartTime().toString(), reservation.getEndTime().toString())
            );
        }
        logger.info("No overlapping reservations found. Proceeding to save.");

        Reservation savedReservation = reservationRepository.save(reservation);
        logger.info("Reservation saved successfully with ID: {} and status: {}", savedReservation.getId(), savedReservation.getStatus());
        return convertToDTO(savedReservation);
    }

    // Modified getAllReservations to return a Page for consistency and pagination support
    public Page<ReservationResponseDTO> getAllReservations(
            String classroomId, String userId, ReservationStatus status,
            Instant startDate, Instant endDate,
            String sortField, String sortDirection,
            int page, int size) { // Added page and size parameters
        logger.debug("Fetching all reservations with filters - classroomId: {}, userId: {}, status: {}, startDate: {}, endDate: {}, sortField: {}, sortDirection: {}, page: {}, size: {}",
            classroomId, userId, status, startDate, endDate, sortField, sortDirection, page, size);

        Specification<Reservation> spec = Specification.where(null);

        if (classroomId != null && !classroomId.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("classroom").get("id"), classroomId));
        }
        if (userId != null && !userId.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("user").get("id"), userId));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        // Adjusting date filters to be more inclusive and correct based on common use cases
        if (startDate != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("endTime"), startDate));
        }
        if (endDate != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("startTime"), endDate));
        }

        Sort.Direction direction = (sortDirection == null || sortDirection.equalsIgnoreCase("desc")) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String field = (sortField == null || sortField.isEmpty()) ? "startTime" : sortField;

        // Ensure sorting by nested properties works correctly
        if ("classroomName".equals(field)) field = "classroom.name";
        else if ("userName".equals(field)) field = "user.name";

        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, field));
        Page<Reservation> reservationPage = reservationRepository.findAll(spec, pageable);

        logger.debug("Found {} reservations (total elements: {}) after applying spec, sort, and pagination.", reservationPage.getNumberOfElements(), reservationPage.getTotalElements());
        return new PageImpl<>(
                reservationPage.getContent().stream().map(this::convertToDTO).collect(Collectors.toList()),
                pageable,
                reservationPage.getTotalElements()
        );
    }

    public Page<ReservationResponseDTO> getFilteredUserReservations(
        String userId, ReservationStatus status,
        String sortField, String sortDirection,
        int page, int size, boolean upcomingOnly,
        Instant startDate, Instant endDate, User currentUser) {

        // Authorization check: User can only see their own reservations, or Admin/Coordinator can see others'
        if (!currentUser.getId().equals(userId) && !(currentUser.getRole() == Rol.ADMIN || currentUser.getRole() == Rol.COORDINADOR)) {
            throw new UnauthorizedAccessException("No tiene permiso para ver las reservas de este usuario.");
        }

        Specification<Reservation> spec = Specification.where((root, query, cb) -> cb.equal(root.get("user").get("id"), userId));

        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (upcomingOnly) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("startTime"), Instant.now()));
        } else {
            if (startDate != null) {
                spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("endTime"), startDate));
            }
            if (endDate != null) {
                spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("startTime"), endDate));
            }
        }

        Sort.Direction directionSort = (sortDirection == null || sortDirection.equalsIgnoreCase("desc")) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String fieldSort = (sortField == null || sortField.isEmpty()) ? "startTime" : sortField;
        if ("classroomName".equals(fieldSort)) fieldSort = "classroom.name";
        else if ("userName".equals(fieldSort)) fieldSort = "user.name";

        Pageable pageable = PageRequest.of(page, size, Sort.by(directionSort, fieldSort));
        Page<Reservation> reservationPage = reservationRepository.findAll(spec, pageable);

        List<ReservationResponseDTO> dtos = reservationPage.getContent().stream()
                                            .map(this::convertToDTO)
                                            .collect(Collectors.toList());
        return new PageImpl<>(dtos, pageable, reservationPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ReservationResponseDTO getReservationById(String id, User currentUser) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + id));

        boolean canView = false;
        if (currentUser.getRole() == Rol.ADMIN) {
            canView = true;
        } else if (currentUser.getRole() == Rol.COORDINADOR) {
            // Coordinator can view their own reservations or any student's reservation
            if (reservation.getUser().getId().equals(currentUser.getId()) || reservation.getUser().getRole() == Rol.ESTUDIANTE) {
                canView = true;
            }
        } else { // PROFESOR, ESTUDIANTE, TUTOR
            // Regular user can only view their own reservations
            if (reservation.getUser().getId().equals(currentUser.getId())) {
                canView = true;
            }
        }
        if (!canView) {
            throw new UnauthorizedAccessException("No tiene permiso para ver esta reserva.");
        }
        return convertToDTO(reservation);
    }

    @Transactional
    public ReservationResponseDTO updateReservationStatus(String reservationId, ReservationStatus newStatus, User currentUser) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + reservationId));

        boolean canChangeStatus = false;
        if (currentUser.getRole() == Rol.ADMIN) {
            canChangeStatus = true;
        } else if (currentUser.getRole() == Rol.COORDINADOR) {
            // Coordinator can confirm/reject PENDING student reservations
            if (reservation.getUser().getRole() == Rol.ESTUDIANTE && reservation.getStatus() == ReservationStatus.PENDIENTE &&
                (newStatus == ReservationStatus.CONFIRMADA || newStatus == ReservationStatus.RECHAZADA)) {
                canChangeStatus = true;
            }
            // Coordinator can cancel their own PENDING or CONFIRMADA reservations
            if (reservation.getUser().getId().equals(currentUser.getId()) &&
                (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) &&
                 newStatus == ReservationStatus.CANCELADA) {
                 canChangeStatus = true;
            }
            // Coordinator can cancel student's PENDING or CONFIRMADA reservations
            if (reservation.getUser().getRole() == Rol.ESTUDIANTE &&
                (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) &&
                newStatus == ReservationStatus.CANCELADA) {
                canChangeStatus = true;
            }
        } else if (reservation.getUser().getId().equals(currentUser.getId()) &&
            (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA) &&
            newStatus == ReservationStatus.CANCELADA) {
            canChangeStatus = true;
        }

        if (!canChangeStatus) {
            throw new UnauthorizedAccessException("No tiene permiso para cambiar el estado de esta reserva de " + reservation.getStatus() + " a: " + newStatus);
        }

        reservation.setStatus(newStatus);
        Reservation updatedReservation = reservationRepository.save(reservation);
        return convertToDTO(updatedReservation);
    }

    @Transactional
    public ReservationResponseDTO cancelMyReservation(String reservationId, User currentUser) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + reservationId));

        // This method is specifically for "my" reservations, so it should only apply if the current user owns it
        if (!reservation.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException("No puede cancelar una reserva que no le pertenece.");
        }
        if (reservation.getStatus() != ReservationStatus.PENDIENTE && reservation.getStatus() != ReservationStatus.CONFIRMADA) {
            throw new InvalidReservationException("Solo se pueden cancelar reservas con estado PENDIENTE o CONFIRMADA. Estado actual: " + reservation.getStatus());
        }

        reservation.setStatus(ReservationStatus.CANCELADA);
        Reservation cancelledReservation = reservationRepository.save(reservation);
        return convertToDTO(cancelledReservation);
    }

    @Transactional
    public ReservationResponseDTO updateReservation(String id, ReservationRequestDTO reservationDTO, User currentUser) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + id));

        boolean canUpdate = false;
        if (currentUser.getRole() == Rol.ADMIN) {
            canUpdate = true;
        } else if (currentUser.getRole() == Rol.COORDINADOR) {
            // Coordinator can update their own PENDING reservations
            if (reservation.getUser().getId().equals(currentUser.getId()) && reservation.getStatus() == ReservationStatus.PENDIENTE) {
                canUpdate = true;
            }
            // Coordinator can update ESTUDIANTE reservations (PENDIENTE or CONFIRMADA)
            if (reservation.getUser().getRole() == Rol.ESTUDIANTE &&
                       (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA)) {
                canUpdate = true;
            }
        } else { // PROFESOR, ESTUDIANTE, TUTOR
            // Regular user can only update their own PENDING reservations
            if (reservation.getUser().getId().equals(currentUser.getId()) && reservation.getStatus() == ReservationStatus.PENDIENTE) {
                canUpdate = true;
            }
        }

        if (!canUpdate) {
            throw new UnauthorizedAccessException("No tiene permiso para actualizar esta reserva o ya no está en un estado editable.");
        }

        // Update Classroom if changed
        if (reservationDTO.getClassroomId() != null && !reservationDTO.getClassroomId().equals(reservation.getClassroom().getId())) {
            Classroom newClassroom = classroomRepository.findById(reservationDTO.getClassroomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Nueva aula no encontrada con ID: " + reservationDTO.getClassroomId()));
            reservation.setClassroom(newClassroom);
        }

        // Update basic fields
        if (reservationDTO.getPurpose() != null) reservation.setPurpose(reservationDTO.getPurpose());
        if (reservationDTO.getStartTime() != null) reservation.setStartTime(reservationDTO.getStartTime());
        if (reservationDTO.getEndTime() != null) reservation.setEndTime(reservationDTO.getEndTime());

        // Only Admin can change the associated user
        if (reservationDTO.getUserId() != null && currentUser.getRole() == Rol.ADMIN ) {
             User userToAssign = userRepository.findById(reservationDTO.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuario especificado para la reserva no encontrado con ID: " + reservationDTO.getUserId()));
            reservation.setUser(userToAssign);
        }

        // Status update logic for update method
        if (reservationDTO.getStatus() != null) {
            if (currentUser.getRole() == Rol.ADMIN) {
                reservation.setStatus(reservationDTO.getStatus());
            } else if (currentUser.getRole() == Rol.COORDINADOR && reservation.getUser().getRole() == Rol.ESTUDIANTE) {
                // Coordinator can change status of student's pending reservations to CONFIRMADA or RECHAZADA
                if (reservation.getStatus() == ReservationStatus.PENDIENTE &&
                    (reservationDTO.getStatus() == ReservationStatus.CONFIRMADA || reservationDTO.getStatus() == ReservationStatus.RECHAZADA)) {
                    reservation.setStatus(reservationDTO.getStatus());
                } else if (reservation.getStatus() == ReservationStatus.CONFIRMADA &&
                           reservationDTO.getStatus() == ReservationStatus.CANCELADA) {
                    reservation.setStatus(ReservationStatus.CANCELADA);
                } else {
                     throw new InvalidReservationException("El coordinador solo puede confirmar/rechazar reservas de estudiantes que están PENDIENTES, o cancelarlas si están CONFIRMADAS.");
                }
            } else if (reservation.getUser().getId().equals(currentUser.getId()) &&
                       reservation.getStatus() == ReservationStatus.PENDIENTE &&
                       reservationDTO.getStatus() == ReservationStatus.CANCELADA) {
                 reservation.setStatus(ReservationStatus.CANCELADA);
            } else {
                // Other users cannot change status via this endpoint if not handled above
                // Or if they try to set an invalid status for their current permission
                throw new UnauthorizedAccessException("No tienes permiso para cambiar el estado de esta reserva a: " + reservationDTO.getStatus());
            }
        }

        // Re-check for overlaps with the updated times/classroom
        List<Reservation> overlappingReservations = reservationRepository.findOverlappingReservationsExcludingSelf(
                reservation.getClassroom().getId(),
                reservation.getStartTime(),
                reservation.getEndTime(),
                reservation.getId()
        );
        overlappingReservations = overlappingReservations.stream()
                .filter(r -> (r.getStatus() == ReservationStatus.PENDIENTE || r.getStatus() == ReservationStatus.CONFIRMADA))
                .collect(Collectors.toList());

        if (!overlappingReservations.isEmpty()) {
            throw new InvalidReservationException(
                 String.format("El aula no está disponible en el nuevo horario solicitado: %s de %s a %s. (Puede haber una reserva PENDIENTE o CONFIRMADA en esta franja).",
                            reservation.getClassroom().getName(), reservation.getStartTime().toString(), reservation.getEndTime().toString())
            );
        }

        Reservation updatedReservation = reservationRepository.save(reservation);
        return convertToDTO(updatedReservation);
    }

    @Transactional
    public void deleteReservation(String id, User currentUser) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada con ID: " + id));

        boolean canDelete = false;
        if (currentUser.getRole() == Rol.ADMIN) {
            canDelete = true;
        } else if (currentUser.getRole() == Rol.COORDINADOR) {
            // Coordinator can delete student's reservations regardless of status (PENDIENTE, CONFIRMADA, RECHAZADA, CANCELADA)
            if (reservation.getUser().getRole() == Rol.ESTUDIANTE) {
                canDelete = true;
            }
            // Coordinator can delete their own reservations if PENDIENTE or CANCELADA
            if (reservation.getUser().getId().equals(currentUser.getId()) &&
                (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CANCELADA || reservation.getStatus() == ReservationStatus.RECHAZADA)) {
                canDelete = true;
            }
        } else { // PROFESOR, ESTUDIANTE, TUTOR
            // Regular user can delete their own reservations if PENDIENTE or CANCELADA
            if (reservation.getUser().getId().equals(currentUser.getId()) &&
               (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CANCELADA || reservation.getStatus() == ReservationStatus.RECHAZADA)) {
                canDelete = true;
            }
        }

        if (!canDelete) {
            throw new UnauthorizedAccessException("No tiene permiso para eliminar esta reserva.");
        }
        reservationRepository.delete(reservation);
    }

    public ReservationResponseDTO convertToDTO(Reservation reservation) {
        ReservationResponseDTO dto = new ReservationResponseDTO();
        dto.setId(reservation.getId());
        dto.setPurpose(reservation.getPurpose());
        dto.setStartTime(reservation.getStartTime());
        dto.setEndTime(reservation.getEndTime());
        dto.setStatus(reservation.getStatus());
        dto.setCreatedAt(reservation.getCreatedAt());
        if (reservation.getUser() != null) {
            ReservationResponseDTO.UserSummaryDTO userSummary = new ReservationResponseDTO.UserSummaryDTO();
            userSummary.setId(reservation.getUser().getId());
            userSummary.setName(reservation.getUser().getName());
            userSummary.setEmail(reservation.getUser().getEmail());
            userSummary.setRole(reservation.getUser().getRole());
            dto.setUser(userSummary);
        }
        if (reservation.getClassroom() != null) {
            ReservationResponseDTO.ClassroomSummaryDTO classroomSummary = new ReservationResponseDTO.ClassroomSummaryDTO();
            classroomSummary.setId(reservation.getClassroom().getId());
            classroomSummary.setName(reservation.getClassroom().getName());
            classroomSummary.setType(reservation.getClassroom().getType());
            if(reservation.getClassroom().getBuilding() != null) {
                classroomSummary.setBuildingName(reservation.getClassroom().getBuilding().getName());
            }
            dto.setClassroom(classroomSummary);
        }
        return dto;
    }
}