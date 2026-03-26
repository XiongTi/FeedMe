"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "@/hooks/use-navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { loadFeedData } from "@/lib/data-store"
import type { FeedData } from "@/lib/types"
import { findSourceByUrl } from "@/config/rss-config"
import { ExternalLink, Star, Sparkles } from "lucide-react"

// 安全的日期格式化
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

// 产品标签颜色（静态常量，避免每次渲染重建）
const TAG_COLORS: Record<string, string> = {
  '代码质量防线': 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'Piston': 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  'SmartTest': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'ATS运维': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  '支付大促Agent': 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'ALS': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
}

// 评分颜色
function getScoreColor(score: number) {
  if (score >= 8) return "bg-green-500"
  if (score >= 7) return "bg-yellow-500"
  if (score >= 6) return "bg-orange-500"
  return "bg-red-500"
}

export function RssFeed({ defaultSource }: { defaultSource: string }) {
  const searchParams = useSearchParams()
  const sourceUrl = searchParams.get("source") || defaultSource

  const [feedData, setFeedData] = useState<FeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFeed = async (url: string) => {
    try {
      setLoading(true)
      setError(null)

      const cachedData = await loadFeedData(url)

      if (cachedData) {
        setFeedData(cachedData)
      } else {
        setError("数据为空，请检查数据源是否出错🫠")
      }
    } catch (err) {
      console.error("Error fetching feed:", err)
      setError("数据获取失败，请检查数据源是否出错🫠")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeed(sourceUrl)
  }, [sourceUrl])

  const source = findSourceByUrl(sourceUrl)
  const displayTitle = source?.name || feedData?.title || "信息源"

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold">{displayTitle}</h2>
          {source && <Badge variant="outline" className="bg-primary/10">{source.category}</Badge>}
          {feedData?.items && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {feedData.items.length} 条
            </Badge>
          )}
        </div>
        {feedData?.lastUpdated && (
          <span className="text-xs text-muted-foreground">
            更新于: {formatDate(feedData.lastUpdated)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="feed-card">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {feedData?.items.map((item, index) => {
            const score = item.ai_score ?? 5
            const dateDisplay = formatDate(item.pubDate || item.isoDate)

            return (
              <Card key={index} className="feed-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    {/* 评分徽章 */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-white text-sm font-bold ${getScoreColor(score)}`}>
                      <Star className="h-3 w-3 fill-current" />
                      {score.toFixed(1)}
                    </div>
                    <CardTitle className="text-base leading-tight flex-1">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary flex items-center gap-1"
                      >
                        {item.title}
                        <ExternalLink className="h-3 w-3 inline opacity-60" />
                      </a>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    {dateDisplay && <span>{dateDisplay}</span>}
                    {item.creator && <><span className="mx-1">·</span><span>{item.creator}</span></>}
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {item.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className={TAG_COLORS[tag] || 'bg-gray-500/15 text-gray-700 dark:text-gray-300'}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  <Tabs defaultValue="summary" className="mt-2">
                    <TabsList className="mb-2">
                      <TabsTrigger value="summary" className="text-sm">AI 摘要</TabsTrigger>
                      <TabsTrigger value="original" className="text-sm">原文</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary">
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {item.summary || "无摘要"}
                      </div>
                    </TabsContent>
                    <TabsContent value="original">
                      <div
                        className="text-sm prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: item.content || item.contentSnippet || "无内容",
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
