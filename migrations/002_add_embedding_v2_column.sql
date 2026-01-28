-- Migration to add embedding_v2 column for Ollama embeddinggemma model
-- This migration is safe to run even if the column already exists

-- Add embedding_v2 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'embedding_v2'
    ) THEN
        ALTER TABLE posts ADD COLUMN embedding_v2 vector(768);
        RAISE NOTICE 'Added embedding_v2 column';
    ELSE
        RAISE NOTICE 'embedding_v2 column already exists';
    END IF;
END $$;
