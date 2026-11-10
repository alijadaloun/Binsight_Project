-- ============================================================
-- BinSight: Amchit Smart Garbage System
-- Database Initialization Script
-- File: binsight_db.sql
-- ============================================================

-- ============================================================
-- 1. CREATE DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS binsightdb;

USE binsightdb;


-- ============================================================
-- 2. DROP TABLES IF THEY ALREADY EXIST
--    Order matters because of foreign-key relationships.
-- ============================================================

DROP TABLE IF EXISTS detection_events;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS cameras;
DROP TABLE IF EXISTS bins;
DROP TABLE IF EXISTS bin_clusters;


-- ============================================================
-- 3. CREATE BIN CLUSTERS TABLE
-- One cluster represents a group of nearby bins.
-- Each cluster has:
--   - one geographic location
--   - one GSM communication module
--   - one monitoring camera
-- ============================================================

CREATE TABLE bin_clusters (
    cluster_id VARCHAR(50) PRIMARY KEY,
    location_name VARCHAR(100),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    gsm_module_id VARCHAR(50)
);


-- ============================================================
-- 4. CREATE BINS TABLE
-- Each smart bin belongs to one cluster.
-- ============================================================

CREATE TABLE bins (
    bin_id VARCHAR(50) PRIMARY KEY,
    cluster_id VARCHAR(50) NOT NULL,
    status VARCHAR(20),

    CONSTRAINT fk_bins_cluster
        FOREIGN KEY (cluster_id)
        REFERENCES bin_clusters(cluster_id)
);


-- ============================================================
-- 5. CREATE SENSOR READINGS TABLE
-- Stores:
--   - ultrasonic fill level
--   - gas reading
--   - IMU tilt angle
--   - timestamp
-- ============================================================

CREATE TABLE sensor_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bin_id VARCHAR(50) NOT NULL,
    fill_level_percentage DECIMAL(5,2),
    gas_level DECIMAL(6,2),
    tilt_angle DECIMAL(5,2),
    timestamp DATETIME NOT NULL,

    CONSTRAINT fk_sensor_readings_bin
        FOREIGN KEY (bin_id)
        REFERENCES bins(bin_id)
);


-- ============================================================
-- 6. CREATE CAMERAS TABLE
-- One camera is associated with one bin cluster.
-- ============================================================

CREATE TABLE cameras (
    camera_id VARCHAR(50) PRIMARY KEY,
    cluster_id VARCHAR(50) NOT NULL,

    CONSTRAINT fk_cameras_cluster
        FOREIGN KEY (cluster_id)
        REFERENCES bin_clusters(cluster_id)
);


-- ============================================================
-- 7. CREATE DETECTION EVENTS TABLE
-- Events generated from:
-- Camera -> RTSP -> OpenCV -> YOLO -> JSON -> MySQL
-- ============================================================

CREATE TABLE detection_events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    camera_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    confidence DECIMAL(4,2),
    timestamp DATETIME NOT NULL,
    snapshot VARCHAR(255),

    CONSTRAINT fk_detection_events_camera
        FOREIGN KEY (camera_id)
        REFERENCES cameras(camera_id)
);


-- ============================================================
-- 8. INSERT THE LIVE CLUSTER
-- One cluster and one bin, fed by the ThingSpeak sensor channel.
-- Add more clusters and bins here when more hardware channels exist.
-- ============================================================

INSERT INTO bin_clusters
(cluster_id, location_name, latitude, longitude, gsm_module_id)
VALUES
('CLUSTER_001', 'Amchit Municipality Center', 34.1395000, 35.6455000, 'GSM_001');


-- ============================================================
-- 9. INSERT THE LIVE BIN
-- Sensor readings are inserted by the backend from ThingSpeak.
-- ============================================================

INSERT INTO bins
(bin_id, cluster_id, status)
VALUES
('BIN_001', 'CLUSTER_001', 'NORMAL');


-- ============================================================
-- 10. INSERT THE CLUSTER CAMERA
-- ============================================================

INSERT INTO cameras
(camera_id, cluster_id)
VALUES
('CAM_001', 'CLUSTER_001');


-- ============================================================
-- 11. INSERT SAMPLE DETECTION EVENTS FOR THE LIVE CAMERA
-- ============================================================

INSERT INTO detection_events
(camera_id, event_type, confidence, timestamp, snapshot)
VALUES
('CAM_001', 'GARBAGE_OUTSIDE_BIN', 0.91, '2026-09-23 08:15:00',
 'CAM_001_2026-09-23_08-15-00.jpg'),

('CAM_001', 'GARBAGE_TRUCK_STOP', 0.93, '2026-09-23 10:05:00',
 'CAM_001_2026-09-23_10-05-00.jpg');


-- ============================================================
-- 14. BASIC VERIFICATION QUERIES
-- ============================================================

SELECT * FROM bin_clusters;
SELECT * FROM bins;
SELECT * FROM sensor_readings;
SELECT * FROM cameras;
SELECT * FROM detection_events;


-- ============================================================
-- 15. QUERY: BINS WITH THEIR CLUSTER LOCATIONS
-- Useful basis for GET /api/bins
-- ============================================================

SELECT
    b.bin_id,
    b.status,
    bc.cluster_id,
    bc.location_name,
    bc.latitude,
    bc.longitude
FROM bins b
JOIN bin_clusters bc
    ON b.cluster_id = bc.cluster_id
ORDER BY b.bin_id;


-- ============================================================
-- 16. QUERY: EACH BIN WITH ITS LATEST SENSOR READING
-- Useful basis for the dashboard and GET /api/bins
-- ============================================================

SELECT
    b.bin_id,
    b.status,
    bc.cluster_id,
    bc.location_name,
    bc.latitude,
    bc.longitude,
    sr.fill_level_percentage,
    sr.gas_level,
    sr.tilt_angle,
    sr.timestamp
FROM bins b
JOIN bin_clusters bc
    ON b.cluster_id = bc.cluster_id
LEFT JOIN sensor_readings sr
    ON sr.id = (
        SELECT sr2.id
        FROM sensor_readings sr2
        WHERE sr2.bin_id = b.bin_id
        ORDER BY sr2.timestamp DESC, sr2.id DESC
        LIMIT 1
    )
ORDER BY b.bin_id;


-- ============================================================
-- 17. QUERY: DETECTION EVENTS WITH CAMERA + CLUSTER LOCATION
-- Useful basis for GET /api/detection-events
-- ============================================================

SELECT
    de.event_id,
    de.event_type,
    de.confidence,
    de.timestamp,
    de.snapshot,
    c.camera_id,
    bc.cluster_id,
    bc.location_name,
    bc.latitude,
    bc.longitude
FROM detection_events de
JOIN cameras c
    ON de.camera_id = c.camera_id
JOIN bin_clusters bc
    ON c.cluster_id = bc.cluster_id
ORDER BY de.timestamp DESC;


-- ============================================================
-- END OF FILE
-- ============================================================
