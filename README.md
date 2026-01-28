# Public Policy Summarize - Backend

Automated system to scrape MoneyControl news articles, store them in PostgreSQL vector database, classify them using LLM, and provide API access to classified articles.

## Features

- 🔍 Web scraping from 8 MoneyControl news categories
- 🗄️ PostgreSQL vector database storage with pgvector
- 🤖 LLM-based article classification (interesting/not interesting)
- ⏰ Automated cron job for regular scraping and classification
- 🔌 RESTful API to fetch classified articles

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher) with pgvector extension
- OpenAI API key (for embeddings and classification)

## Installation

See [SETUP.md](./SETUP.md) for detailed installation instructions.

Quick start:
1. Install dependencies: `npm install`
2. Set up PostgreSQL with pgvector extension
3. Create `.env` file with your configuration (see SETUP.md)
4. Run migrations: `npm run migrate`
5. Start server: `npm start`

## Usage

### Start the server:
```bash
npm start
# or for development
npm run dev
```

### API Endpoints

#### GET /api/posts
Fetch posts with optional filters.

**Query Parameters:**
- `is_interesting` (boolean): Filter by classification
- `limit` (number): Number of results (default: 50)
- `offset` (number): Pagination offset (default: 0)
- `source` (string): Filter by source
- `search` (string): Semantic search query

**Example:**
```
GET /api/posts?is_interesting=true&limit=10
```

## Cron Job

The cron job automatically:
1. Scrapes latest articles from all MoneyControl URLs
2. Stores them in the vector database
3. Classifies articles using LLM
4. Updates the `is_interesting` column

Cron schedule is configurable via `CRON_SCHEDULE` in `.env` (default: every 6 hours).

## Project Structure

```
src/
├── config/          # Configuration files
├── services/        # Business logic services
├── models/          # Database models
├── routes/          # API routes
└── utils/           # Utility functions
```

## License

ISC
