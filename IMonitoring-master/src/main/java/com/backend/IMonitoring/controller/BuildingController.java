package com.backend.IMonitoring.controller;

import com.backend.IMonitoring.dto.BuildingRequestDTO;
import com.backend.IMonitoring.model.Building;
import com.backend.IMonitoring.service.BuildingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/buildings")
@RequiredArgsConstructor
public class BuildingController {

    private final BuildingService buildingService;

    @GetMapping
    public ResponseEntity<List<Building>> getAllBuildings() {
        return ResponseEntity.ok(buildingService.getAllBuildings());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Building> getBuildingById(@PathVariable String id) {
        return ResponseEntity.ok(buildingService.getBuildingById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Building> createBuilding(@Valid @RequestBody BuildingRequestDTO buildingRequestDTO) {
        Building createdBuilding = buildingService.createBuilding(buildingRequestDTO);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdBuilding.getId())
                .toUri();
        return ResponseEntity.created(location).body(createdBuilding);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Building> updateBuilding(@PathVariable String id, @Valid @RequestBody BuildingRequestDTO buildingRequestDTO) {
        Building updatedBuilding = buildingService.updateBuilding(id, buildingRequestDTO);
        return ResponseEntity.ok(updatedBuilding);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteBuilding(@PathVariable String id) {
        buildingService.deleteBuilding(id);
        return ResponseEntity.noContent().build();
    }
}
