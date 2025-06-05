package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.AuthRequest;
import com.backend.IMonitoring.dto.AuthResponse;
import com.backend.IMonitoring.dto.RegisterRequest;
import com.backend.IMonitoring.exceptions.InvalidCredentialsException;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import com.backend.IMonitoring.exceptions.UserAlreadyExistsException;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.VerificationToken;
import com.backend.IMonitoring.repository.UserRepository;
import com.backend.IMonitoring.repository.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final VerificationTokenRepository verificationTokenRepository;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("El correo electrónico ya está registrado.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword())) 
                .role(request.getRole() != null ? request.getRole() : Rol.ESTUDIANTE)
                .enabled(false) 
                .build();

        userRepository.save(user);

        String token = UUID.randomUUID().toString();
        VerificationToken verificationToken = VerificationToken.builder() 
                .token(token)
                .user(user)
                .expiryDate(LocalDateTime.now().plusHours(24))
                .build();
        verificationTokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(user.getEmail(), token);

        String jwtToken = jwtService.generateToken(user); 
        String refreshToken = jwtService.generateRefreshToken(user);
        return AuthResponse.builder()
                .token(jwtToken)
                .refreshToken(refreshToken)
                .build();
    }

    @Transactional
    public AuthResponse authenticate(AuthRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()
                    )
            );
        } catch (AuthenticationException e) {
            throw new InvalidCredentialsException("Correo electrónico o contraseña incorrectos.");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con email: " + request.getEmail()));

        if (!user.isEnabled()) {
            throw new InvalidCredentialsException("Tu cuenta no ha sido verificada. Por favor, verifica tu correo electrónico.");
        }

        String jwtToken = jwtService.generateToken(user); 
        String refreshToken = jwtService.generateRefreshToken(user); 
        return AuthResponse.builder()
                .token(jwtToken)
                .refreshToken(refreshToken)
                .build();
    }

    @Transactional
    public void verifyEmailToken(String token) {
        VerificationToken verificationToken = verificationTokenRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Token de verificación inválido o expirado."));

        if (verificationToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            verificationTokenRepository.delete(verificationToken); 
            throw new InvalidCredentialsException("El token de verificación ha expirado. Por favor, solicita uno nuevo.");
        }

        User user = verificationToken.getUser();
        user.setEnabled(true);
        userRepository.save(user);
        verificationTokenRepository.delete(verificationToken);
    }

    @Transactional
    public void requestPasswordReset(String email) {
        System.out.println("Password reset requested for: " + email);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        System.out.println("Password reset for token: " + token + " with new password.");
    }

    @Transactional
    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtService.isTokenValid(refreshToken)) {
            throw new InvalidCredentialsException("Refresh token inválido o expirado.");
        }

        String userEmail = jwtService.extractUsername(refreshToken);
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado para el refresh token."));

        String newAccessToken = jwtService.generateToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);

        return AuthResponse.builder()
                .token(newAccessToken)
                .refreshToken(newRefreshToken)
                .build();
    }
}