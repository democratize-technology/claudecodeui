import { api } from './api';
import { handleError, withRetry, ERROR_CATEGORIES, ERROR_SEVERITY } from './errorHandling';

export async function transcribeWithWhisper(audioBlob, onStatusChange) {
  const formData = new FormData();
  const fileName = `recording_${Date.now()}.webm`;
  const file = new File([audioBlob], fileName, { type: audioBlob.type });

  formData.append('audio', file);

  const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
  formData.append('mode', whisperMode);

  // User notification callback for error handling
  const notifyUser = (errorInfo) => {
    if (onStatusChange) {
      onStatusChange(`error: ${errorInfo.message}`);
    }
  };

  const transcriptionOperation = async () => {
    // Start with transcribing state
    if (onStatusChange) {
      onStatusChange('transcribing');
    }

    try {
      const response = await api.transcribe(formData);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Create specific error for better categorization
        const transcriptionError = new Error(
          errorData.error || `Transcription failed: ${response.statusText}`
        );
        transcriptionError.status = response.status;
        transcriptionError.transcriptionFailure = true;

        // Categorize by response status
        if (response.status === 413) {
          transcriptionError.fileTooLarge = true;
        } else if (response.status === 415) {
          transcriptionError.unsupportedFormat = true;
        }

        throw transcriptionError;
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      // Handle network connectivity issues
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error(
          'Cannot connect to server. Please ensure the backend is running.'
        );
        networkError.networkFailure = true;
        throw networkError;
      }

      throw error;
    }
  };

  try {
    // Use retry logic for network failures but not for transcription failures
    return await withRetry(
      transcriptionOperation,
      3, // max retries
      2000, // delay
      ERROR_CATEGORIES.EXTERNAL_SERVICE
    );
  } catch (error) {
    let category = ERROR_CATEGORIES.EXTERNAL_SERVICE;
    let severity = ERROR_SEVERITY.HIGH;

    // Categorize errors appropriately
    if (error.networkFailure) {
      category = ERROR_CATEGORIES.NETWORK;
      severity = ERROR_SEVERITY.HIGH;
    } else if (error.fileTooLarge) {
      category = ERROR_CATEGORIES.VALIDATION;
      severity = ERROR_SEVERITY.MEDIUM;
    } else if (error.unsupportedFormat) {
      category = ERROR_CATEGORIES.VALIDATION;
      severity = ERROR_SEVERITY.MEDIUM;
    } else if (error.transcriptionFailure) {
      severity = ERROR_SEVERITY.HIGH;
    }

    // Process error with standardized handling
    const processedError = handleError(
      error,
      category,
      severity,
      {
        operation: 'audio transcription',
        fileSize: audioBlob?.size,
        fileType: audioBlob?.type,
        whisperMode,
        fileName
      },
      notifyUser
    );

    // Re-throw with user-friendly message
    const userError = new Error(processedError.userMessage);
    userError.originalError = error;
    userError.processedInfo = processedError;
    throw userError;
  }
}
