package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.Classroom;
import com.backend.IMonitoring.model.ClassroomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, String>, JpaSpecificationExecutor<Classroom> {

    List<Classroom> findByType(ClassroomType type, Sort sort);
    List<Classroom> findByCapacityGreaterThanEqual(Integer minCapacity, Sort sort);

    @Query("SELECT c FROM Classroom c WHERE NOT EXISTS (" +
           "SELECT r FROM Reservation r WHERE r.classroom = c AND " +
           "r.status IN (com.backend.IMonitoring.model.ReservationStatus.PENDIENTE, com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA) AND " +
           ":currentTime >= r.startTime AND :currentTime < r.endTime)")
    List<Classroom> findAvailableNow(@Param("currentTime") Instant currentTime);

    @Query("SELECT c FROM Classroom c WHERE EXISTS (" +
           "SELECT r FROM Reservation r WHERE r.classroom = c AND " +
           "r.status IN (com.backend.IMonitoring.model.ReservationStatus.PENDIENTE, com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA) AND " +
           ":currentTime >= r.startTime AND :currentTime < r.endTime)")
    List<Classroom> findUnavailableNow(@Param("currentTime") Instant currentTime);

    @Query("SELECT CASE WHEN COUNT(r) = 0 THEN TRUE ELSE FALSE END " +
           "FROM Reservation r WHERE r.classroom.id = :classroomId AND " +
           "r.status IN (com.backend.IMonitoring.model.ReservationStatus.PENDIENTE, com.backend.IMonitoring.model.ReservationStatus.CONFIRMADA) AND " +
           "r.startTime < :endTime AND r.endTime > :startTime")
    boolean isAvailableConsideringAllStatuses(@Param("classroomId") String classroomId,
                                              @Param("startTime") Instant startTime,
                                              @Param("endTime") Instant endTime);

    List<Classroom> findByBuilding_Id(String buildingId);
}