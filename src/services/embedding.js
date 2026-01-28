// NOTE: OpenAI-based embedding implementation is commented out because
// the OpenAI API quota has been exceeded for this project.
// import openai, { EMBEDDING_MODEL } from '../config/llm.js';
import ollama from 'ollama';

// ---------------------------------------------------------------------------
// OpenAI embedding implementation (deprecated in this project)
// ---------------------------------------------------------------------------
/*
export async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Truncate text if too long (OpenAI has token limits)
    const maxLength = 8000; // Approximate token limit for ada-002
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}
*/

// ---------------------------------------------------------------------------
// Ollama-based embedding implementation (current)
// Uses local Ollama with the "embeddinggemma" model by default.
// ---------------------------------------------------------------------------

/**
 * Generate embedding vector for article content using Ollama
 * @param {string} text - Text to generate embedding for (title + content)
 * @returns {Promise<Array<number>>} Embedding vector
 */
export async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Truncate text if too long (just to be safe)
    const maxLength = 8000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    const model = process.env.EMBEDDING_MODEL || 'embeddinggemma';

    const response = await ollama.embed({
      model,
      input: truncatedText,
    });

    // ollama.embed returns { embeddings: number[][], ... }
    if (!response || !Array.isArray(response.embeddings) || response.embeddings.length === 0) {
      throw new Error('No embedding data returned from Ollama');
    }

    return response.embeddings[0];
  } catch (error) {
    console.error('Error generating embedding with Ollama:', error.message);
    throw error;
  }
}

/**
 * Generate embedding for a post (combines title and content)
 * @param {Object} post - Post object with title and content
 * @returns {Promise<Array<number>>} Embedding vector
 */
export async function generatePostEmbedding(post) {
  const combinedText = `${post.title}\n\n${post.content}`;
  return generateEmbedding(combinedText);
}
