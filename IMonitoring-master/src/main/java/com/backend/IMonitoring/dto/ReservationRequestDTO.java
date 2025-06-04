package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.ReservationStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public class ReservationRequestDTO {

    @NotBlank(message = "El ID del aula es obligatorio.")
    private String classroomId;

    private String userId; 

    @NotNull(message = "La hora de inicio es obligatoria.")
    private Instant startTime;

    @NotNull(message = "La hora de fin es obligatoria.")
    private Instant endTime; 

    @NotBlank(message = "El propósito es obligatorio.")
    private String purpose;

    private ReservationStatus status;

    public String getClassroomId() { return classroomId; }
    public void setClassroomId(String classroomId) { this.classroomId = classroomId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }
    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus status) { this.status = status; }
}