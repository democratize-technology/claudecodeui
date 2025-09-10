/**
 * PATH SECURITY UTILITIES
 * =======================
 * 
 * Critical security functions to prevent path traversal attacks and ensure
 * file operations are confined to authorized directories.
 * 
 * SECURITY PRINCIPLES:
 * 1. Whitelist allowed paths rather than blacklist dangerous ones
 * 2. Always resolve paths to canonical form before validation
 * 3. Check final resolved path against allowed boundaries
 * 4. Never trust user input - validate everything
 * 5. Fail secure - deny by default
 */

import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

// Define allowed base directories for file operations
const ALLOWED_BASE_DIRECTORIES = [
    // User's home directory for Claude/Cursor projects
    os.homedir(),
    // Temp directories for uploads (must be within user's temp space)
    path.join(os.tmpdir(), 'claude-ui-uploads')
];

/**
 * Validates and sanitizes a file path to prevent path traversal attacks
 * 
 * @param {string} inputPath - The user-provided path to validate
 * @param {string} expectedBaseDir - The expected base directory for the operation
 * @returns {string} - The validated, canonical absolute path
 * @throws {Error} - If the path is invalid or attempts traversal
 */
export function validateAndSanitizePath(inputPath, expectedBaseDir = null) {
    if (!inputPath || typeof inputPath !== 'string') {
        throw new Error('Invalid path: path must be a non-empty string');
    }

    // Decode any URL encoding that might hide path traversal attempts
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(inputPath);
    } catch (error) {
        throw new Error('Invalid path: contains invalid URL encoding');
    }

    // Check for suspicious patterns that indicate path traversal attempts
    const suspiciousPatterns = [
        /\.\./,           // Parent directory references
        /\/\.\./,         // Unix path traversal
        /\\\.\./,         // Windows path traversal  
        /%2e%2e/i,        // URL-encoded dots
        /%2f/i,           // URL-encoded forward slash
        /%5c/i,           // URL-encoded backslash
        /\0/,             // Null bytes
        /[<>:"|?*]/       // Invalid filename characters
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(decodedPath)) {
            throw new Error(`Invalid path: contains suspicious pattern (${pattern.source})`);
        }
    }

    // Resolve to canonical absolute path
    let resolvedPath;
    try {
        resolvedPath = path.resolve(decodedPath);
    } catch (error) {
        throw new Error(`Invalid path: failed to resolve (${error.message})`);
    }

    // If expectedBaseDir is provided, ensure the path is within it
    if (expectedBaseDir) {
        const canonicalBaseDir = path.resolve(expectedBaseDir);
        if (!resolvedPath.startsWith(canonicalBaseDir + path.sep) && resolvedPath !== canonicalBaseDir) {
            throw new Error(`Invalid path: outside of allowed directory (${canonicalBaseDir})`);
        }
    } else {
        // Check against global allowed directories
        const isAllowed = ALLOWED_BASE_DIRECTORIES.some(baseDir => {
            const canonicalBaseDir = path.resolve(baseDir);
            return resolvedPath.startsWith(canonicalBaseDir + path.sep) || resolvedPath === canonicalBaseDir;
        });

        if (!isAllowed) {
            throw new Error('Invalid path: outside of allowed directories');
        }
    }

    return resolvedPath;
}

/**
 * Safely constructs a file path within a base directory
 * 
 * @param {string} baseDir - The base directory (must be absolute)
 * @param {string} relativePath - The relative path to append
 * @returns {string} - The validated absolute path
 * @throws {Error} - If the resulting path would escape the base directory
 */
export function safeJoin(baseDir, relativePath) {
    if (!baseDir || !path.isAbsolute(baseDir)) {
        throw new Error('Base directory must be an absolute path');
    }

    if (!relativePath || typeof relativePath !== 'string') {
        throw new Error('Relative path must be a non-empty string');
    }

    // Construct the path
    const joinedPath = path.join(baseDir, relativePath);
    
    // Validate it stays within the base directory
    return validateAndSanitizePath(joinedPath, baseDir);
}

/**
 * Validates that a project name is safe to use in file operations
 * 
 * @param {string} projectName - The project name to validate
 * @returns {string} - The validated project name
 * @throws {Error} - If the project name is invalid
 */
export function validateProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
        throw new Error('Project name must be a non-empty string');
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\0\/\\]/;
    if (dangerousChars.test(projectName)) {
        throw new Error('Project name contains invalid characters');
    }

    // Check length limits
    if (projectName.length > 255) {
        throw new Error('Project name too long (max 255 characters)');
    }

    // Check for reserved names
    const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
    if (reservedNames.includes(projectName.toLowerCase())) {
        throw new Error('Project name is reserved');
    }

    return projectName;
}

/**
 * Gets the allowed base directory for Claude projects
 * 
 * @returns {string} - The absolute path to Claude projects directory
 */
export function getClaudeProjectsDir() {
    return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * Gets the allowed base directory for Cursor projects  
 * 
 * @returns {string} - The absolute path to Cursor chats directory
 */
export function getCursorChatsDir() {
    return path.join(os.homedir(), '.cursor', 'chats');
}

/**
 * Validates and constructs a safe project directory path
 * 
 * @param {string} projectName - The project name
 * @param {string} provider - The provider ('claude' or 'cursor')
 * @returns {string} - The validated project directory path
 * @throws {Error} - If validation fails
 */
export function getProjectDir(projectName, provider = 'claude') {
    const validatedProjectName = validateProjectName(projectName);
    
    let baseDir;
    switch (provider) {
        case 'claude':
            baseDir = getClaudeProjectsDir();
            break;
        case 'cursor':
            baseDir = getCursorChatsDir();
            break;
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }

    return safeJoin(baseDir, validatedProjectName);
}

/**
 * Checks if a file exists and is accessible within allowed directories
 * 
 * @param {string} filePath - The file path to check
 * @param {string} expectedBaseDir - Optional expected base directory
 * @returns {Promise<boolean>} - True if file exists and is accessible
 */
export async function safeFileExists(filePath, expectedBaseDir = null) {
    try {
        const validatedPath = validateAndSanitizePath(filePath, expectedBaseDir);
        await fs.access(validatedPath);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Safely reads a file with path validation
 * 
 * @param {string} filePath - The file path to read
 * @param {string} expectedBaseDir - Optional expected base directory  
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<string>} - The file contents
 * @throws {Error} - If validation fails or file cannot be read
 */
export async function safeReadFile(filePath, expectedBaseDir = null, encoding = 'utf8') {
    const validatedPath = validateAndSanitizePath(filePath, expectedBaseDir);
    return await fs.readFile(validatedPath, encoding);
}

/**
 * Safely writes a file with path validation
 * 
 * @param {string} filePath - The file path to write
 * @param {string} content - The content to write
 * @param {string} expectedBaseDir - Optional expected base directory
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<void>}
 * @throws {Error} - If validation fails or file cannot be written
 */
export async function safeWriteFile(filePath, content, expectedBaseDir = null, encoding = 'utf8') {
    const validatedPath = validateAndSanitizePath(filePath, expectedBaseDir);
    return await fs.writeFile(validatedPath, content, encoding);
}

/**
 * Safely creates a directory with path validation
 * 
 * @param {string} dirPath - The directory path to create
 * @param {string} expectedBaseDir - Optional expected base directory
 * @param {object} options - Options for mkdir (default: { recursive: true })
 * @returns {Promise<void>}
 * @throws {Error} - If validation fails or directory cannot be created
 */
export async function safeMkdir(dirPath, expectedBaseDir = null, options = { recursive: true }) {
    const validatedPath = validateAndSanitizePath(dirPath, expectedBaseDir);
    return await fs.mkdir(validatedPath, options);
}