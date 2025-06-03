package com.backend.IMonitoring.service;

import com.backend.IMonitoring.dto.UserDTO; 
import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Rol;
import com.backend.IMonitoring.repository.UserRepository;
import com.backend.IMonitoring.repository.ReservationRepository;
import com.backend.IMonitoring.model.Reservation;
import com.backend.IMonitoring.exceptions.UnauthorizedAccessException;
import com.backend.IMonitoring.exceptions.ResourceNotFoundException;
import com.backend.IMonitoring.exceptions.UserAlreadyExistsException;
import com.backend.IMonitoring.exceptions.InvalidCredentialsException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.backend.IMonitoring.security.UserDetailsImpl;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ReservationRepository reservationRepository;

    public List<User> getAllUsers() {
        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con ID: " + id));
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public List<User> getUsersByRole(Rol role) {
        return userRepository.findByRole(role, Sort.by(Sort.Direction.ASC, "name"));
    }
    
    public List<User> getUsersByRoleName(String roleName) {
        try {
            Rol role = Rol.valueOf(roleName.toUpperCase());
            return getUsersByRole(role);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Rol no válido: " + roleName);
        }
    }

    @Transactional
    public User createUser(UserDTO userDTO) { 
        if (userRepository.findByEmail(userDTO.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("El correo electrónico '" + userDTO.getEmail() + "' ya está registrado.");
        }
        User user = userDTO.toEntity(); // Asume que UserDTO tiene un método toEntity()
        
      
        if (user.getPassword() == null || user.getPassword().isEmpty()){
             throw new IllegalArgumentException("La contraseña es obligatoria y no fue proporcionada en el DTO para el nuevo usuario.");
        }
       

        user.setEnabled(userDTO.isEnabled()); 
        return this.createUser(user);
    }

   
    @Transactional
    public User createUser(User user) { 
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("El correo electrónico '" + user.getEmail() + "' ya está registrado.");
        }
        if (user.getPassword() != null && !user.getPassword().isEmpty() && !user.getPassword().startsWith("$2a$")) { 
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        } else if (user.getPassword() == null || user.getPassword().isEmpty()){
            throw new IllegalArgumentException("La contraseña es obligatoria para crear un nuevo usuario.");
        }
        if(user.getRole() == null) {
            user.setRole(Rol.ESTUDIANTE);
        }
        user.setEnabled(true);
        return userRepository.save(user);
    }

    @Transactional
    public User updateUser(String id, UserDTO userDTO, User performingUser) {
        User existingUser = getUserById(id);

        boolean isAdmin = performingUser.getRole() == Rol.ADMIN;
        boolean isSelf = existingUser.getId().equals(performingUser.getId());

        if (!isAdmin && !isSelf) {
            throw new UnauthorizedAccessException("No tienes permiso para actualizar este usuario.");
        }

        if (userDTO.getName() != null) {
            existingUser.setName(userDTO.getName());
        }

        if (userDTO.getEmail() != null && !existingUser.getEmail().equalsIgnoreCase(userDTO.getEmail())) {
            if (!isSelf && !isAdmin) {
                throw new UnauthorizedAccessException("No tienes permiso para cambiar el email de este usuario.");
            }
            Optional<User> userWithNewEmail = userRepository.findByEmail(userDTO.getEmail());
            if (userWithNewEmail.isPresent() && !userWithNewEmail.get().getId().equals(existingUser.getId())) {
                throw new IllegalArgumentException("El nuevo correo electrónico '" + userDTO.getEmail() + "' ya está en uso por otro usuario.");
            }
            existingUser.setEmail(userDTO.getEmail());
        }
        
        if (userDTO.getAvatarUrl() != null) { 
            existingUser.setAvatarUrl(userDTO.getAvatarUrl().isEmpty() ? null : userDTO.getAvatarUrl());
        }

        if (userDTO.getRole() != null && userDTO.getRole() != existingUser.getRole()) {
            if (!isAdmin) {
                throw new UnauthorizedAccessException("No tienes permiso para cambiar el rol de este usuario.");
            }
            if (isSelf && userDTO.getRole() != Rol.ADMIN) {
                throw new UnauthorizedAccessException("Un administrador no puede cambiar su propio rol a uno no administrador.");
            }
            existingUser.setRole(userDTO.getRole());
        }
        

        if (existingUser.isEnabled() != userDTO.isEnabled()) { 
            if (!isAdmin) {
                throw new UnauthorizedAccessException("No tienes permiso para cambiar el estado de habilitación de este usuario.");
            }
            if (isSelf && !userDTO.isEnabled()) {
                throw new UnauthorizedAccessException("Un administrador no puede deshabilitar su propia cuenta.");
            }
            existingUser.setEnabled(userDTO.isEnabled());
        }
        
        return userRepository.save(existingUser);
    }
    
    @Transactional
    public void updateUserPassword(String userId, String currentPassword, String newPassword, User currentUser) {
        User userToUpdate = getUserById(userId);

        boolean isAdmin = currentUser.getRole() == Rol.ADMIN;
        boolean isSelf = userToUpdate.getId().equals(currentUser.getId());

        if (!isSelf && !isAdmin) {
            throw new UnauthorizedAccessException("No tienes permiso para cambiar la contraseña de este usuario.");
        }

        if (isSelf) { 
            if (currentPassword == null || currentPassword.isEmpty()){
                 throw new IllegalArgumentException("La contraseña actual es requerida para cambiar tu contraseña.");
            }
            if(!passwordEncoder.matches(currentPassword, userToUpdate.getPassword())) {
                throw new InvalidCredentialsException("La contraseña actual es incorrecta.");
            }
        }

        userToUpdate.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(userToUpdate);
    }

    @Transactional
    public void deleteUser(String id) {
        User userToDelete = getUserById(id);
        List<Reservation> userReservations = reservationRepository.findByUserId(id, Sort.unsorted());
        if (userReservations != null && !userReservations.isEmpty()) {
            reservationRepository.deleteAll(userReservations);
        }
        userRepository.delete(userToDelete);
    }

    public List<Reservation> getReservationsByUserId(String userId) {
        getUserById(userId); 
        return reservationRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "startTime"));
    }
    
    public User getCurrentAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetailsImpl) {
            return ((UserDetailsImpl) principal).getUserEntity();
        } else if (principal instanceof String && "anonymousUser".equals(principal)) {
             throw new UnauthorizedAccessException("Usuario no autenticado.");
        }
        throw new IllegalStateException("El principal de autenticación no es del tipo esperado: " + (principal != null ? principal.getClass().getName() : "null"));
    }
}