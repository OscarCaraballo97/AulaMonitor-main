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
    protected User createUserEntityLogic(User user, User performingUser) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("El correo electrónico '" + user.getEmail() + "' ya está registrado.");
        }

        if (user.getPassword() == null || user.getPassword().isEmpty()) {
            throw new IllegalArgumentException("La contraseña es obligatoria para crear un nuevo usuario.");
        }
       
        if (!user.getPassword().startsWith("$2a$")) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }


        if (performingUser.getRole() == Rol.COORDINADOR) {
            if (user.getRole() == null) {
                user.setRole(Rol.ESTUDIANTE);
            } else if (user.getRole() == Rol.ADMIN || user.getRole() == Rol.COORDINADOR) {
                throw new UnauthorizedAccessException("Un Coordinador no puede crear usuarios con rol ADMIN o COORDINADOR.");
            }
          
        } else if (performingUser.getRole() == Rol.ADMIN) {
            if (user.getRole() == null) {
                user.setRole(Rol.ESTUDIANTE); 
            }
        } else {
            throw new UnauthorizedAccessException("No tienes permiso para crear usuarios.");
        }
        
        return userRepository.save(user);
    }
    
    @Transactional
    public User createUser(UserDTO userDTO, User performingUser) {
        User user = userDTO.toEntity();
        return createUserEntityLogic(user, performingUser);
    }


    @Transactional
    public User updateUser(String id, UserDTO userDTO, User performingUser) {
        User existingUser = getUserById(id); 

        boolean isPerformingAdmin = performingUser.getRole() == Rol.ADMIN;
        boolean isPerformingCoordinator = performingUser.getRole() == Rol.COORDINADOR;
        boolean isSelf = existingUser.getId().equals(performingUser.getId());

        if (!isPerformingAdmin && !isSelf && !isPerformingCoordinator) {
            throw new UnauthorizedAccessException("No tienes permiso para actualizar este usuario.");
        }
        
        if (userDTO.getName() != null) {
            if(isSelf || isPerformingAdmin || (isPerformingCoordinator && isUserManageableByCoordinator(existingUser.getRole()))) {
                existingUser.setName(userDTO.getName());
            } else if (isPerformingCoordinator) {
                 throw new UnauthorizedAccessException("Un Coordinador no puede modificar el nombre de este tipo de usuario.");
            }
        }

        // Actualizar email
        if (userDTO.getEmail() != null && !existingUser.getEmail().equalsIgnoreCase(userDTO.getEmail())) {
            if(isSelf || isPerformingAdmin || (isPerformingCoordinator && isUserManageableByCoordinator(existingUser.getRole()))) {
                Optional<User> userWithNewEmail = userRepository.findByEmail(userDTO.getEmail());
                if (userWithNewEmail.isPresent() && !userWithNewEmail.get().getId().equals(existingUser.getId())) {
                    throw new UserAlreadyExistsException("El nuevo correo electrónico '" + userDTO.getEmail() + "' ya está en uso por otro usuario.");
                }
                existingUser.setEmail(userDTO.getEmail());
            } else if (isPerformingCoordinator) {
                throw new UnauthorizedAccessException("Un Coordinador no puede modificar el email de este tipo de usuario.");
            }
        }
        
        if (userDTO.getAvatarUrl() != null) {
             if(isSelf || isPerformingAdmin || (isPerformingCoordinator && isUserManageableByCoordinator(existingUser.getRole()))) {
                existingUser.setAvatarUrl(userDTO.getAvatarUrl().isEmpty() ? null : userDTO.getAvatarUrl());
            } else if (isPerformingCoordinator) {
                throw new UnauthorizedAccessException("Un Coordinador no puede modificar el avatar de este tipo de usuario.");
            }
        } else if (userDTO.getAvatarUrl() == null && existingUser.getAvatarUrl() != null) {
            if(isSelf || isPerformingAdmin || (isPerformingCoordinator && isUserManageableByCoordinator(existingUser.getRole()))) {
                existingUser.setAvatarUrl(null);
            }
        }


        if (userDTO.getRole() != null && userDTO.getRole() != existingUser.getRole()) {
            if (isPerformingAdmin) {
                if (isSelf && userDTO.getRole() != Rol.ADMIN) {
                     throw new UnauthorizedAccessException("Un administrador no puede cambiar su propio rol a uno no administrador.");
                }
                existingUser.setRole(userDTO.getRole());
            } else if (isPerformingCoordinator) {
                if (!isUserManageableByCoordinator(existingUser.getRole()) || !isRoleAssignableByCoordinator(userDTO.getRole())) {
                    throw new UnauthorizedAccessException("Un Coordinador no puede asignar/cambiar a este rol o para este usuario.");
                }
                if (isSelf) { 
                    throw new UnauthorizedAccessException("Un Coordinador no puede cambiar su propio rol.");
                }
                existingUser.setRole(userDTO.getRole());
            } else { 
                throw new UnauthorizedAccessException("No tienes permiso para cambiar el rol de este usuario.");
            }
        }
        

        if (existingUser.isEnabled() != userDTO.isEnabled()) {
            if (isPerformingAdmin) {
                 if (isSelf && !userDTO.isEnabled()) {
                    throw new UnauthorizedAccessException("Un administrador no puede deshabilitar su propia cuenta.");
                }
                existingUser.setEnabled(userDTO.isEnabled());
            } else if (isPerformingCoordinator) {
                 if (!isUserManageableByCoordinator(existingUser.getRole())) {
                     throw new UnauthorizedAccessException("Un Coordinador no puede cambiar el estado de este tipo de usuario.");
                 }
                 if (isSelf) {
                     throw new UnauthorizedAccessException("Un Coordinador no puede deshabilitar su propia cuenta.");
                 }
                 existingUser.setEnabled(userDTO.isEnabled());
            } else { 
                throw new UnauthorizedAccessException("No tienes permiso para cambiar el estado de habilitación de este usuario.");
            }
        }
        
        return userRepository.save(existingUser);
    }
    
    private boolean isUserManageableByCoordinator(Rol userRole) {
        return userRole == Rol.ESTUDIANTE || userRole == Rol.PROFESOR || userRole == Rol.TUTOR;
    }

    private boolean isRoleAssignableByCoordinator(Rol roleToAssign) {
        return roleToAssign == Rol.ESTUDIANTE || roleToAssign == Rol.PROFESOR || roleToAssign == Rol.TUTOR;
    }

    @Transactional
    public void updateUserPassword(String userId, String currentPassword, String newPassword, User performingUser) {
        User userToUpdate = getUserById(userId);

        boolean isAdmin = performingUser.getRole() == Rol.ADMIN;
        boolean isSelf = userToUpdate.getId().equals(performingUser.getId());

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
    public void deleteUser(String id, User performingUser) { 
        User userToDelete = getUserById(id);

        boolean isAdmin = performingUser.getRole() == Rol.ADMIN;
        boolean isCoordinator = performingUser.getRole() == Rol.COORDINADOR;

        if (isAdmin) {
            if (userToDelete.getId().equals(performingUser.getId())) {
                throw new UnauthorizedAccessException("Un administrador no puede eliminarse a sí mismo.");
            }
        } else if (isCoordinator) {
            if (!isUserManageableByCoordinator(userToDelete.getRole())) {
                throw new UnauthorizedAccessException("Un Coordinador no tiene permiso para eliminar usuarios con el rol: " + userToDelete.getRole());
            }
            if (userToDelete.getId().equals(performingUser.getId())) {
                 throw new UnauthorizedAccessException("Un coordinador no puede eliminarse a sí mismo.");
            }
        } else { 
            throw new UnauthorizedAccessException("No tienes permiso para eliminar este usuario.");
        }


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