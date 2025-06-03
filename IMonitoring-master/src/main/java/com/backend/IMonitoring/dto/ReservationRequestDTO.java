package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.ReservationStatus; // Asegúrate de importar ReservationStatus
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationRequestDTO {

    @NotBlank(message = "El ID del aula (classroomId) es obligatorio")
    private String classroomId;

    private String userId; 

    @NotNull(message = "La fecha y hora de inicio es obligatoria")
    private LocalDateTime startTime;

    @NotNull(message = "La fecha y hora de fin es obligatoria")
    private LocalDateTime endTime;

    private String purpose;

    private ReservationStatus status; 
}