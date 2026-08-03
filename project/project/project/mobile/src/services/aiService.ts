import { aiService, isAIAvailable } from '@lib/ai';

// Re-export the AI service stub so screens import from a single entry point.
// When the real shared AI service is built, only this file needs to change.
export { aiService, isAIAvailable };
