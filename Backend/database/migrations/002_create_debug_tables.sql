-- 002_create_debug_tables.sql

CREATE TABLE IF NOT EXISTS debug_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'created', -- e.g., 'created', 'analyzed', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for Code Snippets
CREATE TABLE IF NOT EXISTS code_snippets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES debug_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
    code_content TEXT NOT NULL,
    language VARCHAR(50), 
    file_name VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for AI-Analyzed Errors/Suggestions
CREATE TABLE IF NOT EXISTS analyzed_errors (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES debug_sessions(id) ON DELETE CASCADE,
    error_type VARCHAR(100),
    raw_error_message TEXT, 
    ai_classification VARCHAR(100), -- AI's classified category (e.g., 'Logical Error', 'API Misuse')
    ai_explanation TEXT,
    ai_solution TEXT, 
    severity VARCHAR(50), 
    suggested_code_fix TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Table for File Attachments (Screenshots, Log Files)
CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES debug_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100), -- e.g., 'image/png', 'text/plain'
    file_path TEXT NOT NULL, 
    extracted_text TEXT, 
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);