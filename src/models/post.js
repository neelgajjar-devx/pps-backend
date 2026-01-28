import pool from '../config/database.js';

/**
 * Check if a post exists by source_id
 * @param {string} sourceId - Source ID to check
 * @returns {Promise<boolean>}
 */
export async function postExists(sourceId) {
  const result = await pool.query(
    'SELECT id FROM posts WHERE source_id = $1',
    [sourceId]
  );
  return result.rows.length > 0;
}

/**
 * Insert a new post into the database
 * @param {Object} postData - Post data object
 * @returns {Promise<Object>} Inserted post
 */
export async function insertPost(postData) {
  const {
    source,
    source_id,
    title,
    content,
    url,
    author,
    published_at,
    embedding,      // OpenAI ada-002 (1536 dimensions) - optional
    embedding_v2,   // Ollama embeddinggemma (768 dimensions) - optional
    metadata,
    is_interesting
  } = postData;

  // Format embeddings for pgvector: convert array to string format '[1,2,3,...]'
  let embeddingValue = null;
  if (embedding && Array.isArray(embedding)) {
    embeddingValue = '[' + embedding.join(',') + ']';
  }

  let embeddingV2Value = null;
  if (embedding_v2 && Array.isArray(embedding_v2)) {
    embeddingV2Value = '[' + embedding_v2.join(',') + ']';
  }

  const result = await pool.query(
    `INSERT INTO posts (
      source, source_id, title, content, url, author, 
      published_at, embedding, embedding_v2, metadata, is_interesting
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::vector, $10, $11)
    RETURNING *`,
    [
      source,
      source_id,
      title,
      content,
      url,
      author,
      published_at,
      embeddingValue,
      embeddingV2Value,
      metadata ? JSON.stringify(metadata) : null,
      is_interesting
    ]
  );

  return result.rows[0];
}

/**
 * Update post's is_interesting field
 * @param {number} postId - Post ID
 * @param {boolean|null} isInteresting - Classification result
 * @param {Object} classificationData - Additional classification data
 * @returns {Promise<Object>} Updated post
 */
export async function updatePostClassification(postId, isInteresting, classificationData = {}) {
  const metadata = classificationData.reasoning || classificationData.content_pillar || classificationData.policy_anchor
    ? { ...classificationData }
    : null;

  const result = await pool.query(
    `UPDATE posts 
     SET is_interesting = $1, 
         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [
      isInteresting,
      metadata ? JSON.stringify(metadata) : '{}',
      postId
    ]
  );

  return result.rows[0];
}

/**
 * Get posts with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array<Object>>}
 */
export async function getPosts(filters = {}) {
  const {
    is_interesting,
    source,
    limit = 50,
    offset = 0,
    search
  } = filters;

  let query = 'SELECT * FROM posts WHERE 1=1';
  const params = [];
  let paramCount = 0;

  if (is_interesting !== undefined && is_interesting !== null) {
    paramCount++;
    query += ` AND is_interesting = $${paramCount}`;
    params.push(is_interesting);
  }

  if (source) {
    paramCount++;
    query += ` AND source = $${paramCount}`;
    params.push(source);
  }

  // Semantic search using vector similarity
  if (search) {
    // This would require generating an embedding for the search query
    // For now, we'll do a simple text search
    paramCount++;
    query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY published_at DESC, created_at DESC';
  
  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get a single post by ID
 * @param {number} postId - Post ID
 * @returns {Promise<Object|null>} Post object or null if not found
 */
export async function getPostById(postId) {
  const result = await pool.query(
    'SELECT * FROM posts WHERE id = $1',
    [postId]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get post count with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<number>}
 */
export async function getPostCount(filters = {}) {
  const { is_interesting, source, search } = filters;

  let query = 'SELECT COUNT(*) FROM posts WHERE 1=1';
  const params = [];
  let paramCount = 0;

  if (is_interesting !== undefined && is_interesting !== null) {
    paramCount++;
    query += ` AND is_interesting = $${paramCount}`;
    params.push(is_interesting);
  }

  if (source) {
    paramCount++;
    query += ` AND source = $${paramCount}`;
    params.push(source);
  }

  if (search) {
    paramCount++;
    query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count);
}
