// models/analyzedError.js
const pool = require('../config/db');

const AnalyzedError = {
    async create({ sessionId, errorType, rawErrorMessage, aiClassification, aiExplanation, aiSolution, severity, suggestedCodeFix }) {
        try {
            const result = await pool.query(
                `INSERT INTO analyzed_errors (session_id, error_type, raw_error_message, ai_classification, ai_explanation, ai_solution, severity, suggested_code_fix)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [sessionId, errorType, rawErrorMessage, aiClassification, aiExplanation, aiSolution, severity, suggestedCodeFix]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error creating analyzed error:', error);
            throw error; // Re-throw the error for upstream handling
        }
    },

    async findBySessionId(sessionId) {
        try {
            const result = await pool.query(
                `SELECT * FROM analyzed_errors WHERE session_id = $1`,
                [sessionId]
            );
            return result.rows; // Return all analyzed errors for that session
        } catch (error) {
            console.error('Error finding analyzed errors by session ID:', error);
            throw error; // Re-throw the error
        }
    }
};

module.exports = AnalyzedError;