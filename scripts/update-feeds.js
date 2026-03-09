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
const SCORING_SYSTEM = `你是一个专业的内容评分专家。请根据以下标准对内容进行评分：

**评分维度（0-10分）：**
- 9-10分：突破性进展、重大发布、重要研究突破
- 7-8分：高价值技术分析、实用工具、有深度的观点
- 5-6分：有意思但不必需、增量改进
- 3-4分：低优先级、常见内容
- 0-2分：噪音、广告、无关内容

考虑因素：技术深度、创新性、实用性、影响力。`;

const SCORING_USER = `请分析以下内容并返回 JSON 格式的评分和摘要：

标题：{title}
内容：{content}

返回格式：
{{
  "score": <0-10的数字>,
  "reason": "<简短评分理由>",
  "summary": "<100字左右的中文摘要>
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

// 生成摘要和评分函数
async function generateSummaryAndScore(title, content) {
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

    return {
      score: result.score || 5,
      reason: result.reason || "",
      summary: result.summary || "无法生成摘要"
    };
  } catch (error) {
    console.error("生成摘要和评分时出错:", error);
    return { score: 5, reason: "AI 模型暂时不可用", summary: "无法生成摘要" };
  }
}

// 获取RSS源
async function fetchRssFeed(url) {
  try {
    // 直接解析RSS URL
    const feed = await parser.parseURL(url);

    // 处理items，确保所有对象都是可序列化的纯对象
    const serializedItems = feed.items.map(item => {
      // 创建新的纯对象
      const serializedItem = {
        title: item.title || "",
        link: item.link || "",
        pubDate: item.pubDate || "",
        isoDate: item.isoDate || "",
        // 优先使用 content，如果为空则尝试使用 summary（Atom feed），再尝试 contentSnippet
        content: item.content || item.summary || item.contentSnippet || "",
        contentSnippet: item.contentSnippet || "",
        creator: item.creator || "",
      };

      // 如果存在enclosure，以纯对象形式添加
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
  } catch (error) {
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
    const threshold = config.aiScoreThreshold || 6.0;
    const itemsWithSummaries = await Promise.all(
      mergedItems.map(async (item) => {
        // 如果是新条目且需要生成摘要
        if (newItemsForSummary.some((newItem) => newItem.link === item.link) && !item.summary) {
          try {
            const contentForSummary = item.content || item.contentSnippet || "";
            const result = await generateSummaryAndScore(item.title, contentForSummary);
            return { 
              ...item, 
              summary: result.summary,
              ai_score: result.score,
              ai_reason: result.reason
            };
          } catch (err) {
            console.error(`为条目 ${item.title} 生成摘要时出错:`, err);
            return { ...item, summary: "无法生成摘要", ai_score: 5, ai_reason: "AI 错误" };
          }
        }
        // 否则保持不变
        return item;
      }),
    );

    // 按 AI 分数排序
    itemsWithSummaries.sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));

    // 过滤掉低于阈值的条目
    const filteredItems = itemsWithSummaries.filter(item => (item.ai_score || 0) >= threshold);
    const filteredCount = itemsWithSummaries.length - filteredItems.length;
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

  // 先获取 Folo 数据
  const folioUrl = "folo://list";
  try {
    console.log("正在获取 Folo 数据...");
    const folioData = await fetchFoloData();
    if (folioData && folioData.items.length > 0) {
      // 保存 Folo 数据
      const folioFilePath = path.join(latestDataDir, Buffer.from(folioUrl).toString('base64').replace(/[/+=]/g, '_') + '.json');
      fs.writeFileSync(folioFilePath, JSON.stringify(folioData, null, 2), 'utf-8');
      results[folioUrl] = true;
      feedCounts[folioUrl] = {
        name: 'Folo 订阅',
        count: folioData.items.length,
        category: 'Folo'
      };
      console.log(`Folo 数据获取成功: ${folioData.items.length} 条`);
    } else {
      results[folioUrl] = false;
      feedCounts[folioUrl] = {
        name: 'Folo 订阅',
        count: 0,
        category: 'Folo'
      };
    }
  } catch (error) {
    console.error('获取 Folo 数据失败:', error);
    results[folioUrl] = false;
    feedCounts[folioUrl] = {
      name: 'Folo 订阅',
      count: 0,
      category: 'Folo'
    };
  }

  // 更新其他 RSS 源
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
