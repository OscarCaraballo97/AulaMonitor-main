package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.Building;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BuildingRepository extends JpaRepository<Building, String> {
}