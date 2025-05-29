package com.backend.IMonitoring.repository;

import com.backend.IMonitoring.model.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, String> {
    Optional<VerificationToken> findByToken(String token);
    Optional<VerificationToken> findByUser_IdAndVerifiedFalse(String userId);
}