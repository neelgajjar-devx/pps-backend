import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseMoneycontrolDate } from '../utils/dateParser.js';

const baseUrl = 'https://www.moneycontrol.com';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// MoneyControl URLs to scrape
export const MONEYCONTROL_URLS = [
  'https://www.moneycontrol.com/news/business/personal-finance/',
  // 'https://www.moneycontrol.com/banking/',
  // 'https://www.moneycontrol.com/news/india/',
  // 'https://www.moneycontrol.com/city/',
  // 'https://www.moneycontrol.com/world/',
  'https://www.moneycontrol.com/news/politics/',
  // 'https://www.moneycontrol.com/defence/',
  'https://www.moneycontrol.com/news/business/economy/'
];

/**
 * Sleep/delay function to wait between requests
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely extracts text from a cheerio element
 * Returns empty string if element is not found
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {string} selector - CSS selector string
 * @param {string|null} subSelector - Optional sub-selector to find within the matched element
 * @returns {string} Extracted text or empty string
 */
function safeExtractText($, selector, subSelector = null) {
  const element = $(selector).first();
  if (element.length === 0) return '';

  const targetElement = subSelector ? element.find(subSelector).first() : element;
  if (targetElement.length === 0) return '';

  return targetElement.text().trim();
}

/**
 * Visits the specific article link to get the full text and metadata.
 * @param {string} articleUrl - URL of the article to scrape
 * @returns {Promise<{ full_body: string, artical_author_name: string|null, artical_published_date_time: string|null }|string>}
 */
async function getArticleBody(articleUrl) {
  try {
    const response = await axios.get(articleUrl, {
      headers: HEADERS,
      timeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000')
    });

    if (response.status !== 200) {
      return 'Error: Could not fetch body';
    }

    const $ = cheerio.load(response.data);

    // Moneycontrol article text is usually in a div with id="contentdata" or class="content_wrapper"
    let articleDiv = $('#contentdata').first();
    if (articleDiv.length === 0) {
      articleDiv = $('.content_wrapper').first();
    }
    if (articleDiv.length === 0) {
      articleDiv = $('.arti-flow').first();
    }

    // Extract article metadata using helper function
    const articleAuthorStart = safeExtractText($, '.article_author', 'a');

    // Try alternate pattern from content_block
    const contentBlockText = safeExtractText($, '.content_block');
    let articleAuthorEnd = '';
    if (contentBlockText) {
      const words = contentBlockText.trim().split(/\s+/);
      if (words.length >= 2) {
        articleAuthorEnd = words.slice(0, 2).join(' ');
      }
      const match = contentBlockText.match(/^(.*?)\s+is\s+/);
      if (match && match[1]) {
        articleAuthorEnd = match[1].trim();
      }
    }

    const articlePublishedDateTimeStart = safeExtractText($, '.article_schedule');
    const articlePublishedDateTimeEnd = safeExtractText($, '.tags_last_line');

    if (articleDiv.length > 0) {
      // Get all paragraphs and join them
      const paragraphs = articleDiv.find('p');
      const fullText = paragraphs
        .map((i, elem) => $(elem).text().trim())
        .get()
        .filter(Boolean)
        .join('\n');

      return {
        full_body: fullText,
        artical_author_name: articleAuthorStart || articleAuthorEnd || null,
        artical_published_date_time: articlePublishedDateTimeStart || articlePublishedDateTimeEnd || null
      };
    }

    return 'Error: Content div not found';
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * Core scraper that follows the reference logic and returns Moneycontrol posts
 * in the shape expected by the rest of the app / database.
 *
 * @param {string} targetUrl - Moneycontrol listing page URL
 * @param {number} maxArticles - Maximum number of articles to process
 * @returns {Promise<Array<Object>>}
 */
async function scrapeMoneycontrolFeed(targetUrl, maxArticles = 5) {
  console.log(`📡 Fetching Moneycontrol feed: ${targetUrl}`);

  try {
    const response = await axios.get(targetUrl, {
      headers: HEADERS,
      timeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000')
    });

    if (response.status !== 200) {
      console.log(`Failed to fetch page: ${response.status}`);
      return [];
    }

    const $ = cheerio.load(response.data);

    // The main list is usually inside a <ul> with id="cagetory" (Moneycontrol's typo)
    const newsList = $('#cagetory');

    if (newsList.length === 0) {
      console.log('Could not find the news list container. Structure may have changed.');
      return [];
    }

    // Get all list items (li) with class 'clearfix'
    const articles = newsList.find('li.clearfix');

    const posts = [];

    console.log(`Found ${articles.length} articles. Processing (max ${maxArticles})...`);

    const articlesToProcess = articles.slice(0, maxArticles);

    for (let i = 0; i < articlesToProcess.length; i++) {
      try {
        const item = $(articlesToProcess[i]);

        // 1. Extract basic metadata
        const h2Tag = item.find('h2').first();
        if (h2Tag.length === 0) continue;

        // If the article is premium, skip it
        const spanTag = h2Tag.find('span').first();
        if (spanTag.length > 0) {
          const spanClasses = spanTag.attr('class');
          if (spanClasses && spanClasses.split(' ').includes('isPremiumCrown')) {
            continue;
          }
        }

        const aTag = h2Tag.find('a').first();
        const title = aTag.text().trim();
        let link = aTag.attr('href');

        if (!title || !link) continue;

        // Normalize to absolute URL
        if (!link.startsWith('http')) {
          link = `https://www.moneycontrol.com${link}`;
        }

        // 2. Extract full body (deep dive)
        await sleep(parseInt(process.env.SCRAPING_DELAY_MS || '1000')); // be polite to the server
        const articleBody = await getArticleBody(link);

        if (typeof articleBody === 'string') {
          console.log(`⚠️ Error fetching article body: ${articleBody}`);
          continue;
        }

        const publishedAtDate = parseMoneycontrolDate(articleBody.artical_published_date_time || '');

        // Extract category from URL
        let category = 'general';
        if (targetUrl.includes('personal-finance')) category = 'personal-finance';
        else if (targetUrl.includes('banking')) category = 'banking';
        else if (targetUrl.includes('/india/')) category = 'india';
        else if (targetUrl.includes('city')) category = 'city';
        else if (targetUrl.includes('world')) category = 'world';
        else if (targetUrl.includes('politics')) category = 'politics';
        else if (targetUrl.includes('defence')) category = 'defence';
        else if (targetUrl.includes('economy')) category = 'economy';

        // 3. Map to our DB schema (posts table)
        const postData = {
          source: 'moneycontrol',
          source_id: `moneycontrol_${link.split('/').filter(Boolean).pop()}`,
          title: title,
          content: articleBody.full_body || title,
          url: link,
          author: articleBody.artical_author_name || null,
          published_at: publishedAtDate,
          metadata: {
            category: category,
            raw_published_text: articleBody.artical_published_date_time || null,
            scraped_from: targetUrl,
            scraped_at: new Date().toISOString()
          }
        };

        posts.push(postData);
        console.log(`✅ Scraped Moneycontrol article: ${title.substring(0, 60)}...`);
      } catch (error) {
        console.log(`⚠️ Error processing item: ${error.message}`);
        continue;
      }
    }

    console.log(`Finished Moneycontrol scraping. Collected ${posts.length} posts.`);
    return posts;
  } catch (error) {
    console.log(`⚠️ Error fetching feed: ${error.message}`);
    return [];
  }
}

/**
 * Scrape all MoneyControl URLs
 * @param {number} maxArticlesPerURL - Maximum articles to fetch per URL
 * @returns {Promise<Array<Object>>}
 */
export async function scrapeAllMoneyControl(maxArticlesPerURL = 5) {
  const allPosts = [];
  
  for (const url of MONEYCONTROL_URLS) {
    try {
      const posts = await scrapeMoneycontrolFeed(url, maxArticlesPerURL);
      allPosts.push(...posts);
      // Add delay between different URLs
      await sleep(2000);
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      continue;
    }
  }
  
  return allPosts;
}

/**
 * Scrape a single MoneyControl URL
 * @param {string} url - URL to scrape
 * @param {number} maxArticles - Maximum articles to fetch
 * @returns {Promise<Array<Object>>}
 */
export async function scrapeMoneyControlURL(url, maxArticles = 5) {
  return scrapeMoneycontrolFeed(url, maxArticles);
}
