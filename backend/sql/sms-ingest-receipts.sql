CREATE TABLE IF NOT EXISTS sms_ingest_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    message_hash CHAR(64) NOT NULL UNIQUE,
    sender_number VARCHAR(30) NOT NULL,
    cluster_id VARCHAR(50) NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sms_receipts_cluster FOREIGN KEY (cluster_id)
        REFERENCES bin_clusters(cluster_id)
);
