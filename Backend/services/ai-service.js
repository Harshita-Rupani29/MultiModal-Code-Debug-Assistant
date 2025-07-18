// services/ai-service.js
require('dotenv').config();
const fs = require('fs/promises'); 

// --- LLM Client (Google AI Studio / Gemini API) - PRIMARY ---
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

// --- OCR Client (Tesseract.js) 
const Tesseract = require('tesseract.js'); 

function parseGeminiJson(text) {
    let jsonText = text.trim();

    const jsonBlockMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
        jsonText = jsonBlockMatch[1].trim();
    } else {
        
        const bareJsonMatch = jsonText.match(/(\{[\s\S]*\})/);
        if (bareJsonMatch && bareJsonMatch[1]) {
            jsonText = bareJsonMatch[1].trim();
        } else {
        
            throw new Error("Response is not valid JSON or could not be extracted from markdown or bare object. Raw text: " + text.substring(0, 500) + "..."); 
        }
    }

    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse extracted JSON (JSON.parse error):", e);
        console.error("Attempted to parse this JSON string:", jsonText.substring(0, 500) + "..."); 
        throw new Error(`Failed to parse extracted JSON: ${e.message}. Raw AI response (full or snippet): ${text.substring(0, 500)}...`);
    }
}


// --- Core AI Logic for Code Analysis and Suggestions (Unified for Agents) ---
async function callGeminiForAnalysis(prompt, modelName = "gemini-1.5-flash") {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
        throw new Error("GOOGLE_GEMINI_API_KEY is not set in .env. Cannot use Gemini API.");
    }

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json', 
            },
        });

        
        const responseData = await result.response.text();
        return parseGeminiJson(responseData);

    } catch (error) {
       
        if (error.message.startsWith('Failed to parse extracted JSON')) {
            throw error; 
        }
        console.error(`Error during Google Gemini API call for ${modelName}:`, error);
        throw new Error(`Failed to get AI analysis from Gemini (${modelName}). Details: ${error.message}`);
    }
}


/**
 * Agent 1: Initial Classification/Routing
 * Classifies the type of debug request or its core issue.
 */
async function classifyDebugRequest(code, errorLogs, extractedText, language, additionalNotes) {
    const prompt = `You are an intelligent assistant for classifying debug requests. Based on the provided code, error logs, and any extracted text from screenshots, classify the primary nature of the debugging request.
    Possible categories: "Syntax Error", "Runtime Error", "Logical Error", "API Misuse", "Configuration Issue", "UI/Visual Bug", "Performance Issue", "External Dependency Issue", "Deployment Issue", "Other".
    Also, provide a brief summary of the identified problem.

    Code:\n\`\`\`${language || 'auto'}\n${code}\n\`\`\`

    Error Logs:\n\`\`\`\n${errorLogs}\n\`\`\`

    ${extractedText ? `Text extracted from screenshot: "${extractedText.substring(0, 1000)}..."\n` : ''} ${additionalNotes ? `Additional Notes: "${additionalNotes}"\n` : ''}

    Please provide your response in a structured JSON format:
    {
      "classification": "string (e.g., 'Runtime Error')",
      "summary": "string (a concise summary of the problem type)"
    }
    `;

    try {
        const result = await callGeminiForAnalysis(prompt, "gemini-1.5-flash");
        return {
            classification: result.classification || 'Other',
            summary: result.summary || 'Could not classify the request type.'
        };
    } catch (error) {
        console.error("Error in classifyDebugRequest:", error);
        return {
            classification: 'Error in Classification',
            summary: `Failed to classify debug request: ${error.message}`
        };
    }
}

/**
 * Agent 2: Error Analysis Agent
 * Analyzes the root cause of the error.
 */
async function analyzeError(code, errorLogs, context) {
    const prompt = `You are an expert code debugging assistant. Your task is to analyze the provided code and associated error logs.
    Identify the root cause of the problem, classify the error type (e.g., Syntax Error, Runtime Error, Logical Error, API Misuse, Configuration Issue), and provide a detailed explanation.
    Consider the following context:
    ${context.language ? `Programming Language: ${context.language}\n` : ''}
    ${context.extractedText ? `Text extracted from screenshot: "${context.extractedText.substring(0, 1000)}..."\n` : ''} ${context.additionalNotes ? `Additional Notes: "${context.additionalNotes}"\n` : ''}
    ${context.initialClassification ? `Initial classification from previous agent: ${context.initialClassification.classification} - ${context.initialClassification.summary}\n` : ''}

    Code:\n\`\`\`${context.language || 'auto'}\n${code}\n\`\`\`

    Error Logs:\n\`\`\`\n${errorLogs}\n\`\`\`

    Please provide your response in a structured JSON format:
    {
      "errorType": "string (e.g., 'Reference Error', 'Type Error', 'Logical Bug')",
      "summary": "string (a concise summary of the problem)",
      "explanation": "string (a detailed explanation of the root cause)",
      "severity": "string (e.g., 'High', 'Medium', 'Low')"
    }
    `;

    try {
        const result = await callGeminiForAnalysis(prompt, "gemini-1.5-flash");
        return {
            errorType: result.errorType || 'Unclassified',
            summary: result.summary || 'Problem analysis unavailable.',
            explanation: result.explanation || 'No detailed explanation provided.',
            severity: result.severity || 'Medium'
        };
    } catch (error) {
        console.error("Error in analyzeError (Error Analysis Agent):", error);
        return {
            errorType: 'Analysis Failed',
            summary: 'Error during analysis.',
            explanation: `Failed to perform error analysis: ${error.message}`,
            severity: 'High'
        };
    }
}

/**
 * Agent 3: Solution Generation Agent
 * Generates a step-by-step solution and an optional code fix.
 */
async function generateSolution(code, errorLogs, analysisContext) {
    const prompt = `You are an expert code debugging solution generator. Based on the provided code, error logs, and the previous error analysis, generate a clear, step-by-step solution to fix the problem. If applicable, also provide the corrected code snippet.

    Context of the problem:
    Programming Language: ${analysisContext.language || 'N/A'}
    Error Type: ${analysisContext.errorType || 'N/A'}
    Problem Summary: ${analysisContext.summary || 'N/A'}
    Detailed Explanation: ${analysisContext.explanation || 'N/A'}
    ${analysisContext.extractedText ? `Text from screenshot: "${analysisContext.extractedText.substring(0, 1000)}..."\n` : ''} ${analysisContext.additionalNotes ? `Additional Notes: "${analysisContext.additionalNotes}"\n` : ''}

    Original Code:\n\`\`\`${analysisContext.language || 'auto'}\n${code}\n\`\`\`

    Original Error Logs:\n\`\`\`\n${errorLogs}\n\`\`\`

    Please provide your response in a structured JSON format:
    {
      "solution": "string (step-by-step instructions to fix it)",
      "suggestedCodeFix": "string (optional: the corrected code snippet, if applicable, in markdown format, e.g., \`\`\`javascript\\n// corrected code\\n\`\`\`)"
    }
    IMPORTANT: Ensure the JSON is perfectly valid. For the "solution" and "suggestedCodeFix" fields, if they contain newline characters or double quotes, ensure they are properly escaped within the JSON string (e.g., use \\n for newlines, \\" for quotes).
    `;

    try {
        const result = await callGeminiForAnalysis(prompt, "gemini-1.5-flash");
        return {
            solution: result.solution || 'No specific solution could be generated.',
            suggestedCodeFix: result.suggestedCodeFix || null
        };
    } catch (error) {
        console.error("Error in generateSolution (Solution Generation Agent):", error);
        return {
            solution: `Failed to generate a solution: ${error.message}`,
            suggestedCodeFix: null
        };
    }
}


// --- Computer Vision (OCR for Screenshots) - Using Tesseract.js ---
async function extractTextFromImage(imagePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'eng',
            { logger: m => console.log('Tesseract.js:', m.status, m.progress) } 
        );
        return text || "No text detected in the image.";
    } catch (error) {
        console.error("Error during Tesseract.js OCR:", error);
        throw new Error(`Failed to extract text from image using Tesseract.js: ${error.message}.`);
    }
}

module.exports = {
    extractTextFromImage,
    classifyDebugRequest,
    analyzeError,
    generateSolution,
};