import express from 'express';
import { getPosts, getPostCount, getPostById, updatePostClassification } from '../models/post.js';

const router = express.Router();

/**
 * GET /api/posts
 * Fetch posts with optional filters
 * 
 * Query parameters:
 * - is_interesting: boolean (filter by classification)
 * - source: string (filter by source)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - search: string (text search in title/content)
 */
router.get('/', async (req, res) => {
  try {
    const {
      is_interesting,
      source,
      limit = 200,
      offset = 0,
      search
    } = req.query;

    // Parse is_interesting as boolean
    let isInterestingFilter = undefined;
    if (is_interesting !== undefined) {
      if (is_interesting === 'true') {
        isInterestingFilter = true;
      } else if (is_interesting === 'false') {
        isInterestingFilter = false;
      } else if (is_interesting === 'null' || is_interesting === '') {
        isInterestingFilter = null;
      }
    }

    // Parse limit and offset as integers
    const limitInt = parseInt(limit) || 50;
    const offsetInt = parseInt(offset) || 0;

    // Build filters object
    const filters = {
      is_interesting: isInterestingFilter,
      source: source || undefined,
      limit: limitInt,
      offset: offsetInt,
      search: search || undefined
    };

    // Fetch posts and count
    const [posts, totalCount] = await Promise.all([
      getPosts(filters),
      getPostCount(filters)
    ]);

    // Parse JSON fields from database
    // Note: pgvector returns embedding as a string in format '[1,2,3,...]'
    const formattedPosts = posts.map(post => {
      const { embedding, ...postWithoutEmbedding } = post;

      return {
        ...postWithoutEmbedding,
        metadata: post.metadata ? (typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata) : null
      };
    });

    res.json({
      success: true,
      data: formattedPosts,
      pagination: {
        total: totalCount,
        limit: limitInt,
        offset: offsetInt,
        hasMore: offsetInt + limitInt < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
      message: error.message
    });
  }
});

/**
 * GET /api/posts/stats
 * Get statistics about posts
 */
router.get('/stats', async (req, res) => {
  try {
    const { getPostCount } = await import('../models/post.js');
    const pool = (await import('../config/database.js')).default;

    const [total, interesting, notInteresting, unclassified] = await Promise.all([
      getPostCount({}),
      getPostCount({ is_interesting: true }),
      getPostCount({ is_interesting: false }),
      getPostCount({ is_interesting: null })
    ]);

    // Get source breakdown
    const sourceResult = await pool.query(
      'SELECT source, COUNT(*) as count FROM posts GROUP BY source'
    );

    res.json({
      success: true,
      data: {
        total,
        interesting,
        notInteresting,
        unclassified,
        bySource: sourceResult.rows.reduce((acc, row) => {
          acc[row.source] = parseInt(row.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

/**
 * GET /api/posts/:id
 * Get a single post by ID
 * 
 * URL parameters:
 * - id: number (post ID)
 */
router.get('/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID',
        message: 'Post ID must be a valid number'
      });
    }

    const post = await getPostById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        message: `Post with ID ${postId} does not exist`
      });
    }
    // Exclude embedding from response
    const { embedding, ...postWithoutEmbedding } = post;
    
    const formattedPost = {
      ...postWithoutEmbedding,
      metadata: post.metadata ? (typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata) : null
    };

    res.json({
      success: true,
      data: formattedPost
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
      message: error.message
    });
  }
});

/**
 * PUT /api/posts/:id
 * Update a post by ID — only is_interesting and metadata (uses updatePostClassification).
 *
 * Body: is_interesting (boolean|null), metadata (object, merged with existing)
 */
router.put('/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID',
        message: 'Post ID must be a valid number'
      });
    }

    const { is_interesting, metadata } = req.body;
    const existing = await getPostById(postId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        message: `Post with ID ${postId} does not exist`
      });
    }

    const isInteresting = is_interesting !== undefined ? is_interesting : existing.is_interesting;
    const metadataToMerge = metadata && typeof metadata === 'object' ? metadata : existing.metadata;

    const updated = await updatePostClassification(postId, isInteresting, metadataToMerge);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        message: `Post with ID ${postId} does not exist`
      });
    }

    const { embedding, embedding_v2, ...postWithoutEmbedding } = updated;
    const formattedPost = {
      ...postWithoutEmbedding,
      metadata: updated.metadata
        ? typeof updated.metadata === 'string'
          ? JSON.parse(updated.metadata)
          : updated.metadata
        : null
    };

    res.json({
      success: true,
      data: formattedPost
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update post',
      message: error.message
    });
  }
});

export default router;
