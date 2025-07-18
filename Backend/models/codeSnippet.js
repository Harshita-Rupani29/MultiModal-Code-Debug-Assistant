// models/codeSnippet.js
const pool = require('../config/db');

const CodeSnippet = {
    async create({ sessionId, userId, codeContent, language, fileName }) {
        const result = await pool.query(
            'INSERT INTO code_snippets (session_id, user_id, code_content, language, file_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [sessionId, userId, codeContent, language, fileName]
        );
        return result.rows[0];
    },
    async findBySessionId(sessionId) {
        const result = await pool.query('SELECT * FROM code_snippets WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]);
        return result.rows;
    },
    
};

module.exports = CodeSnippet;