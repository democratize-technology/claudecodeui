import { handleError, ERROR_CATEGORIES, ERROR_SEVERITY } from '../../utils/errorHandling';

describe('handleError', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it('should log a critical error to console.error', () => {
    const error = new Error('Test Critical Error');
    handleError(error, ERROR_CATEGORIES.UNKNOWN, ERROR_SEVERITY.CRITICAL);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[UNKNOWN] CRITICAL:'),
      expect.objectContaining({
        message: 'Test Critical Error',
        category: ERROR_CATEGORIES.UNKNOWN,
        severity: ERROR_SEVERITY.CRITICAL,
      })
    );
  });

  it('should log a high severity error to console.error', () => {
    const error = new Error('Test High Error');
    handleError(error, ERROR_CATEGORIES.NETWORK, ERROR_SEVERITY.HIGH);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NETWORK] HIGH:'),
      expect.objectContaining({
        message: 'Test High Error',
        category: ERROR_CATEGORIES.NETWORK,
        severity: ERROR_SEVERITY.HIGH,
      })
    );
  });

  it('should log a medium severity error to console.warn', () => {
    const error = new Error('Test Medium Error');
    handleError(error, ERROR_CATEGORIES.COMPONENT, ERROR_SEVERITY.MEDIUM);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[COMPONENT] MEDIUM:'),
      expect.objectContaining({
        message: 'Test Medium Error',
        category: ERROR_CATEGORIES.COMPONENT,
        severity: ERROR_SEVERITY.MEDIUM,
      })
    );
  });

  it('should log a low severity error to console.debug', () => {
    const error = new Error('Test Low Error');
    handleError(error, ERROR_CATEGORIES.VALIDATION, ERROR_SEVERITY.LOW);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[VALIDATION] LOW:'),
      expect.objectContaining({
        message: 'Test Low Error',
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.LOW,
      })
    );
  });

  it('should call onUserNotify callback if provided', () => {
    const error = new Error('User Notification Test');
    const onUserNotify = jest.fn();
    const processedError = handleError(
      error,
      ERROR_CATEGORIES.NETWORK,
      ERROR_SEVERITY.HIGH,
      {},
      onUserNotify
    );
    expect(onUserNotify).toHaveBeenCalledTimes(1);
    expect(onUserNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        message: processedError.userMessage,
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORIES.NETWORK,
        canRetry: true,
      })
    );
  });

  it('should return a processed error object with correct properties', () => {
    const error = new Error('Returned Error Test');
    const context = { customData: 'value' };
    const processedError = handleError(
      error,
      ERROR_CATEGORIES.FILESYSTEM,
      ERROR_SEVERITY.MEDIUM,
      context
    );

    expect(processedError).toHaveProperty('id');
    expect(processedError.id).toMatch(/^ERR_\d{13}_[a-z0-9]{6}$/);
    expect(processedError).toHaveProperty('category', ERROR_CATEGORIES.FILESYSTEM);
    expect(processedError).toHaveProperty('severity', ERROR_SEVERITY.MEDIUM);
    expect(processedError).toHaveProperty('userMessage');
    expect(processedError).toHaveProperty('originalError', error);
    expect(processedError).toHaveProperty('context');
    expect(processedError.context).toMatchObject({
      message: 'Returned Error Test',
      category: ERROR_CATEGORIES.FILESYSTEM,
      severity: ERROR_SEVERITY.MEDIUM,
      customData: 'value',
    });
    expect(processedError).toHaveProperty('shouldRetry', true);
    expect(processedError).toHaveProperty('timestamp');
  });

  it('should handle null or undefined error objects gracefully', () => {
    const processedError = handleError(
      null,
      ERROR_CATEGORIES.UNKNOWN,
      ERROR_SEVERITY.MEDIUM
    );
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(processedError.context.message).toBe('Unknown error');
    expect(processedError.context.message).toBe('Unknown error');
  });

  it('should set shouldRetry to false for CRITICAL errors', () => {
    const error = new Error('Critical Retry Test');
    const processedError = handleError(
      error,
      ERROR_CATEGORIES.UNKNOWN,
      ERROR_SEVERITY.CRITICAL
    );
    expect(processedError.shouldRetry).toBe(false);
    expect(processedError.context.severity).toBe(ERROR_SEVERITY.CRITICAL);
  });

  it('should set canRetry to false for CRITICAL errors in onUserNotify', () => {
    const error = new Error('Critical Notify Test');
    const onUserNotify = jest.fn();
    handleError(
      error,
      ERROR_CATEGORIES.UNKNOWN,
      ERROR_SEVERITY.CRITICAL,
      {},
      onUserNotify
    );
    expect(onUserNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        canRetry: false,
      })
    );
  });
});
