package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.ReservationStatus;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.ClassroomType;
import java.time.Instant; 
import java.time.LocalDateTime;

public class ReservationResponseDTO {
    private String id;
    private String purpose;
    private Instant startTime; 
    private Instant endTime;   
    private ReservationStatus status;
    private LocalDateTime createdAt;
    private UserSummaryDTO user;
    private ClassroomSummaryDTO classroom;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public UserSummaryDTO getUser() { return user; }
    public void setUser(UserSummaryDTO user) { this.user = user; }
    public ClassroomSummaryDTO getClassroom() { return classroom; }
    public void setClassroom(ClassroomSummaryDTO classroom) { this.classroom = classroom; }

    public static class UserSummaryDTO {
        private String id;
        private String name;
        private String email;
        private Rol role; 
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public Rol getRole() { return role; }
        public void setRole(Rol role) { this.role = role; }
    }

    public static class ClassroomSummaryDTO {
        private String id;
        private String name;
        private ClassroomType type;
        private String buildingName;
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public ClassroomType getType() { return type; }
        public void setType(ClassroomType type) { this.type = type; }
        public String getBuildingName() { return buildingName; }
        public void setBuildingName(String buildingName) { this.buildingName = buildingName; }
    }
}