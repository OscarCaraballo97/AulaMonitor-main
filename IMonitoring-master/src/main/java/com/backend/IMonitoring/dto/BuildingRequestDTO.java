package com.backend.IMonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BuildingRequestDTO {
    @NotBlank(message = "El nombre del edificio no puede estar vacío.")
    @Size(min = 2, max = 100, message = "El nombre del edificio debe tener entre 2 y 100 caracteres.")
    private String name;

    @Size(max = 255, message = "La ubicación no puede exceder los 255 caracteres.")
    private String location;
}
