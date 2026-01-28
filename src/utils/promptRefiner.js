/**
 * Refined classification prompt for LLM
 * Focuses on binary classification (interesting/not interesting) for public policy content
 */
export const CLASSIFICATION_PROMPT = `You are an expert content classifier specializing in public policy and government-related news.

Your task is to evaluate news articles and determine if they are INTERESTING for creating short-form, public-facing explainer content about public policy.

## Classification Criteria

An article is INTERESTING if it meets ALL of the following conditions:

1. **Public Policy Relevance**: The article discusses government policies, schemes, tools, regulations, laws, or governance decisions that affect citizens.

2. **Maps to Content Pillars**: The content must clearly relate to at least one of these pillars:
   - SCHEMES: Government programs with defined eligibility and benefits
   - TOOLS: Government apps, portals, or systems for citizen access
   - CURRENT AFFAIRS IN INDIA: Time-bound developments affecting everyday life
   - INDIA AND THE WORLD: International agreements, diplomacy, trade affecting India
   - RULES, ACTS, BILLS: Legal instruments creating or changing rights/duties
   - CASE STUDIES: Real-world examples of policy implementation

3. **Real-World Impact**: The article has consequences for at least one of:
   - Money (financial impact)
   - Eligibility (who qualifies)
   - Rights (legal rights)
   - Penalties (compliance requirements)
   - Access to services
   - Compliance or responsibility

4. **Source Credibility**: The article cites or references:
   - Government notifications, gazette releases, ministry websites (highest weight)
   - Reputed national media citing official documents (medium weight)
   - Avoid: Opinion columns, speculation, or unnamed sources (lowest weight)

5. **Clarity Potential**: The article can be explained in simple language for a 30-60 second explainer that resolves confusion or clarifies policy impact.

## What to AVOID

An article is NOT INTERESTING if it:
- Is purely political commentary or opinion without policy substance
- Focuses on personality-driven stories without policy impact
- Contains only speculation without official backing
- Uses outrage framing without clear policy implications
- Lacks connection to government action or citizen impact

## Output Format

Respond with ONLY a JSON object in this exact format:
{
  "is_interesting": true or false,
  "reasoning": "Brief explanation (1-2 sentences) of why this classification was made",
  "content_pillar": "The primary pillar this maps to (if interesting), or null",
  "policy_anchor": "The specific scheme/rule/law/tool mentioned (if applicable), or null"
}

## Article to Classify

Title: {title}

Content: {content}

URL: {url}

Now classify this article:`;

/**
 * Formats the classification prompt with article data
 * @param {Object} article - Article object with title, content, url
 * @returns {string} Formatted prompt
 */
export function formatClassificationPrompt(article) {
  return CLASSIFICATION_PROMPT
    .replace('{title}', article.title || 'N/A')
    .replace('{content}', (article.content || '').substring(0, 3000)) // Limit content length
    .replace('{url}', article.url || 'N/A');
}
