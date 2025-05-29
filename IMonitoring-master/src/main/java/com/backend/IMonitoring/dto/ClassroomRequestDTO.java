package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.ClassroomType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomRequestDTO {

    @NotBlank(message = "El nombre del aula no puede estar vacío")
    private String name;

    @NotNull(message = "La capacidad es obligatoria")
    @Min(value = 1, message = "La capacidad debe ser al menos 1")
    private Integer capacity;

    @NotNull(message = "El tipo de aula es obligatorio")
    private ClassroomType type;

    private String resources;

    @NotBlank(message = "El ID del edificio (buildingId) es obligatorio")
    private String buildingId;
}
