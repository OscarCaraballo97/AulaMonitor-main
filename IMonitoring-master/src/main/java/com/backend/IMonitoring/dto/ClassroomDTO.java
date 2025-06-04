package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.ClassroomType;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomDTO {
    private String id;
    private String name;
    private Integer capacity;
    private ClassroomType type;
    private List<String> resources;
    private String buildingId;
    private String buildingName; 
}