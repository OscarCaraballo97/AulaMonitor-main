package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.ReservationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationResponseDTO {
    private String id;
    private ClassroomSummaryDTO classroom; 
    private UserSummaryDTO user;       
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private ReservationStatus status;
    private String purpose;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}