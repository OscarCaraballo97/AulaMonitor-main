package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, String> {

    List<Classroom> findByType(ClassroomType type);
    List<Classroom> findByCapacityGreaterThanEqual(Integer minCapacity);
    List<Classroom> findByBuilding_Id(String buildingId);

    @Query("SELECT c FROM Classroom c WHERE c.id NOT IN " +
           "(SELECT r.classroom.id FROM Reservation r WHERE " +
           "(r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA OR r.status = com.backend.IMonitoring.model.ReservationStatus.PENDIENTE) AND " +
           "(r.startTime < :now AND r.endTime > :now))")
    List<Classroom> findAvailableNow(@Param("now") LocalDateTime now);

    @Query("SELECT c FROM Classroom c WHERE c.id IN " +
           "(SELECT r.classroom.id FROM Reservation r WHERE " +
           "(r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA OR r.status = com.backend.IMonitoring.model.ReservationStatus.PENDIENTE) AND " +
           "(r.startTime < :now AND r.endTime > :now))")
    List<Classroom> findUnavailableNow(@Param("now") LocalDateTime now);

    @Query("SELECT CASE WHEN COUNT(r) = 0 THEN true ELSE false END " +
           "FROM Reservation r WHERE " +
           "r.classroom.id = :classroomId AND " +
           "(r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA OR r.status = com.backend.IMonitoring.model.ReservationStatus.PENDIENTE) AND " +
           "(r.startTime < :endTime AND r.endTime > :startTime)")
    boolean isAvailableConsideringAllStatuses(
            @Param("classroomId") String classroomId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    @Query("SELECT CASE WHEN COUNT(r) = 0 THEN true ELSE false END " +
           "FROM Reservation r WHERE " +
           "r.classroom.id = :classroomId AND " +
           "r.id <> :excludeReservationId AND " +
           "(r.status = com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA OR r.status = com.backend.IMonitoring.model.ReservationStatus.PENDIENTE) AND " +
           "(r.startTime < :endTime AND r.endTime > :startTime)")
    boolean isAvailableExcludingReservationConsideringAllStatuses(
            @Param("classroomId") String classroomId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludeReservationId") String excludeReservationId
    );
}