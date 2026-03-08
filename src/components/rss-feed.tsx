"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "@/hooks/use-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  // 评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500"
    if (score >= 7) return "bg-yellow-500"
    if (score >= 6) return "bg-orange-500"
    return "bg-red-500"
  }

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
            const score = item.ai_score || 5
            
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
                  <CardDescription className="flex items-center gap-2 mt-1">
                    {formatDate(item.pubDate || item.isoDate) && <span>{formatDate(item.pubDate || item.isoDate)}</span>}
                    {item.creator && <span>· {item.creator}</span>}
                    {item.ai_reason && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full ml-2">
                        {item.ai_reason}
                      </span>
                    )}
                  </CardDescription>
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
