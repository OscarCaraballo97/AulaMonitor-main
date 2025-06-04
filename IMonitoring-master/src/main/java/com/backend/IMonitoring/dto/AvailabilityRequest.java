package com.backend.IMonitoring.dto;

import java.time.Instant;
import jakarta.validation.constraints.NotNull;

public class AvailabilityRequest {
    @NotNull
    private String classroomId;
    @NotNull
    private Instant startTime; 
    @NotNull
    private Instant endTime;   


    public String getClassroomId() { return classroomId; }
    public void setClassroomId(String classroomId) { this.classroomId = classroomId; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
}