// controllers/debugController.js

const HttpError = require("../models/http-error");
const DebugSession = require("../models/debugSession");
const CodeSnippet = require("../models/codeSnippet");
const AnalyzedError = require("../models/analyzedError");
const Attachment = require("../models/attachment");
const {
    extractTextFromImage,
    classifyDebugRequest,
    analyzeError,
    generateSolution
} = require("../services/ai-service");
const fs = require('fs/promises');

const analyzeDebugRequest = async (req, res, next) => {
    const { code, errorLogs, language, title, description, additionalNotes } = req.body;
    const userId = req.userData.userId;

    if (!code && !errorLogs && !req.file) {
        return next(new HttpError('At least code, error logs, or a screenshot must be provided.', 400));
    }

    let newSession;
    let extractedText = null;
    let filePath = null;

    try {
        // 1. Create a new debug session with a 'pending' status
        newSession = await DebugSession.create({
            userId,
            title: title || `Debug Session - ${new Date().toLocaleString()}`,
            description: description || 'No description provided.',
            status: 'pending'
        });

        // 2. Store the provided code snippet
        if (code) {
            await CodeSnippet.create({
                sessionId: newSession.id,
                userId,
                codeContent: code,
                language: language || 'plaintext',
                fileName: 'user_provided_code.txt'
            });
        }

        // 3. Process uploaded file (Screenshot OCR Agent - Agent 4)
        if (req.file) {
            filePath = req.file.path;
            try {
                if (req.file.mimetype.startsWith('image/')) {
                    extractedText = await extractTextFromImage(filePath);
                } else if (req.file.mimetype === 'text/plain') {
                    extractedText = await fs.readFile(filePath, 'utf8');
                }

                await Attachment.create({
                    sessionId: newSession.id,
                    userId,
                    fileName: req.file.filename,
                    fileType: req.file.mimetype,
                    filePath: filePath,
                    extractedText: extractedText
                });

            } catch (err) {
                console.error("Error processing attached file:", err);
                return next(new HttpError('Failed to process uploaded file.', 500));
            }
        }

        // Combine all error log inputs for comprehensive AI analysis
        const combinedErrorLogs = errorLogs + (extractedText ? `\n(From Attachment):\n${extractedText}` : '');
        const aiContext = {
            language: language,
            extractedText: extractedText, // Pass along extracted text for AI context
            additionalNotes: additionalNotes
        };

        // 4. Agent 1: Initial Classification/Routing
        const initialClassification = await classifyDebugRequest(
            code,
            combinedErrorLogs,
            extractedText, // Pass extractedText as well if the classifier uses it directly
            language,
            additionalNotes
        );
        console.log("Initial AI Classification:", initialClassification);

        let analyzedResult;
        let solutionResult;

        // 5. Agent 2: Error Analysis Agent Execution
        analyzedResult = await analyzeError(code, combinedErrorLogs, aiContext, initialClassification);
        console.log("AI Error Analysis:", analyzedResult);

        // 6. Agent 3: Solution Generation Agent Execution
        // Pass the analysis results to the solution agent for context
        solutionResult = await generateSolution(code, combinedErrorLogs, { ...analyzedResult, ...aiContext });
        console.log("AI Solution Generation:", solutionResult);

        // 7. Store AI analysis results
        await AnalyzedError.create({
            sessionId: newSession.id,
            errorType: analyzedResult.errorType || 'Unclassified',
            rawErrorMessage: combinedErrorLogs,
            aiClassification: analyzedResult.summary || 'N/A', // Using summary as classification
            aiExplanation: analyzedResult.explanation,
            aiSolution: solutionResult.solution, // From Solution Agent
            severity: analyzedResult.severity || 'Medium',
            suggestedCodeFix: solutionResult.suggestedCodeFix // From Solution Agent
        });

        // 8. Update session status to 'analyzed'
        await DebugSession.updateStatus(newSession.id, 'analyzed');

        // 9. Send success response to client
        res.status(200).json({
            sessionId: newSession.id,
            analysis: {
                ...analyzedResult,
                ...solutionResult, // Combine results from different agents
                modelUsed: "gemini-pro (multi-agent)" 
            },
            message: 'Debug request processed and analyzed successfully using multi-agent workflow.'
        });

    } catch (err) {
        console.error("Error in analyzeDebugRequest (Multi-Agent):", err);
        // Update session status to 'failed' if an error occurs
        if (newSession && newSession.id) {
            await DebugSession.updateStatus(newSession.id, 'failed').catch(logErr => console.error("Failed to update session status to failed:", logErr));
        }
        return next(new HttpError(err.message || 'Failed to process debug request with multi-agent system.', 500));
    }
};

/**
 * Fetches all debug sessions for the authenticated user.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The Express next middleware function.
 */
const getDebugSessions = async (req, res, next) => {
    const userId = req.userData.userId; // userId from authentication middleware
    try {
        const sessions = await DebugSession.findByUserId(userId);
        res.status(200).json({ sessions });
    } catch (err) {
        console.error("Error fetching debug sessions:", err);
        return next(new HttpError('Failed to fetch debug sessions.', 500));
    }
};

/**
 * Fetches detailed information for a specific debug session.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The Express next middleware function.
 */
const getDebugSessionDetails = async (req, res, next) => {
    const { sessionId } = req.params;
    const userId = req.userData.userId; // userId from authentication middleware

    try {
        const session = await DebugSession.findById(sessionId);

        // Check if session exists and belongs to the authenticated user
        if (!session || session.user_id !== userId) {
            return next(new HttpError('Session not found or unauthorized.', 404));
        }

        // Fetch related data for the session
        const codeSnippets = await CodeSnippet.findBySessionId(sessionId);
        const analyzedErrors = await AnalyzedError.findBySessionId(sessionId);
        const attachments = await Attachment.findBySessionId(sessionId);

        res.status(200).json({
            session,
            codeSnippets,
            analyzedErrors,
            attachments
        });
    } catch (err) {
        console.error("Error fetching debug session details:", err);
        return next(new HttpError('Failed to fetch debug session details.', 500));
    }
};

module.exports = {
    analyzeDebugRequest,
    getDebugSessions,
    getDebugSessionDetails,
};