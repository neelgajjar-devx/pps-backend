import cron from 'node-cron';
import { scrapeAllMoneyControl } from './scraper.js';
import { generatePostEmbedding } from './embedding.js';
import { classifyArticle } from './classifier.js';
import { postExists, insertPost, updatePostClassification } from '../models/post.js';

/**
 * Main job function that orchestrates scraping, embedding, and classification
 */
async function runScrapingAndClassificationJob() {
  console.log('\n🚀 Starting automated scraping and classification job...');
  const startTime = Date.now();

  try {
    // Step 1: Scrape all MoneyControl URLs
    console.log('📰 Step 1: Scraping MoneyControl articles...');
    const maxArticlesPerURL = parseInt(process.env.MAX_ARTICLES_PER_URL || '5');
    const scrapedPosts = await scrapeAllMoneyControl(maxArticlesPerURL);
    console.log(`✅ Scraped ${scrapedPosts.length} articles total`);

    if (scrapedPosts.length === 0) {
      console.log('⚠️ No articles scraped. Skipping remaining steps.');
      return;
    }

    // Step 2: Filter out duplicates and process new posts
    console.log('🔍 Step 2: Checking for duplicates...');
    const newPosts = [];
    for (const post of scrapedPosts) {
      const exists = await postExists(post.source_id);
      if (!exists) {
        newPosts.push(post);
      }
    }
    console.log(`✅ Found ${newPosts.length} new articles to process`);

    if (newPosts.length === 0) {
      console.log('ℹ️ No new articles to process.');
      return;
    }

    // Step 3: Generate embeddings and store posts
    console.log('🧮 Step 3: Generating embeddings and storing posts...');
    const storedPosts = [];
    for (const post of newPosts) {
      try {
        // Generate embedding using Ollama (embeddinggemma - 768 dimensions)
        const embedding_v2 = await generatePostEmbedding(post);
        
        // Store post with embedding_v2 (Ollama embeddinggemma)
        const storedPost = await insertPost({
          ...post,
          embedding: null,      // Keep old embedding field null (OpenAI ada-002 deprecated)
          embedding_v2,          // Store new Ollama embeddinggemma embeddings here
          is_interesting: null // Will be classified next
        });
        
        storedPosts.push(storedPost);
        console.log(`✅ Stored: ${post.title.substring(0, 50)}...`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Error processing post ${post.title}:`, error.message);
        // Store without embedding if embedding fails
        try {
          const storedPost = await insertPost({
            ...post,
            embedding: null,
            embedding_v2: null,
            is_interesting: null
          });
          storedPosts.push(storedPost);
        } catch (insertError) {
          console.error(`❌ Failed to store post:`, insertError.message);
        }
      }
    }

    // Step 4: Classify articles
    console.log('🤖 Step 4: Classifying articles using LLM...');
    let classifiedCount = 0;
    for (const post of storedPosts) {
      try {
        const classification = await classifyArticle({
          title: post.title,
          content: post.content,
          url: post.url
        });

        // Update post with classification
        await updatePostClassification(
          post.id,
          classification.is_interesting,
          {
            reasoning: classification.reasoning,
            content_pillar: classification.content_pillar,
            policy_anchor: classification.policy_anchor
          }
        );

        if (classification.is_interesting === true) {
          classifiedCount++;
          console.log(`✅ Classified as INTERESTING: ${post.title.substring(0, 50)}...`);
        } else if (classification.is_interesting === false) {
          console.log(`ℹ️ Classified as NOT INTERESTING: ${post.title.substring(0, 50)}...`);
        } else {
          console.log(`⚠️ Classification failed: ${post.title.substring(0, 50)}...`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error classifying post ${post.id}:`, error.message);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n📊 Job Summary:');
    console.log(`   - Articles scraped: ${scrapedPosts.length}`);
    console.log(`   - New articles: ${newPosts.length}`);
    console.log(`   - Articles stored: ${storedPosts.length}`);
    console.log(`   - Articles classified as interesting: ${classifiedCount}`);
    console.log(`   - Total time: ${duration}s`);
    console.log('✅ Job completed successfully!\n');
  } catch (error) {
    console.error('❌ Job failed with error:', error);
    throw error;
  }
}

/**
 * Start the cron job scheduler
 */
export function startCronJob() {
  const schedule = process.env.CRON_SCHEDULE || '* */2 * * *'; // Default: every 2 hours
  const enabled = process.env.ENABLE_CRON !== 'false';

  if (!enabled) {
    console.log('⏸️ Cron job is disabled (ENABLE_CRON=false)');
    return;
  }

  console.log(`⏰ Scheduling cron job with schedule: ${schedule}`);
  
  // Run immediately on startup (optional - can be disabled)
  if (process.env.RUN_ON_STARTUP === 'true') {
    console.log('🚀 Running initial job on startup...');
    runScrapingAndClassificationJob().catch(console.error);
  }

  // Schedule recurring job
  cron.schedule(schedule, async () => {
    await runScrapingAndClassificationJob();
  });

  console.log('✅ Cron job scheduler started');
}

/**
 * Manually trigger the job (useful for testing or API endpoints)
 */
export async function triggerJob() {
  return runScrapingAndClassificationJob();
}
