package com.backend.IMonitoring.security;

import com.backend.IMonitoring.model.User;
import com.backend.IMonitoring.model.Rol; 
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

public class UserDetailsImpl implements UserDetails {
    private final User user;

    public UserDetailsImpl(User user) {
        this.user = user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (user.getRole() == null) {
            return Collections.emptyList();
        }
        return Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() { return true; }
    @Override
    public boolean isAccountNonLocked() { return true; }
    @Override
    public boolean isCredentialsNonExpired() { return true; }
    
    @Override
    public boolean isEnabled() {
        return this.user.isEnabled(); 
    }

    public User getUserEntity() {
        return this.user;
    }

    public String getId() {
        return this.user.getId();
    }

    public String getName() {
        return this.user.getName();
    }

    public Rol getRoleEnum() { 
        return this.user.getRole();
    }
}