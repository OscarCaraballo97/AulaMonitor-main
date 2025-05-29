package com.backend.IMonitoring.utils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

public class DateUtils {

    private static final DateTimeFormatter ISO_DATE_TIME_FORMATTER = DateTimeFormatter.ISO_DATE_TIME;

    public static LocalDateTime parseIsoDateTime(String dateTimeString) {
        if (dateTimeString == null || dateTimeString.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(dateTimeString, ISO_DATE_TIME_FORMATTER);
        } catch (DateTimeParseException e) {

            System.err.println("Error al parsear fecha-hora ISO: " + dateTimeString + " - " + e.getMessage());
            return null; 
        }
    }
}