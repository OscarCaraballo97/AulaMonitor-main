package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.model.ReservationStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, String> {

    List<Reservation> findByStatus(ReservationStatus status, Sort sort);
    List<Reservation> findByUserId(String userId, Sort sort);
    List<Reservation> findByClassroomId(String classroomId, Sort sort);

    List<Reservation> findByClassroomIdAndStartTimeBetween(String classroomId, LocalDateTime startTime, LocalDateTime endTime, Sort sort);
    List<Reservation> findByUserIdAndStartTimeBetween(String userId, LocalDateTime startTime, LocalDateTime endTime, Sort sort);
    List<Reservation> findByStatusAndStartTimeBetween(ReservationStatus status, LocalDateTime startTime, LocalDateTime endTime, Sort sort);
    List<Reservation> findByStartTimeBetween(LocalDateTime startTime, LocalDateTime endTime, Sort sort);

    List<Reservation> findByUserIdAndStatusAndStartTimeBetween(String userId, ReservationStatus status, LocalDateTime startTime, LocalDateTime endTime, Sort sort);
    List<Reservation> findByUserIdAndStatusAndStartTimeAfter(String userId, ReservationStatus status, LocalDateTime startTime, Sort sort);
    List<Reservation> findByUserIdAndStartTimeAfter(String userId, LocalDateTime startTime, Sort sort);
    List<Reservation> findByUserIdAndStatus(String userId, ReservationStatus status, Sort sort);

    List<Reservation> findByStatusAndStartTimeAfter(ReservationStatus status, LocalDateTime startTime, Sort sort); // MÉTODO AÑADIDO

    @Query("SELECT r FROM Reservation r WHERE r.user.id = :userId AND r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA AND r.startTime > :currentTime")
    List<Reservation> findUpcomingConfirmedByUserId(@Param("userId") String userId, @Param("currentTime") LocalDateTime currentTime, Sort sort);

    @Query("SELECT r FROM Reservation r WHERE r.classroom.id IS NOT NULL AND r.startTime <= :now AND r.endTime > :now AND r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA")
    List<Reservation> findCurrentReservations(@Param("now") LocalDateTime now);

    @Query("SELECT r FROM Reservation r WHERE r.classroom.id = :classroomId AND r.startTime >= :startDate AND r.endTime <= :endDate")
    List<Reservation> findByClassroomIdAndDateTimeRange(@Param("classroomId") String classroomId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
}