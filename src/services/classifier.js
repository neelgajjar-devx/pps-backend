// NOTE: OpenAI-based classifier implementation is commented out because
// the OpenAI API quota has been exceeded for this project.
// import openai, { LLM_MODEL } from '../config/llm.js';
import ollama from 'ollama';
import { formatClassificationPrompt } from '../utils/promptRefiner.js';

// ---------------------------------------------------------------------------
// OpenAI classifier implementation (deprecated in this project)
// ---------------------------------------------------------------------------
/*
export async function classifyArticle(article) {
  try {
    const prompt = formatClassificationPrompt(article);

    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a content classifier for any news articles. Always respond with valid JSON only, no additional text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from LLM');
    }

    // Parse JSON response
    let classificationResult;
    try {
      classificationResult = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from response if it's wrapped in markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classificationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse LLM response as JSON');
      }
    }

    return {
      is_interesting: classificationResult.is_interesting === true || classificationResult.is_interesting === 'true',
      reasoning: classificationResult.reasoning || null,
      content_pillar: classificationResult.content_pillar || null,
      policy_anchor: classificationResult.policy_anchor || null
    };
  } catch (error) {
    console.error('Error classifying article:', error.message);
    // Return null to indicate classification failed
    return {
      is_interesting: null,
      reasoning: `Classification failed: ${error.message}`,
      content_pillar: null,
      policy_anchor: null
    };
  }
}
*/

// ---------------------------------------------------------------------------
// Ollama-based classifier implementation (current)
// Uses local Ollama with the "gemma3" model by default.
// ---------------------------------------------------------------------------

/**
 * Classify an article as interesting or not using Ollama (gemma3)
 * @param {Object} article - Article object with title, content, url
 * @returns {Promise<{is_interesting: boolean|null, reasoning: string|null, content_pillar: string|null, policy_anchor: string|null}>}
 */
export async function classifyArticle(article) {
  try {
    const prompt = formatClassificationPrompt(article);

    const model = process.env.LLM_MODEL || 'gemma3';

    const response = await ollama.chat({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a content classifier for public policy-related news articles. Always respond with valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      // Ask Ollama to format the response as JSON
      format: 'json',
    });

    const content = response?.message?.content;
    if (!content) {
      throw new Error('No response content from Ollama');
    }

    // Parse JSON response
    let classificationResult;
    try {
      classificationResult = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from response if it's wrapped in markdown or text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classificationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Ollama response as JSON');
      }
    }

    return {
      is_interesting: classificationResult.is_interesting === true || classificationResult.is_interesting === 'true',
      reasoning: classificationResult.reasoning || null,
      content_pillar: classificationResult.content_pillar || null,
      policy_anchor: classificationResult.policy_anchor || null,
    };
  } catch (error) {
    console.error('Error classifying article with Ollama:', error.message);
    // Return null to indicate classification failed
    return {
      is_interesting: null,
      reasoning: `Classification failed: ${error.message}`,
      content_pillar: null,
      policy_anchor: null,
    };
  }
}

/**
 * Classify multiple articles in batch
 * @param {Array<Object>} articles - Array of article objects
 * @returns {Promise<Array<Object>>} Array of classification results
 */
export async function classifyArticlesBatch(articles) {
  const results = [];
  
  for (const article of articles) {
    try {
      const classification = await classifyArticle(article);
      results.push({
        ...article,
        classification
      });
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error classifying article ${article.title}:`, error.message);
      results.push({
        ...article,
        classification: {
          is_interesting: null,
          reasoning: `Classification failed: ${error.message}`,
          content_pillar: null,
          policy_anchor: null
        }
      });
    }
  }
  
  return results;
}
