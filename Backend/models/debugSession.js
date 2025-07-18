// models/debugSession.js
const pool = require('../config/db');

const DebugSession = {
    async create({ userId, title, description }) {
        const result = await pool.query(
            'INSERT INTO debug_sessions (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, title, description]
        );
        return result.rows[0];
    },
    async findById(id) {
        const result = await pool.query('SELECT * FROM debug_sessions WHERE id = $1', [id]);
        return result.rows[0];
    },
    async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM debug_sessions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    },
    async updateStatus(id, status) {
        const result = await pool.query(
            'UPDATE debug_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    },
   
};

module.exports = DebugSession;