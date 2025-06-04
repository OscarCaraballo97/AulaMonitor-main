package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.Reservation;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, String>, JpaSpecificationExecutor<Reservation> {

    List<Reservation> findByUserId(String userId, Sort sort);

    @Query("SELECT r FROM Reservation r WHERE r.classroom.id = :classroomId AND " +
           "r.status IN (com.backend.IMonitoring.model.ReservationStatus.PENDIENTE, com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA) AND " +
           "r.startTime < :endTime AND r.endTime > :startTime")
    List<Reservation> findOverlappingReservations(@Param("classroomId") String classroomId,
                                                  @Param("startTime") Instant startTime,
                                                  @Param("endTime") Instant endTime);

    @Query("SELECT r FROM Reservation r WHERE r.classroom.id = :classroomId AND r.id <> :reservationId AND " +
           "r.status IN (com.backend.IMonitoring.model.ReservationStatus.PENDIENTE, com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA) AND " +
           "r.startTime < :endTime AND r.endTime > :startTime")
    List<Reservation> findOverlappingReservationsExcludingSelf(@Param("classroomId") String classroomId,
                                                               @Param("startTime") Instant startTime, 
                                                               @Param("endTime") Instant endTime,    
                                                               @Param("reservationId") String reservationId);

    List<Reservation> findByClassroomId(String classroomId, Sort sort);

    List<Reservation> findByClassroomIdAndStartTimeBetween(String classroomId, Instant startTime, Instant endTime, Sort sort);
}