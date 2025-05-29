package com.backend.IMonitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomAvailabilitySummaryDTO {
    private int availableNow;
    private int occupiedNow;
    private int total;
}
