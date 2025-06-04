package com.backend.IMonitoring.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {
    private final JavaMailSender mailSender;
    @Value("${app.frontend.url}")
    private String frontendUrl;

    public void sendVerificationEmail(String to, String token) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Verificación de Correo Electrónico - IMonitoring");
        String verificationUrl = frontendUrl + "/verify-email?token=" + token;
        message.setText("Hola,\n\n" +
                        "¡Gracias por registrarte en IMonitoring!.\n" +
                        "Por favor, haz clic en el siguiente botón para verificar tu correo electrónico y activar tu cuenta:\n\n" +
                        "[" + verificationUrl + "]\n" +
                        "Haz clic aquí para activar tu cuenta: " + verificationUrl + "\n\n" + 
                        "Si no te registraste, por favor ignora este correo." +
                        "\n\nSaludos,\nEl equipo de IMonitoring");
        mailSender.send(message);
    }
}