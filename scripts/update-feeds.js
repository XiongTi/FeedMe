// 命令行脚本，用于更新所有RSS源数据
// 供GitHub Actions直接调用

// 加载.env文件中的环境变量
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { OpenAI } from 'openai';

// Folo 配置 - 从环境变量或 GitHub Secrets 读取
const FOLO_CONFIG = {
  cookie: process.env.FOLO_COOKIE || '',
  listId: process.env.FOLO_LIST_ID || '253497641939404800',
  apiUrl: 'https://api.follow.is/entries',
};

// 从配置文件中导入RSS源配置
import { config } from '../src/config/rss-config.js';

// 获取 __dirname 的 ES 模块等价物
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dotenvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(dotenvPath)) {
  const dotenvContent = fs.readFileSync(dotenvPath, 'utf8');
  dotenvContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.replace(/^"|"$/g, '');
      }
      process.env[key] = value;
    }
  });
  console.log('已从.env加载环境变量');
} else {
  // 尝试加载.env.local作为后备
  const localEnvPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localEnvPath)) {
    const dotenvContent = fs.readFileSync(localEnvPath, 'utf8');
    dotenvContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.replace(/^"|"$/g, '');
        }
        process.env[key] = value;
      }
    });
    console.log('已从.env.local加载环境变量');
  } else {
    console.warn('未找到.env或.env.local文件，请确保环境变量已设置');
  }
}

// RSS解析器配置
const parser = new Parser({
  timeout: 15000, // 15秒超时
  customFields: {
    item: [
      ["content:encoded", "content"],
      ["dc:creator", "creator"],
      ["summary", "summary"], // 添加对 Atom feed 中 summary 标签的支持
    ],
  },
});

// 从环境变量中获取API配置
const OPENAI_API_KEY = process.env.LLM_API_KEY;
const OPENAI_API_BASE = process.env.LLM_API_BASE;
const OPENAI_MODEL_NAME = process.env.LLM_NAME;

// 验证必要的环境变量
if (!OPENAI_API_KEY) {
  console.error('环境变量LLM_API_KEY未设置，无法生成摘要');
  process.exit(1);
}

if (!OPENAI_API_BASE) {
  console.error('环境变量LLM_API_BASE未设置，无法生成摘要');
  process.exit(1);
}

if (!OPENAI_MODEL_NAME) {
  console.error('环境变量LLM_NAME未设置，无法生成摘要');
  process.exit(1);
}

// 创建OpenAI客户端
const openai = new OpenAI({
  baseURL: OPENAI_API_BASE,
  apiKey: OPENAI_API_KEY,
});

// 确保数据目录存在
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), config.dataPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

// 获取今天的日期目录
function getTodayDateDir() {
  return new Date().toISOString().split('T')[0]; // 格式: 2026-03-08
}

// 获取源的文件路径
function getSourceFilePath(sourceUrl, dateDir = null) {
  const dataDir = ensureDataDir();
  // 使用URL的Base64编码作为文件名，避免非法字符
  const sourceHash = Buffer.from(sourceUrl).toString('base64').replace(/[/+=]/g, '_');
  // 按日期保存到不同目录
  const targetDir = dateDir ? path.join(dataDir, dateDir) : dataDir;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return path.join(targetDir, `${sourceHash}.json`);
}

// 保存源数据到文件
async function saveFeedData(sourceUrl, data, dateDir = null) {
  const filePath = getSourceFilePath(sourceUrl, dateDir);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`保存数据 ${sourceUrl} 到 ${filePath}`);
  } catch (error) {
    console.error(`保存数据 ${sourceUrl} 时出错:`, error);
    throw new Error(`保存源数据失败: ${error.message}`);
  }
}

// 从文件加载源数据
function loadFeedData(sourceUrl, dateDir = null) {
  const filePath = getSourceFilePath(sourceUrl, dateDir);

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`加载数据 ${sourceUrl} 时出错:`, error);
    return null;
  }
}

// 从 Folo 获取数据
async function fetchFoloData() {
  const { cookie, listId, apiUrl } = FOLO_CONFIG;
  
  console.log(`FOLO_COOKIE 环境变量: ${cookie ? '已设置' : '未设置'}`);
  console.log(`Cookie 前20字符: ${cookie ? cookie.slice(0, 20) : 'N/A'}`);
  
  const fullCookie = cookie ? `__Secure-better-auth.session_token=${cookie}` : '';
  
  console.log(`从 Folo 获取数据, listId: ${listId}`);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'origin': 'https://app.follow.is',
      'x-app-name': 'Folo Web',
      'x-app-version': '0.4.9',
    };
    
    if (fullCookie) {
      headers['Cookie'] = fullCookie;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        listId: listId,
        view: 1,
        withContent: true,
      }),
    });

    console.log(`Folo API 响应状态: ${response.status}`);
    const responseText = await response.text();
    console.log(`Folo API 响应内容: ${responseText.slice(0, 500)}`);

    if (!response.ok) {
      throw new Error(`Folo API error: ${response.status} - ${responseText.slice(0, 200)}`);
    }

    const result = JSON.parse(responseText);
    
    if (result.code !== 0) {
      throw new Error(`Folo API error: ${result.message}`);
    }

    // 转换 Folo 数据为 FeedMe 格式
    const items = result.data.map(entry => ({
      id: entry.entries.id,
      title: entry.entries.title,
      link: entry.entries.url,
      content: entry.entries.content || entry.entries.description || '',
      contentSnippet: entry.entries.summary || entry.entries.description || '',
      pubDate: entry.entries.publishedAt,
      isoDate: entry.entries.publishedAt,
      creator: entry.entries.author || entry.feeds?.title || 'Unknown',
      ai_score: 7, // 默认给 Folo 内容 7 分
      ai_reason: entry.feeds?.title || 'Folo',
    }));

    return {
      sourceUrl: `folo://${listId}`,
      title: 'Folo 订阅',
      description: '来自 Folo 的订阅内容',
      link: 'https://app.folo.is',
      items: items,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('获取 Folo 数据失败:', error);
    return null;
  }
}

// AI 打分 prompt
const SCORING_SYSTEM = `你是一个专业的内容评分专家，服务于一位关注工程效能与AI工程化的技术管理者。请根据以下标准对内容进行评分：

【核心关注领域 - 有加分倾向】
1. AI Agent / Agentic 系统（架构、编排、工具调用、多Agent协作）
2. 代码质量 & 静态分析（Lint、代码审查、缺陷检测、代码度量）
3. 软件测试智能化（AI测试生成、覆盖率、Fuzzing、变异测试）
4. DevOps / AIOps / 平台工程（CI/CD、可观测性、SRE、故障自愈）
5. LLM 工程化落地（Prompt Engineering、RAG、Fine-tune、模型服务化）
6. 开发者工具 & 工程效能（IDE插件、CLI工具、开发者体验）

**评分维度（0-10分）：**
- 9-10分：核心领域的突破性进展、重大开源发布、顶会论文、行业标杆实践
- 7-8分：核心领域的高质量技术分析、实用工具发布、有深度的架构设计
- 5-6分：泛AI/泛技术内容，有参考价值但非核心关注领域
- 3-4分：通用编程内容、增量更新、浅层报道
- 0-2分：与技术无关的内容（社会新闻、娱乐、营销软文、重复报道）

【特殊规则】
- Agent 相关内容（构建、编排、工具使用）：基础分+1
- 代码质量/测试/DevOps 工程实践类：基础分+1
- 纯产品发布公告无技术细节：上限6分
- 融资新闻、行业八卦：上限3分

【产品标签匹配】
如果内容与以下产品相关，请在 tags 中列出匹配的产品名称（可多选，也可为空）：
- 代码质量防线：代码质量、静态分析、代码审查、Lint、缺陷检测
- Piston：工程效能平台、CI/CD、研发工具链、流水线
- SmartTest：智能测试、AI测试生成、覆盖率、Fuzzing
- ATS运维：AIOps、可观测性、SRE、故障诊断、运维自动化
- 支付大促Agent：支付系统、大促保障、Agent编排、业务流程自动化
- ALS：日志服务、日志分析、链路追踪`;

const SCORING_USER = `请分析以下内容并返回 JSON 格式的评分和摘要：

标题：{title}
内容：{content}

返回格式：
{{
  "score": <0-10的数字>,
  "reason": "<简短评分理由>",
  "summary": "<100字左右的中文摘要>",
  "tags": ["匹配的产品名称，无匹配则为空数组"]
}}`;

const SUMMARY_SYSTEM = `你是一个专业的内容摘要生成器。请根据以下文章标题和内容，生成一个简洁、准确的中文摘要。
摘要应该：
1. 捕捉文章的主要观点和关键信息
2. 使用清晰、流畅的中文
3. 长度控制在100字左右
4. 保持客观，不添加个人观点
5. 如果文章内容为空或不包含有效信息，不要生成文章标题或内容未提及的无关内容。对非中文的标题进行翻译，不需要翻译中文的标题`;

const SUMMARY_USER = `文章标题：{title}

文章内容：
{content}`;

// 并发控制：限制同时执行的异步任务数量
async function asyncPool(limit, items, fn) {
  const results = [];
  const executing = new Set();
  for (const [index, item] of items.entries()) {
    const p = Promise.resolve().then(() => fn(item, index));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// 带重试的延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 产品标签白名单
const VALID_TAGS = ['代码质量防线', 'Piston', 'SmartTest', 'ATS运维', '支付大促Agent', 'ALS'];

// 生成摘要和评分函数
async function generateSummaryAndScore(title, content, retries = 3) {
  try {
    const contentToClean = (content || "").replace(/<[^>]*>?/gm, "");
    const cleanContent = contentToClean.slice(0, 5000);

    // 同时请求评分和摘要
    const prompt = SCORING_USER
      .replace('{title}', title)
      .replace('{content}', cleanContent);

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_NAME,
      messages: [
        { role: "system", content: SCORING_SYSTEM },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const response = completion.choices[0].message.content?.trim() || "";

    // 尝试解析 JSON
    let result = {};
    try {
      result = JSON.parse(response);
    } catch (e) {
      // 如果 JSON 解析失败，尝试从文本中提取
      const scoreMatch = response.match(/"score"\s*:\s*(\d+(?:\.\d+)?)/);
      const reasonMatch = response.match(/"reason"\s*:\s*"([^"]+)"/);
      const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/);

      result = {
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 5,
        reason: reasonMatch ? reasonMatch[1] : "",
        summary: summaryMatch ? summaryMatch[1] : response
      };
    }

    // 白名单过滤 tags
    const rawTags = Array.isArray(result.tags) ? result.tags : [];
    const tags = rawTags.filter(t => VALID_TAGS.includes(t));

    return {
      score: result.score ?? 5,
      reason: result.reason || "",
      summary: result.summary || "无法生成摘要",
      tags,
    };
  } catch (error) {
    // 429 限流时自动重试
    if (error?.status === 429 && retries > 0) {
      const waitSec = (4 - retries) * 5; // 5s, 10s, 15s 递增等待
      console.warn(`429 限流，${waitSec}s 后重试 (剩余 ${retries} 次): ${title}`);
      await sleep(waitSec * 1000);
      return generateSummaryAndScore(title, content, retries - 1);
    }
    console.error("生成摘要和评分时出错:", error);
    return { score: 5, reason: "AI 模型暂时不可用", summary: "无法生成摘要", tags: [] };
  }
}

// 预计算 RSSHub 镜像主机名，避免每次调用重复解析
const RSSHUB_MIRROR_HOSTS = new Set(
  config.rsshubMirrors.map(m => new URL(m).hostname)
);
const RSSHUB_MIRRORS_PARSED = config.rsshubMirrors.map(m => new URL(m));

// 检测是否为 RSSHub URL
function isRsshubUrl(url) {
  try {
    return RSSHUB_MIRROR_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// 将 RSSHub URL 替换为指定镜像域名
function replaceRsshubMirror(url, mirrorParsed) {
  const parsed = new URL(url);
  parsed.protocol = mirrorParsed.protocol;
  parsed.host = mirrorParsed.host;
  return parsed.toString();
}

// 解析 RSS feed 并序列化条目
function serializeFeed(feed) {
  const serializedItems = feed.items.map(item => {
    const serializedItem = {
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || "",
      isoDate: item.isoDate || "",
      content: item.content || item.summary || item.contentSnippet || "",
      contentSnippet: item.contentSnippet || "",
      creator: item.creator || "",
      _hasOriginalDate: !!(item.pubDate || item.isoDate),
    };

    if (item.enclosure) {
      serializedItem.enclosure = {
        url: item.enclosure.url || "",
        type: item.enclosure.type || "",
      };
    }

    return serializedItem;
  });

  return {
    title: feed.title || "",
    description: feed.description || "",
    link: feed.link || "",
    items: serializedItems,
  };
}

// 获取RSS源（超时自动重试，RSSHub 源自动尝试镜像）
async function fetchRssFeed(url, retries = 2) {
  // RSSHub URL → 逐个尝试镜像
  if (isRsshubUrl(url)) {
    for (const mirrorParsed of RSSHUB_MIRRORS_PARSED) {
      const mirrorUrl = replaceRsshubMirror(url, mirrorParsed);
      try {
        console.log(`尝试 RSSHub 镜像: ${mirrorUrl}`);
        const feed = await parser.parseURL(mirrorUrl);
        console.log(`RSSHub 镜像成功: ${mirrorUrl}`);
        return serializeFeed(feed);
      } catch (error) {
        console.warn(`RSSHub 镜像失败 (${mirrorUrl}): ${error.message}`);
      }
    }
    throw new Error(`所有 RSSHub 镜像均失败: ${url}`);
  }

  // 非 RSSHub URL → 保持原有超时重试逻辑
  try {
    const feed = await parser.parseURL(url);
    return serializeFeed(feed);
  } catch (error) {
    if (retries > 0 && error.message?.includes('timed out')) {
      const waitSec = (3 - retries) * 10;
      console.warn(`RSS 获取超时，${waitSec}s 后重试 (剩余 ${retries} 次): ${url}`);
      await sleep(waitSec * 1000);
      return fetchRssFeed(url, retries - 1);
    }
    console.error("获取RSS源时出错:", error);
    throw new Error(`获取RSS源失败: ${error.message}`);
  }
}

// 合并新旧数据，并找出需要生成摘要的新条目
function mergeFeedItems(oldItems = [], newItems = [], maxItems = config.maxItemsPerFeed) {
  // 创建一个Map来存储所有条目，使用链接作为键
  const itemsMap = new Map();

  // 添加旧条目到Map
  for (const item of oldItems) {
    if (item.link) {
      itemsMap.set(item.link, item);
    }
  }

  // 识别需要生成摘要的新条目
  const newItemsForSummary = [];

  // 添加新条目到Map，并标记需要生成摘要的条目
  for (const item of newItems) {
    if (item.link) {
      const existingItem = itemsMap.get(item.link);

      if (!existingItem) {
        // 这是一个新条目，需要生成摘要
        newItemsForSummary.push(item);
      }

      // 无论如何都更新Map，使用新条目（但保留旧摘要和评分如果有的话）
      let generatedSummary = existingItem?.summary;
      let existingScore = existingItem?.ai_score;
      let existingReason = existingItem?.ai_reason;
      let existingTags = existingItem?.tags;

      // 如果 item 有 summary 但没有 content，这可能是 Atom feed 的情况
      if (!item.content && item.summary && !generatedSummary) {
        item.content = item.summary;
        item.summary = undefined;
      }

      const serializedItem = {
        ...item,
        content: item.content || existingItem?.content || "",
        summary: generatedSummary || item.summary,
        ai_score: existingScore ?? item.ai_score,
        ai_reason: existingReason ?? item.ai_reason,
        tags: existingTags ?? item.tags,
      };

      itemsMap.set(item.link, serializedItem);
    }
  }

  // 将Map转换回数组，保持原始RSS源的顺序
  // 使用newItems的顺序作为基准
  const mergedItems = newItems
    .filter(item => item.link && itemsMap.has(item.link))
    .map(item => item.link ? itemsMap.get(item.link) : item)
    .slice(0, maxItems); // 只保留指定数量的条目

  return { mergedItems, newItemsForSummary };
}

// 更新单个源
async function updateFeed(sourceUrl) {
  console.log(`更新源: ${sourceUrl}`);

  try {
    // 获取现有数据（从 latest 目录加载）
    const existingData = loadFeedData(sourceUrl, 'latest');

    // 获取新数据
    const newFeed = await fetchRssFeed(sourceUrl);

    // 合并数据，找出需要生成摘要的新条目
    const { mergedItems, newItemsForSummary } = mergeFeedItems(
      existingData?.items || [],
      newFeed.items,
      config.maxItemsPerFeed,
    );

    console.log(`发现 ${newItemsForSummary.length} 条新条目，来自 ${sourceUrl}`);

    // 为新条目生成摘要和评分
    const threshold = config.aiScoreThreshold ?? 7.0;
    // 将新条目链接转为 Set，避免 O(n*m) 查找
    const newLinksSet = new Set(newItemsForSummary.map(i => i.link));
    // 并发限制为 3，避免触发 API 限流
    const itemsWithSummaries = await asyncPool(3, mergedItems, async (item) => {
      // 如果是新条目且需要生成摘要
      if (newLinksSet.has(item.link) && !item.summary) {
        try {
          const contentForSummary = item.content || item.contentSnippet || "";
          const result = await generateSummaryAndScore(item.title, contentForSummary);
          return {
            ...item,
            summary: result.summary,
            ai_score: result.score,
            ai_reason: result.reason,
            tags: result.tags,
          };
        } catch (err) {
          console.error(`为条目 ${item.title} 生成摘要时出错:`, err);
          return { ...item, summary: "无法生成摘要", ai_score: 5, ai_reason: "AI 错误", tags: [] };
        }
      }
      // 否则保持不变
      return item;
    });

    // 过滤超过 maxAgeDays 天的旧数据
    const maxAgeDays = config.maxAgeDays ?? 7;
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const beforeDateFilter = itemsWithSummaries.length;
    const dateFilteredItems = itemsWithSummaries.filter(item => {
      // 无原始日期（如 GitHub trending）→ 保留
      if (!item._hasOriginalDate) return true;
      const dateStr = item.pubDate || item.isoDate;
      if (!dateStr) return true;
      const itemDate = new Date(dateStr);
      // 日期无法解析 → 保留
      if (isNaN(itemDate.getTime())) return true;
      return itemDate >= cutoffDate;
    });
    const dateFilteredCount = beforeDateFilter - dateFilteredItems.length;
    if (dateFilteredCount > 0) {
      console.log(`过滤掉 ${dateFilteredCount} 条超过 ${maxAgeDays} 天的旧数据`);
    }

    // 清理内部字段（尽早清理，避免泄漏到持久化数据）
    dateFilteredItems.forEach(item => { delete item._hasOriginalDate; });

    // 处理日期字段：确保每条都有日期
    dateFilteredItems.forEach(item => {
      if (!item.pubDate && !item.isoDate) {
        item.pubDate = new Date().toISOString();
        item.isoDate = item.pubDate;
      }
    });

    // 预计算时间戳，避免排序中重复创建 Date 对象
    const timestamps = new Map(dateFilteredItems.map(item => [
      item, new Date(item.pubDate || item.isoDate || 0).getTime()
    ]));
    // 按日期降序排序（越新越前），相同日期再按分数降序（越高越前）
    dateFilteredItems.sort((a, b) => {
      const diff = timestamps.get(b) - timestamps.get(a);
      return diff !== 0 ? diff : (b.ai_score || 0) - (a.ai_score || 0);
    });

    // 过滤掉低于阈值的条目
    const filteredItems = dateFilteredItems.filter(item => (item.ai_score || 0) >= threshold);
    const filteredCount = dateFilteredItems.length - filteredItems.length;
    if (filteredCount > 0) {
      console.log(`过滤掉 ${filteredCount} 条低分内容（分数 < ${threshold}）`);
    }

    // 创建新的数据对象
    const updatedData = {
      sourceUrl,
      title: newFeed.title,
      description: newFeed.description,
      link: newFeed.link,
      items: filteredItems,
      lastUpdated: new Date().toISOString(),
    };

    // 获取今天的日期目录
    const todayDir = getTodayDateDir();
    
    // 保存到文件（按日期保存）
    await saveFeedData(sourceUrl, updatedData, todayDir);
    
    // 同时保存一份到 latest 目录
    await saveFeedData(sourceUrl, updatedData, 'latest');

    return updatedData;
  } catch (error) {
    console.error(`更新源 ${sourceUrl} 时出错:`, error);
    throw new Error(`更新源失败: ${error.message}`);
  }
}

// 更新所有源
async function updateAllFeeds() {
  console.log("开始更新所有RSS源");

  // 获取今天的日期目录
  const todayDir = getTodayDateDir();
  const dataDir = path.join(process.cwd(), config.dataPath);
  const todayDataDir = path.join(dataDir, todayDir);
  const latestDataDir = path.join(dataDir, 'latest');

  const results = {};
  const feedCounts = {};

  // 确保目录存在
  if (!fs.existsSync(todayDataDir)) {
    fs.mkdirSync(todayDataDir, { recursive: true });
  }
  if (!fs.existsSync(latestDataDir)) {
    fs.mkdirSync(latestDataDir, { recursive: true });
  }

  // Folo 订阅已禁用，跳过
  // 如需恢复，取消注释 rss-config.js 中的 Folo 源并恢复此处代码

  // 更新 RSS 源
  for (const source of config.sources) {
    // 跳过 Folo 等非 RSS 源
    if (source.url.startsWith('folo://') || source.url.startsWith('api://')) {
      console.log(`跳过非RSS源: ${source.url}`);
      continue;
    }
    
    try {
      const data = await updateFeed(source.url);
      results[source.url] = true;
      // 记录每个源的文章数量
      feedCounts[source.url] = {
        name: source.name,
        count: data.items.length,
        category: source.category
      };
    } catch (error) {
      console.error(`更新 ${source.url} 失败:`, error);
      results[source.url] = false;
      feedCounts[source.url] = {
        name: source.name,
        count: 0,
        category: source.category
      };
    }
  }

  // 生成索引文件，包含每个源的文章数量（保存在当天目录）
  const indexPath = path.join(todayDataDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(feedCounts, null, 2), 'utf-8');
  console.log(`已生成索引文件: ${indexPath}`);

  // 同时复制到 latest 目录
  const latestIndexPath = path.join(latestDataDir, 'index.json');
  fs.writeFileSync(latestIndexPath, JSON.stringify(feedCounts, null, 2), 'utf-8');
  console.log(`已更新 latest 索引文件: ${latestIndexPath}`);

  console.log("所有RSS源更新完成");
  return results;
}

// 主函数
async function main() {
  try {
    await updateAllFeeds();
    console.log("RSS数据更新成功");
    process.exit(0);
  } catch (error) {
    console.error("RSS数据更新失败:", error);
    process.exit(1);
  }
}

// 执行主函数
main();
