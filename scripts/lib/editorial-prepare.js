import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');

const EDITORIAL_DIR = path.join(workspaceRoot, 'editorial', 'follow-builders');
const PROMPTS_DIR = path.join(EDITORIAL_DIR, 'prompts');
const SOURCES_PATH = path.join(EDITORIAL_DIR, 'default-sources.json');

const DEFAULT_FEED_URLS = {
  x: 'https://ghproxy.net/https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json',
  podcasts: 'https://ghproxy.net/https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json',
  blogs: 'https://ghproxy.net/https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json'
};

const PROMPT_FILES = [
  'digest-intro.md',
  'summarize-tweets.md',
  'summarize-blogs.md',
  'summarize-podcast.md',
  'translate.md'
];

function promptKeyForFile(filename) {
  return filename.replace('.md', '').replace(/-/g, '_');
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function fetchJsonOrThrow(fetchImpl, url, label) {
  // Try curl first since it respects system proxy settings
  try {
    const { stdout } = await execFileAsync('curl', ['-sSL', '--max-time', '15', url]);
    return JSON.parse(stdout);
  } catch (curlError) {
    console.warn(`[WARN] curl failed for ${label}, falling back to fetch: ${curlError.message}`);
    
    // Fallback to fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`failed to fetch ${label} (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`fetch ${label} timeout after 15s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export async function loadFollowBuildersEditorialAssets() {
  const [sources, promptEntries] = await Promise.all([
    readJsonFile(SOURCES_PATH),
    Promise.all(PROMPT_FILES.map(async filename => {
      const fullPath = path.join(PROMPTS_DIR, filename);
      const content = await fs.readFile(fullPath, 'utf-8');
      return [promptKeyForFile(filename), content];
    }))
  ]);

  return {
    prompts: Object.fromEntries(promptEntries),
    sources
  };
}

export function normalizeFeedBundle(bundle) {
  if (bundle?.feedX || bundle?.feedPodcasts || bundle?.feedBlogs) {
    return {
      x: bundle.feedX?.x || [],
      podcasts: bundle.feedPodcasts?.podcasts || [],
      blogs: bundle.feedBlogs?.blogs || [],
      stats: {
        xBuilders: bundle.feedX?.stats?.xBuilders || (bundle.feedX?.x || []).length,
        totalTweets: bundle.feedX?.stats?.totalTweets || (bundle.feedX?.x || []).reduce((sum, builder) => sum + (builder.tweets?.length || 0), 0),
        podcastEpisodes: bundle.feedPodcasts?.stats?.podcastEpisodes || (bundle.feedPodcasts?.podcasts || []).length,
        blogPosts: bundle.feedBlogs?.stats?.blogPosts || (bundle.feedBlogs?.blogs || []).length
      },
      feedGeneratedAt: bundle.feedX?.generatedAt || bundle.feedPodcasts?.generatedAt || bundle.feedBlogs?.generatedAt || bundle.savedAt || null,
      snapshotDate: bundle.snapshotDate || null
    };
  }

  return {
    x: bundle?.x || [],
    podcasts: bundle?.podcasts || [],
    blogs: bundle?.blogs || [],
    stats: {
      xBuilders: bundle?.stats?.xBuilders || (bundle?.x || []).length,
      totalTweets: bundle?.stats?.totalTweets || (bundle?.x || []).reduce((sum, builder) => sum + (builder.tweets?.length || 0), 0),
      podcastEpisodes: bundle?.stats?.podcastEpisodes || (bundle?.podcasts || []).length,
      blogPosts: bundle?.stats?.blogPosts || (bundle?.blogs || []).length
    },
    feedGeneratedAt: bundle?.generatedAt || null,
    snapshotDate: bundle?.snapshotDate || null
  };
}

export async function fetchFeedBundle({ fetchImpl = fetch, feedUrls = DEFAULT_FEED_URLS } = {}) {
  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJsonOrThrow(fetchImpl, feedUrls.x, 'feed-x'),
    fetchJsonOrThrow(fetchImpl, feedUrls.podcasts, 'feed-podcasts'),
    fetchJsonOrThrow(fetchImpl, feedUrls.blogs, 'feed-blogs')
  ]);

  return normalizeFeedBundle({
    feedX,
    feedPodcasts,
    feedBlogs
  });
}

export function buildPreparedDigest({
  assets,
  feedBundle,
  config = {
    language: 'zh',
    frequency: 'daily',
    delivery: { method: 'stdout' }
  }
}) {
  const normalizedFeeds = normalizeFeedBundle(feedBundle);

  return {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    config: {
      language: config.language || 'zh',
      frequency: config.frequency || 'daily',
      delivery: config.delivery || { method: 'stdout' }
    },
    prompts: assets.prompts,
    sources: assets.sources,
    x: normalizedFeeds.x,
    podcasts: normalizedFeeds.podcasts,
    blogs: normalizedFeeds.blogs,
    stats: {
      xBuilders: normalizedFeeds.stats.xBuilders,
      totalTweets: normalizedFeeds.stats.totalTweets,
      podcastEpisodes: normalizedFeeds.stats.podcastEpisodes,
      blogPosts: normalizedFeeds.stats.blogPosts,
      feedGeneratedAt: normalizedFeeds.feedGeneratedAt,
      snapshotDate: normalizedFeeds.snapshotDate
    }
  };
}
