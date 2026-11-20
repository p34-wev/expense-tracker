-- Student Management System - schema for the EXISTING database.
-- Safe to re-run: it only creates tables when missing and never drops data.
CREATE DATABASE IF NOT EXISTS student_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE student_management;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id          INT UNSIGNED DEFAULT NULL,
  full_name              VARCHAR(120) NOT NULL,
  email                  VARCHAR(254) NOT NULL,
  phone                  VARCHAR(30)  DEFAULT NULL,
  course                 VARCHAR(120) NOT NULL,
  enrollment_date        DATE NOT NULL,
  status                 ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  aadhaar_demo_completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  mathematics_marks      DECIMAL(5,2) DEFAULT NULL,
  science_marks          DECIMAL(5,2) DEFAULT NULL,
  english_marks          DECIMAL(5,2) DEFAULT NULL,
  UNIQUE KEY uq_students_owner_email (owner_user_id, email),
  KEY idx_students_name (full_name),
  KEY idx_students_course (course),
  KEY idx_students_status (status),
  CONSTRAINT fk_students_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
) ENGINE=InnoDB;
