import ollama from 'ollama';
import { formatContentToQAPrompt } from '../utils/contentToQAPrompt.js';

const DEFAULT_MODEL = process.env.OLLAMA_CONTENT_TRANSFORMER_MODEL || process.env.OLLAMA_CLASSIFIER_MODEL || 'gemma3';

/**
 * Transform raw article/post content into a public-facing Q&A / tabular explainer format using the LLM.
 * Ensures one post is fully processed before returning.
 *
 * @param {Object} post - Post object with { title, content, url }
 * @returns {Promise<string>} Transformed Q&A explainer content (to be stored in post.content)
 */
export async function transformContentToQA(post) {
  const { title, content, url } = post;

  if (!content || typeof content !== 'string') {
    throw new Error('Post content is missing or invalid.');
  }

  const prompt = formatContentToQAPrompt({ title, content, url });

  const response = await ollama.chat({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at turning complex articles and reports into clear, public-facing Q&A explainers. Output only the finished Q&A explainer. Use markdown for tables, lists, and section headers. Do not add any preamble, meta-commentary, or "Here is the converted content" style text.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: false,
  });

  const transformed = response?.message?.content?.trim();
  if (!transformed) {
    throw new Error('LLM returned empty content for Q&A transformation.');
  }

  return transformed;
}
