package com.backend.IMonitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomSummaryDTO {
    private String id;
    private String name;
    private String buildingName;
}