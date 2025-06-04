package com.backend.IMonitoring.dto;

import com.backend.IMonitoring.model.Rol;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryDTO {
    private String id;
    private String name;
    private String email;
    private Rol role;
}