// In models/token.js
const pool = require('../config/db');

const Token = {
    async findOne(query) {
        let sql = 'SELECT * FROM tokens WHERE ';
        const params = [];
        const conditions = [];

        if (query.userId) {
            conditions.push(`user_id = $${params.length + 1}`);
            params.push(query.userId);
        }
        if (query.token) {
            conditions.push(`token_value = $${params.length + 1}`);
            params.push(query.token);
        }
        if (query.id) { 
            conditions.push(`id = $${params.length + 1}`);
            params.push(query.id);
        }

        if (conditions.length === 0) {
            throw new Error("No valid query criteria provided for findOne.");
        }

        sql += conditions.join(' AND ');
        const result = await pool.query(sql, params);
        return result.rows[0];
    },

    async create(tokenData) {
        const { userId, token } = tokenData;
        const result = await pool.query(
            'INSERT INTO tokens (user_id, token_value) VALUES ($1, $2) RETURNING *',
            [userId, token]
        );
        return result.rows[0];
    },

    async findOneAndDelete(query) {
        let sql = 'DELETE FROM tokens WHERE ';
        const params = [];
        const conditions = [];

        if (query.id) {
            conditions.push(`id = $${params.length + 1}`);
            params.push(query.id);
        }
        if (query.userId) {
            conditions.push(`user_id = $${params.length + 1}`);
            params.push(query.userId);
        }
        if (query.token) {
            conditions.push(`token_value = $${params.length + 1}`);
            params.push(query.token);
        }

        if (conditions.length === 0) {
            throw new Error("No valid deletion criteria provided for findOneAndDelete.");
        }

        sql += conditions.join(' AND ');
        const result = await pool.query(sql, params);
        return result.rowCount > 0;
    }
};

module.exports = Token;