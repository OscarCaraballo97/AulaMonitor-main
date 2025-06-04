package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.AuthRequest;
import com.backend.IMonitoring.dto.AuthResponse;
import com.backend.IMonitoring.dto.RegisterRequest;
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.VerificationToken;
import com.backend.IMonitoring.repository.UserRepository;
import com.backend.IMonitoring.repository.VerificationTokenRepository;
import com.backend.IMonitoring.security.UserDetailsImpl;
import com.backend.IMonitoring.exceptions.InvalidReservationException; 
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
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
    private final VerificationTokenRepository tokenRepository; 
    private final EmailService emailService; 

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new IllegalArgumentException("El correo electrónico ya está registrado.");
        }

        var user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword_hash()))
                .role(request.getRole())
                .enabled(false) 
                .build();
        User savedUser = userRepository.save(user); 

        String tokenString = UUID.randomUUID().toString();
        VerificationToken verificationToken = new VerificationToken(tokenString, savedUser);
        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(savedUser.getEmail(), tokenString);

        return AuthResponse.builder()
                .token("Verification email sent. Please check your inbox.")
                .build();
    }
    
    @Transactional
    public String verifyEmail(String token) {
        VerificationToken verificationToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Token de verificación inválido o no encontrado."));

        if (verificationToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            tokenRepository.delete(verificationToken); 
            throw new InvalidReservationException("El token de verificación ha expirado. Por favor, solicita uno nuevo."); 
        }
        
        if (verificationToken.isVerified()) {
            throw new InvalidReservationException("Este token ya ha sido utilizado.");
        }

        User user = verificationToken.getUser();
        if (user == null) {
             throw new ResourceNotFoundException("Usuario asociado al token no encontrado.");
        }
        user.setEnabled(true);
        userRepository.save(user);
        
        verificationToken.setVerified(true); 
        tokenRepository.save(verificationToken);

        return "Correo verificado exitosamente. Ahora puedes iniciar sesión.";
    }


    public AuthResponse authenticate(AuthRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()
                    )
            );
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Credenciales incorrectas. Por favor, verifica tu email y contraseña.");
        }

        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado.")); 

        if (!user.isEnabled()) {
            VerificationToken existingToken = tokenRepository.findByUser_IdAndVerifiedFalse(user.getId()).orElse(null);
            if (existingToken != null && existingToken.getExpiryDate().isAfter(LocalDateTime.now())) {
                emailService.sendVerificationEmail(user.getEmail(), existingToken.getToken());
                 throw new UnauthorizedAccessException("Tu cuenta no está activada. Se ha reenviado un correo de verificación.");
            } else {
                if (existingToken != null) tokenRepository.delete(existingToken); 
                String newTokenString = UUID.randomUUID().toString();
                VerificationToken newVerificationToken = new VerificationToken(newTokenString, user);
                tokenRepository.save(newVerificationToken);
                emailService.sendVerificationEmail(user.getEmail(), newTokenString);
                throw new UnauthorizedAccessException("Tu cuenta no está activada. Se ha enviado un nuevo correo de verificación.");
            }
        }

        UserDetails userDetails = new UserDetailsImpl(user);
        var jwtToken = jwtService.generateToken(userDetails);
        return AuthResponse.builder()
                .token(jwtToken)
                .build();
    }
}