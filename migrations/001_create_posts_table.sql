-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    source_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT NOT NULL,
    author VARCHAR(255),
    published_at TIMESTAMP,
    is_interesting BOOLEAN DEFAULT NULL,
    embedding vector(1536), -- OpenAI ada-002 produces 1536-dimensional vectors
    embedding_v2 vector(768), -- Ollama embeddinggemma produces 768-dimensional vectors
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS posts_source_id_idx ON posts(source_id);
CREATE INDEX IF NOT EXISTS posts_published_at_idx ON posts(published_at);
CREATE INDEX IF NOT EXISTS posts_is_interesting_idx ON posts(is_interesting);
CREATE INDEX IF NOT EXISTS posts_source_idx ON posts(source);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at);

-- Create vector similarity indexes (ivfflat for cosine similarity)
-- Note: These indexes require at least some data. Consider creating them after initial data load.
-- CREATE INDEX IF NOT EXISTS posts_embedding_idx ON posts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX IF NOT EXISTS posts_embedding_v2_idx ON posts USING ivfflat (embedding_v2 vector_cosine_ops) WITH (lists = 100);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
-- Drop trigger if it exists first (to make migration idempotent)
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
