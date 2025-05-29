package com.backend.IMonitoring.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "classroom")
public class Classroom {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ClassroomType type;

    private String resources;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id", nullable = false)
    @JsonBackReference("building-classrooms")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Building building;

    @OneToMany(mappedBy = "classroom", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @ToString.Exclude 
    @EqualsAndHashCode.Exclude
    @JsonManagedReference("classroom-reservations")
    private List<Reservation> reservations;

    @Transient
    public String getBuildingId() {
        return (this.building != null) ? this.building.getId() : null;
    }
}

