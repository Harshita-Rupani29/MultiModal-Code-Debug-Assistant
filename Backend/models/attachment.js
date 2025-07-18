// models/attachment.js
const pool = require('../config/db');

const Attachment = {
    async create({ sessionId, userId, fileName, fileType, filePath, extractedText = null }) {
        const result = await pool.query(
            `INSERT INTO attachments (session_id, user_id, file_name, file_type, file_path, extracted_text)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [sessionId, userId, fileName, fileType, filePath, extractedText]
        );
        return result.rows[0];
    },
    async findBySessionId(sessionId) {
        const result = await pool.query('SELECT * FROM attachments WHERE session_id = $1 ORDER BY uploaded_at ASC', [sessionId]);
        return result.rows;
    },
};

module.exports = Attachment;