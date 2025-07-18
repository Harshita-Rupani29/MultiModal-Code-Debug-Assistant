const pool = require('../config/db');
const User = {
    async findOne(query) {
        let sql = 'SELECT * FROM users WHERE ';
        const params = [];
        const conditions = [];

        if (query.email) {
            conditions.push(`LOWER(email) = LOWER($${params.length + 1})`);
            params.push(query.email);
        }
        if (query.google_id) {
            conditions.push(`google_id = $${params.length + 1}`);
            params.push(query.google_id);
        }

        if (conditions.length === 0) {
            throw new Error("No valid query criteria provided for findOne.");
        }

        sql += conditions.join(' AND ');
        const result = await pool.query(sql, params);
        return result.rows[0];
    },

    async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async create(userData) {
        const { firstName, lastName, email, password, mobileNumber, verificationStatus, googleId, profilePicture } = userData;
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password, mobile_number, verification_status, google_id, profile_picture)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [firstName, lastName, email, password, mobileNumber, verificationStatus, googleId, profilePicture]
        );
        return result.rows[0];
    },
    async updateVerificationStatus(userId, status) {
        const result = await pool.query(
            'UPDATE users SET verification_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, userId]
        );
        return result.rows[0];
    },

    async updateGoogleId(userId, googleId) {
        const result = await pool.query(
            'UPDATE users SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [googleId, userId]
        );
        return result.rows[0];
    },
};

module.exports = User;