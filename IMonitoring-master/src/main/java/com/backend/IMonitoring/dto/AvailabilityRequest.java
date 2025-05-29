package com.backend.IMonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AvailabilityRequest {

    @NotBlank(message = "El ID del aula (classroomId) es obligatorio")
    private String classroomId;

    @NotNull(message = "La fecha y hora de inicio son obligatorias")
    private LocalDateTime startTime;

    @NotNull(message = "La fecha y hora de fin son obligatorias")
    private LocalDateTime endTime;
}
