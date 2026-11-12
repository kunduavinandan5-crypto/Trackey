/**
 * Spendly AI Chat Serverless Entrypoint (Vercel Serverless Function).
 * Delegates to the dedicated AI service module in api/ai/.
 */
export { GET, POST } from './ai/service.js';
