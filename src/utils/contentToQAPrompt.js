/**
 * Prompt for converting raw article/post content into a public-facing Q&A / tabular explainer format.
 * Used by the content transformer service before storing posts in the database.
 */
export const CONTENT_TO_QA_PROMPT = `Task:
I have a block of information or article content. Convert it into a clear, public-facing Q&A explainer that can be published directly.

Goal

The output should be easy to understand for a layperson with no prior background.
It should read like a finished explainer, not draft notes or research material.

Question Style

Questions should reflect real audience doubts — simple, curious, and natural.
Avoid academic, robotic, or overly formal phrasing.
Questions should follow a logical progression, where each builds on the previous one and provides context for what comes next.

Answer Style

Use plain, everyday language.
Explain concepts step by step, assuming the reader is intelligent but non-technical.
Avoid jargon wherever possible. If unavoidable, explain it immediately using a simple real-world example.
Maintain a conversational and human tone.
Make the content data-rich: clearly surface numbers, dates, comparisons, and concrete facts.
Use:
Tables where comparisons, timelines, benefits, costs, or statistics are easier to scan.
Short lists for conditions, impacts, eligibility, or options.
Use paragraphs for explanations and context. Mix formats intelligently to maximize clarity.

Structure

Do not force a rigid template.
Follow a natural learning flow, typically moving from:
What it is
How it works
Who it affects
What has changed
Risks or implications
What happens next
Group related questions into clearly labeled sections.
Section headers should be specific and meaningful.
The flow should feel progressive and intuitive, without abrupt jumps.

Completeness

Do not omit any details from the source content.
Every number, date, example, claim, and insight must be reflected somewhere in the Q&A.
Clearly label information that is reported, interpreted, or not officially confirmed.

Sources

At the end of each answer, include source links exactly as provided.
If multiple sources apply, list all of them.
For PDF sources, include the page number along with the link.
Sources must directly support the claims made in the answer.

Output Expectation

The final output must be a fully finished, publishable Q&A explainer.
It should feel written for real people, not researchers or internal stakeholders.
A first-time reader should understand the topic without external references.
The Q&A should flow smoothly from start to finish, with no gaps in understanding.
Every question and answer should feel intentional, complete, and necessary.

---

Source article title: {title}

Source URL: {url}

---

Raw article content to convert:

{content}

---

Convert the above content into the Q&A explainer format. Output only the finished Q&A explainer (no preamble or meta-commentary).`;

/**
 * Format the Q&A conversion prompt with article data.
 * @param {Object} article - { title, content, url }
 * @returns {string}
 */
export function formatContentToQAPrompt(article) {
  const title = article.title || 'Untitled';
  const url = article.url || '';
  const content = (article.content || '').trim();
  if (!content) {
    throw new Error('Article content is empty; cannot convert to Q&A.');
  }
  return CONTENT_TO_QA_PROMPT
    .replace(/{title}/g, title)
    .replace(/{url}/g, url)
    .replace(/{content}/g, content);
}
