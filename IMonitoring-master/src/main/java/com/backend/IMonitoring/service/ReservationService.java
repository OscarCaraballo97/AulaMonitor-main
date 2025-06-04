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
        if (reservationDTO.getUserId() != null && (currentUser.getRole() == Rol.ADMIN || currentUser.getRole() == Rol.COORDINADOR)) {
            userToAssign = userRepository.findById(reservationDTO.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuario especificado para la reserva no encontrado con ID: " + reservationDTO.getUserId()));
        } else {
            userToAssign = currentUser;
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

        reservation.setStatus(ReservationStatus.PENDIENTE);
        if (currentUser.getRole() == Rol.ADMIN || currentUser.getRole() == Rol.COORDINADOR) {
            reservation.setStatus(ReservationStatus.CONFIRMADA);
        }
        logger.info("Reservation status set to: {} for user {}", reservation.getStatus(), userToAssign.getEmail());

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

    public List<ReservationResponseDTO> getAllReservations(
            String classroomId, String userId, ReservationStatus status,
            Instant startDate, Instant endDate, 
            String sortField, String sortDirection) {
                
        logger.debug("Fetching all reservations with filters - classroomId: {}, userId: {}, status: {}, startDate: {}, endDate: {}, sortField: {}, sortDirection: {}",
            classroomId, userId, status, startDate, endDate, sortField, sortDirection);

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
        
        if (startDate != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("endTime"), startDate));
        }
        if (endDate != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("startTime"), endDate));
        }
        
        Sort.Direction direction = (sortDirection == null || sortDirection.equalsIgnoreCase("desc")) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String field = (sortField == null || sortField.isEmpty()) ? "startTime" : sortField;
        
        if ("classroomName".equals(field)) field = "classroom.name"; 
        else if ("userName".equals(field)) field = "user.name";     

        List<Reservation> reservations = reservationRepository.findAll(spec, Sort.by(direction, field));
        logger.debug("Found {} reservations after applying spec and sort.", reservations.size());
        return reservations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public Page<ReservationResponseDTO> getFilteredUserReservations(
        String userId, ReservationStatus status,
        String sortField, String sortDirection,
        int page, int size, boolean upcomingOnly,
        Instant startDate, Instant endDate, User currentUser) {

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
            if (reservation.getUser().getId().equals(currentUser.getId()) || reservation.getUser().getRole() == Rol.ESTUDIANTE) {
                canView = true;
            }
        } else { 
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
            if (reservation.getUser().getRole() == Rol.ESTUDIANTE && reservation.getStatus() == ReservationStatus.PENDIENTE &&
                (newStatus == ReservationStatus.CONFIRMADA || newStatus == ReservationStatus.RECHAZADA)) {
                canChangeStatus = true;
            }
            if (reservation.getUser().getId().equals(currentUser.getId()) &&
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
            if (reservation.getUser().getId().equals(currentUser.getId()) && reservation.getStatus() == ReservationStatus.PENDIENTE) { 
                canUpdate = true;
            } else if (reservation.getUser().getRole() == Rol.ESTUDIANTE &&
                       (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CONFIRMADA)) { 
                canUpdate = true;
            }
        } else { 
            if (reservation.getUser().getId().equals(currentUser.getId()) && reservation.getStatus() == ReservationStatus.PENDIENTE) { 
                canUpdate = true;
            }
        }

        if (!canUpdate) {
            throw new UnauthorizedAccessException("No tiene permiso para actualizar esta reserva o ya no está en un estado editable.");
        }

        if (reservationDTO.getClassroomId() != null && !reservationDTO.getClassroomId().equals(reservation.getClassroom().getId())) {
            Classroom newClassroom = classroomRepository.findById(reservationDTO.getClassroomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Nueva aula no encontrada con ID: " + reservationDTO.getClassroomId()));
            reservation.setClassroom(newClassroom);
        }

        if (reservationDTO.getPurpose() != null) reservation.setPurpose(reservationDTO.getPurpose());
        if (reservationDTO.getStartTime() != null) reservation.setStartTime(reservationDTO.getStartTime()); 
        if (reservationDTO.getEndTime() != null) reservation.setEndTime(reservationDTO.getEndTime());     

        if (reservationDTO.getUserId() != null && currentUser.getRole() == Rol.ADMIN ) {
             User userToAssign = userRepository.findById(reservationDTO.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuario especificado para la reserva no encontrado con ID: " + reservationDTO.getUserId()));
            reservation.setUser(userToAssign);
        }

        if (reservationDTO.getStatus() != null) { 
            if (currentUser.getRole() == Rol.ADMIN) { 
                reservation.setStatus(reservationDTO.getStatus());
            } else if (currentUser.getRole() == Rol.COORDINADOR &&
                       reservation.getUser().getRole() == Rol.ESTUDIANTE &&
                       (reservationDTO.getStatus() == ReservationStatus.CONFIRMADA || reservationDTO.getStatus() == ReservationStatus.RECHAZADA)) {
                if (reservation.getStatus() == ReservationStatus.PENDIENTE) {
                    reservation.setStatus(reservationDTO.getStatus());
                } else {
                     throw new InvalidReservationException("El coordinador solo puede confirmar o rechazar reservas de estudiantes que están PENDIENTES.");
                }
            } else if (reservation.getUser().getId().equals(currentUser.getId()) &&
                       reservation.getStatus() == ReservationStatus.PENDIENTE &&
                       reservationDTO.getStatus() == ReservationStatus.CANCELADA) {
                 reservation.setStatus(ReservationStatus.CANCELADA);
            }
        }

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
        } else if (reservation.getUser().getId().equals(currentUser.getId()) &&
                   (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CANCELADA) ) {
            canDelete = true;
        } else if (currentUser.getRole() == Rol.COORDINADOR &&
                   reservation.getUser().getRole() == Rol.ESTUDIANTE &&
                   (reservation.getStatus() == ReservationStatus.PENDIENTE || reservation.getStatus() == ReservationStatus.CANCELADA || reservation.getStatus() == ReservationStatus.RECHAZADA) ){
            canDelete = true;
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