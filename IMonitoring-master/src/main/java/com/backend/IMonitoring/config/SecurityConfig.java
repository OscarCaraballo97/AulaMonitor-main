package com.backend.IMonitoring.config;

import com.backend.IMonitoring.model.Rol;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity 
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(
                    "/api/auth/**",
                    "/v3/api-docs/**", 
                    "/swagger-ui/**",  
                    "/swagger-resources/**",
                    "/webjars/**"
                ).permitAll()

                .requestMatchers(HttpMethod.GET, "/api/buildings", "/api/buildings/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/buildings").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.PUT, "/api/buildings/**").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.DELETE, "/api/buildings/**").hasAuthority("ROLE_" + Rol.ADMIN.name())

                // Aulas: ADMIN gestiona, los autenticados solo pueden ver lista y disponibilidad
                .requestMatchers(HttpMethod.GET, "/api/classrooms", "/api/classrooms/{id}").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/classrooms/availability", "/api/classrooms/{classroomId}/reservations").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/classrooms").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.PUT, "/api/classrooms/**").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.DELETE, "/api/classrooms/**").hasAuthority("ROLE_" + Rol.ADMIN.name())

                // Reservas
                .requestMatchers(HttpMethod.POST, "/api/reservations").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.PROFESOR.name(), "ROLE_" + Rol.TUTOR.name(), "ROLE_" + Rol.ESTUDIANTE.name(), "ROLE_" + Rol.COORDINADOR.name())
                .requestMatchers(HttpMethod.GET, "/api/reservations", "/api/reservations/{id}").authenticated() 
                .requestMatchers(HttpMethod.PUT, "/api/reservations/{id}/status").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.COORDINADOR.name())
                .requestMatchers(HttpMethod.PATCH, "/api/reservations/{id}/status").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.COORDINADOR.name())
                .requestMatchers(HttpMethod.PUT, "/api/reservations/{id}").authenticated() 
                .requestMatchers(HttpMethod.DELETE, "/api/reservations/{id}").authenticated() 
                .requestMatchers(HttpMethod.PATCH, "/api/reservations/{id}/cancel").authenticated()

                // Usuarios
                .requestMatchers(HttpMethod.GET, "/api/users/me").authenticated() 
                .requestMatchers(HttpMethod.GET, "/api/users/me/reservations").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/users/{id}").authenticated() 
                .requestMatchers(HttpMethod.PATCH, "/api/users/{id}/password").authenticated()

                // Gestión de Usuarios: ADMIN puede ver todos y por rol, COORDINADOR puede ver ciertos roles
                .requestMatchers(HttpMethod.GET, "/api/users").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.COORDINADOR.name())
                .requestMatchers(HttpMethod.GET, "/api/users/{id}").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.COORDINADOR.name()) 
                .requestMatchers(HttpMethod.GET, "/api/users/role/{role}").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.COORDINADOR.name()) 
                .requestMatchers(HttpMethod.POST, "/api/users").hasAuthority("ROLE_" + Rol.ADMIN.name()) 
                .requestMatchers(HttpMethod.DELETE, "/api/users/{id}").hasAuthority("ROLE_" + Rol.ADMIN.name())
                .requestMatchers(HttpMethod.GET, "/api/users/{userId}/reservations").hasAnyAuthority("ROLE_" + Rol.ADMIN.name(), "ROLE_" + Rol.COORDINADOR.name())

                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:8100")); 
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*")); 
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); 
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration); 
        return source;
    }
}