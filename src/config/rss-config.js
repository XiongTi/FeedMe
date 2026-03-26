// RSS源接口
// name: 信息源名称
// url: RSS URL地址
// category: 分类名称

/**
 * @typedef {object} RssSource
 * @property {string} name - 信息源名称
 * @property {string} url - RSS URL地址
 * @property {string} category - 分类名称
 */

// 默认配置
export const config = {
  sources: [
    // Folo 订阅 - 通过 API 单独获取
    // {
    //   name: "Folo 订阅",
    //   url: "folo://list",
    //   category: "Folo",
    // },
    {
      name: "Hacker News 近期最佳",
      url: "https://hnrss.org/best",
      category: "科技资讯",
    },
    {
      name: "Hacker News 历史每日前十",
      url: "https://rsshub.rssforever.com/github/issue/headllines/hackernews-daily",
      category: "科技资讯",
    },
    {
      name: "OpenAI News",
      url: "https://openai.com/news/rss.xml",
      category: "科技资讯",
    },
    {
      name: "Smol AI News",
      url: "https://news.smol.ai/rss.xml",
      category: "科技资讯",
    },
    {
      name: "Github 今日热门",
      url: "https://rsshub.rssforever.com/github/trending/daily/any",
      category: "代码项目",
    },
    {
      name: "Github 近一周热门",
      url: "https://rsshub.rssforever.com/github/trending/weekly/any",
      category: "代码项目",
    },
    {
      name: "Hugging Face 每日论文",
      url: "https://rsshub.rssforever.com/huggingface/daily-papers",
      category: "科研论文",
    },
    // HuggingFace Blog RSSHub 503 错误，暂不可用
    // {
    //   name: "Hugging Face 博客",
    //   url: "https://rsshub.rssforever.com/huggingface/blog",
    //   category: "技术博客",
    // },
    {
      name: "Google 开发者博客",
      url: "https://rsshub.rssforever.com/google/developers/en",
      category: "技术博客",
    },
    {
      name: "Google 研究博客",
      url: "https://rsshub.rssforever.com/google/research",
      category: "技术博客",
    },
    {
      name: "Simon Willison's Weblog",
      url: "https://simonwillison.net/atom/everything/",
      category: "技术博客",
    },
    {
      name: "Microsoft Research",
      url: "https://www.microsoft.com/en-us/research/feed/",
      category: "技术博客",
    },
    {
      name: "LINUX DO 今日热门",
      url: "https://linux.do/top.rss?period=daily",
      category: "论坛",
    },
    {
      name: "LINUX DO 近一周热门",
      url: "https://linux.do/top.rss?period=weekly",
      category: "论坛",
    },
    {
      name: "LINUX DO 近一月热门",
      url: "https://linux.do/top.rss?period=monthly",
      category: "论坛",
    },
    {
      name: "V2EX 今日热门",
      url: "https://rsshub.rssforever.com/v2ex/topics/hot",
      category: "论坛",
    },
    {
      name: "Product Hunt 今日热门",
      url: "https://www.producthunt.com/feed",
      category: "科技资讯",
    },
    // 番剧类 - 暂时禁用
    // {
    //   name: "Bangumi 近一月热门",
    //   url: "https://rsshub.rssforever.com/bangumi.tv/anime/followrank",
    //   category: "番剧资讯",
    // },
  ],
  maxItemsPerFeed: 30,
  // AI 打分阈值配置
  aiScoreThreshold: 7.0,
  dataPath: "./public/data",
}

export const defaultSource = config.sources[0]

/**
 * @param {string} url
 * @returns {RssSource | undefined}
 */
export function findSourceByUrl(url) {
  return config.sources.find((source) => source.url === url)
}

export function getSourcesByCategory() {
  return config.sources.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = []
    }
    acc[source.category].push(source)
    return acc
  }, {})
}
