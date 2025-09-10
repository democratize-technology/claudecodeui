/**
 * PATH TRAVERSAL SECURITY TESTS
 * ==============================
 *
 * Comprehensive tests to verify that path traversal vulnerabilities
 * are properly blocked by the security fixes.
 *
 * Tests all known attack vectors:
 * - Basic path traversal (../)
 * - URL encoding attacks
 * - Windows-style attacks
 * - Null byte injection
 * - Double encoding
 * - Mixed encoding
 * - Symlink attacks
 */

import {
  validateAndSanitizePath,
  safeJoin,
  validateProjectName,
  safeReadFile,
  safeWriteFile,
  safeFileExists
} from '../../../server/utils/path-security.js';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

describe('Path Traversal Security Tests', () => {
  describe('validateAndSanitizePath', () => {
    test('should block basic path traversal attacks', () => {
      const maliciousPaths = [
        '../etc/passwd',
        '../../etc/passwd',
        '../../../etc/passwd',
        '..\\..\\etc\\passwd',
        './../../etc/passwd',
        './../etc/passwd'
      ];

      maliciousPaths.forEach((maliciousPath) => {
        expect(() => {
          validateAndSanitizePath(maliciousPath);
        }).toThrow(/suspicious pattern|outside of allowed/);
      });
    });

    test('should block URL-encoded path traversal attacks', () => {
      const encodedAttacks = [
        '%2e%2e%2f', // ../
        '%2e%2e/', // ../
        '..%2f', // ../
        '%2e%2e%5c', // ..\
        '%252e%252e%252f', // Double encoded ../
        '%c0%ae%c0%ae%c0%af', // UTF-8 overlong encoding
        '%2e%2e%2fetc%2fpasswd', // ../etc/passwd
        'test%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd' // test/../../../etc/passwd
      ];

      encodedAttacks.forEach((encoded) => {
        expect(() => {
          validateAndSanitizePath(encoded);
        }).toThrow(/suspicious pattern|invalid URL encoding|outside of allowed/);
      });
    });

    test('should block Windows-style path traversal attacks', () => {
      const windowsAttacks = [
        '..\\..\\..\\windows\\system32\\config\\sam',
        '..\\etc\\passwd',
        '..\\..\\..\\boot.ini',
        'C:\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '..\\..\\.\\autoexec.bat'
      ];

      windowsAttacks.forEach((windowsPath) => {
        expect(() => {
          validateAndSanitizePath(windowsPath);
        }).toThrow(/suspicious pattern|outside of allowed/);
      });
    });

    test('should block null byte injection attacks', () => {
      const nullByteAttacks = [
        '/etc/passwd\x00.txt',
        '../etc/passwd\x00',
        'test\x00/../etc/passwd',
        '/home/user/\x00/../etc/passwd'
      ];

      nullByteAttacks.forEach((nullBytePath) => {
        expect(() => {
          validateAndSanitizePath(nullBytePath);
        }).toThrow(/suspicious pattern/);
      });
    });

    test('should block mixed encoding attacks', () => {
      const mixedAttacks = [
        '../%2e%2e%2f', // Mixed normal and encoded
        '%2e%2e/../', // Mixed encoded and normal
        '..%2f%2e%2e%2f', // Mixed separators
        '.%2e/.%2e/passwd', // Hidden double dots
        '%2e%2e%2f%2e%2e%2f%2e%2e%2f' // Triple encoded traversal
      ];

      mixedAttacks.forEach((mixedPath) => {
        expect(() => {
          validateAndSanitizePath(mixedPath);
        }).toThrow(/suspicious pattern|outside of allowed/);
      });
    });

    test('should block invalid filename characters', () => {
      const invalidChars = [
        'file<script>alert(1)</script>',
        'file>output.txt',
        'file:stream',
        'file"quote',
        'file|pipe',
        'file?query',
        'file*wild'
      ];

      invalidChars.forEach((invalidPath) => {
        expect(() => {
          validateAndSanitizePath(invalidPath);
        }).toThrow(/suspicious pattern/);
      });
    });

    test('should accept valid absolute paths within allowed directories', () => {
      const validPaths = [
        path.join(os.homedir(), '.claude', 'projects', 'test'),
        path.join(os.homedir(), 'Documents', 'project'),
        path.join(os.homedir(), 'test-file.txt')
      ];

      validPaths.forEach((validPath) => {
        expect(() => {
          const result = validateAndSanitizePath(validPath);
          expect(result).toBe(path.resolve(validPath));
        }).not.toThrow();
      });
    });

    test('should reject paths outside allowed directories', () => {
      const disallowedPaths = [
        '/etc/passwd',
        '/var/log/system.log',
        '/root/.ssh/id_rsa',
        '/usr/bin/python'
      ];

      disallowedPaths.forEach((disallowedPath) => {
        expect(() => {
          validateAndSanitizePath(disallowedPath);
        }).toThrow(/outside of allowed directories|suspicious pattern/);
      });
    });
  });

  describe('safeJoin', () => {
    const baseDir = path.join(os.homedir(), 'test-project');

    test('should safely join valid relative paths', () => {
      const validJoins = [
        ['file.txt', path.join(baseDir, 'file.txt')],
        ['src/main.js', path.join(baseDir, 'src/main.js')],
        ['docs/readme.md', path.join(baseDir, 'docs/readme.md')]
      ];

      validJoins.forEach(([relativePath, expected]) => {
        const result = safeJoin(baseDir, relativePath);
        expect(result).toBe(expected);
      });
    });

    test('should block path traversal in relative paths', () => {
      const maliciousJoins = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        './../../etc/hosts',
        '../outside-project.txt'
      ];

      maliciousJoins.forEach((maliciousPath) => {
        expect(() => {
          safeJoin(baseDir, maliciousPath);
        }).toThrow(/outside of allowed directory|suspicious pattern/);
      });
    });

    test('should require absolute base directory', () => {
      expect(() => {
        safeJoin('relative-base', 'file.txt');
      }).toThrow(/must be an absolute path/);
    });
  });

  describe('validateProjectName', () => {
    test('should accept valid project names', () => {
      const validNames = ['my-project', 'project_123', 'Project.Name', 'a', 'test-project-2024'];

      validNames.forEach((name) => {
        expect(() => {
          const result = validateProjectName(name);
          expect(result).toBe(name);
        }).not.toThrow();
      });
    });

    test('should block dangerous characters in project names', () => {
      const dangerousNames = [
        '../evil-project',
        'project/with/slashes',
        'project\\with\\backslashes',
        'project<script>',
        'project>file.txt',
        'project:stream',
        'project"quote',
        'project|pipe',
        'project?query',
        'project*wild',
        'project\x00null'
      ];

      dangerousNames.forEach((name) => {
        expect(() => {
          validateProjectName(name);
        }).toThrow(/contains invalid characters/);
      });
    });

    test('should block reserved Windows names', () => {
      const reservedNames = [
        'con',
        'prn',
        'aux',
        'nul',
        'com1',
        'lpt1',
        'CON', // Case insensitive
        'PRN'
      ];

      reservedNames.forEach((name) => {
        expect(() => {
          validateProjectName(name);
        }).toThrow(/is reserved/);
      });
    });

    test('should block empty or too long project names', () => {
      expect(() => {
        validateProjectName('');
      }).toThrow(/must be a non-empty string/);

      expect(() => {
        validateProjectName('x'.repeat(256));
      }).toThrow(/too long/);
    });
  });

  describe('Integration Tests with File System', () => {
    let tempDir;

    beforeAll(async () => {
      tempDir = path.join(os.tmpdir(), `path-security-test-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      // Create test files
      await fs.writeFile(path.join(tempDir, 'test-file.txt'), 'test content');
      await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'subdir', 'nested.txt'), 'nested content');
    });

    afterAll(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('safeReadFile should read valid files', async () => {
      const filePath = path.join(tempDir, 'test-file.txt');
      const content = await safeReadFile(filePath, tempDir);
      expect(content).toBe('test content');
    });

    test('safeReadFile should block path traversal attempts', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config',
        path.join(tempDir, '../../../etc/passwd')
      ];

      for (const attempt of traversalAttempts) {
        await expect(async () => {
          await safeReadFile(attempt, tempDir);
        }).rejects.toThrow(/suspicious pattern|outside of allowed|Security violation/);
      }
    });

    test('safeFileExists should work for valid paths', async () => {
      const validPath = path.join(tempDir, 'test-file.txt');
      const exists = await safeFileExists(validPath, tempDir);
      expect(exists).toBe(true);

      const nonexistentPath = path.join(tempDir, 'nonexistent.txt');
      const notExists = await safeFileExists(nonexistentPath, tempDir);
      expect(notExists).toBe(false);
    });

    test('safeWriteFile should write to valid paths', async () => {
      const filePath = path.join(tempDir, 'write-test.txt');
      await safeWriteFile(filePath, 'write test content', tempDir);

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('write test content');
    });

    test('safeWriteFile should block path traversal attempts', async () => {
      const traversalAttempts = ['../../../tmp/evil.txt', '..\\..\\tmp\\evil.txt'];

      for (const attempt of traversalAttempts) {
        await expect(async () => {
          await safeWriteFile(attempt, 'evil content', tempDir);
        }).rejects.toThrow(/suspicious pattern|outside of allowed|Security violation/);
      }
    });
  });

  describe('Edge Cases and Advanced Attacks', () => {
    test('should handle Unicode normalization attacks', () => {
      const unicodeAttacks = [
        'test\u002e\u002e\u002fpasswd', // Unicode dots and slash
        'test\uFF0E\uFF0E\uFF0Fpasswd', // Fullwidth characters
        'test\u2024\u2024\u2215passwd' // Alternative dots and division slash
      ];

      unicodeAttacks.forEach((attack) => {
        expect(() => {
          validateAndSanitizePath(attack);
        }).toThrow(/suspicious pattern|outside of allowed/);
      });
    });

    test('should handle case sensitivity variations', () => {
      const caseVariations = [
        '../Etc/Passwd',
        '../ETC/PASSWD',
        '..\\Windows\\System32',
        '..\\WINDOWS\\system32'
      ];

      caseVariations.forEach((variation) => {
        expect(() => {
          validateAndSanitizePath(variation);
        }).toThrow(/suspicious pattern|outside of allowed/);
      });
    });

    test('should handle multiple consecutive separators', () => {
      const multipleSeparators = [
        '../../../etc//passwd',
        '..\\..\\..\\windows\\\\system32',
        '..////etc/passwd',
        '..\\\\\\\\windows'
      ];

      multipleSeparators.forEach((attack) => {
        expect(() => {
          validateAndSanitizePath(attack);
        }).toThrow(/suspicious pattern|outside of allowed/);
      });
    });

    test('should reject empty, null, or non-string inputs', () => {
      const invalidInputs = [null, undefined, '', 42, [], {}, true];

      invalidInputs.forEach((input) => {
        expect(() => {
          validateAndSanitizePath(input);
        }).toThrow(/must be a non-empty string|Invalid path/);
      });
    });
  });
});
