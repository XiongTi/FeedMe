import { Suspense } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { RssFeed } from '@/components/rss-feed';
import { SourceSwitcher } from '@/components/source-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { ScrollToTop } from '@/components/scroll-to-top';
import { defaultSource, getSourcesByCategory } from '@/config/rss-config';
import { Github, Rss, Sparkles, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useSearchParams } from '@/hooks/use-navigation';
import { Badge } from '@/components/ui/badge';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <main className="flex-1 min-h-screen">
          <div className="container py-6 px-4 md:px-8 mx-auto max-w-3xl">
            <Header />
            <div className="mt-6">
              <Suspense fallback={<FeedSkeleton />}>
                <RssFeed defaultSource={defaultSource.url} />
              </Suspense>
            </div>
            <Footer />
          </div>
        </main>
      </div>
      <ScrollToTop />
    </ThemeProvider>
  );
}

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const searchParams = useSearchParams()
  const currentSource = searchParams.get("source")
  const groupedSources = getSourcesByCategory()
  
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'
  const basePath = currentPath.split('?')[0]

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-64 bg-card border-r z-40
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="p-4 border-b">
            <a href="./" className="flex items-center gap-2 text-xl font-bold hover:text-primary transition-colors">
              <Sparkles className="h-6 w-6 text-primary" />
              <span>FeedMe</span>
            </a>
            <p className="text-xs text-muted-foreground mt-1">AI 驱动的 RSS 阅读器</p>
          </div>

          {/* Source list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {Object.entries(groupedSources).map(([category, sources]: [string, any]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Rss className="h-3 w-3" />
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {sources.map((source: any) => (
                      <a
                        key={source.url}
                        href={`${basePath}?source=${encodeURIComponent(source.url)}`}
                        className={`
                          block px-3 py-2 rounded-md text-sm transition-colors
                          ${currentSource === source.url 
                            ? 'bg-primary text-primary-foreground font-medium' 
                            : 'hover:bg-muted text-foreground/80'}
                        `}
                        onClick={() => setIsOpen(false)}
                      >
                        {source.name}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <a
                href="https://github.com/XiongTi/FeedMe"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub 仓库"
              >
                <Button variant="outline" size="icon">
                  <Github className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function Header() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="md:hidden w-10" /> {/* Spacer for mobile menu button */}
        <div className="flex-1 md:hidden" /> {/* Spacer */}
      </div>
      <div className="hidden md:block">
        <Suspense fallback={<div className="w-full md:w-[300px] h-10 bg-muted rounded-md animate-pulse" />}>
          <SourceSwitcher />
        </Suspense>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t mt-12 py-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Stay hungry. 😋
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          由 AI 生成摘要 · 评分过滤高价值内容
        </p>
      </div>
    </footer>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-12 bg-muted rounded-full animate-pulse" />
            <div className="h-5 bg-muted rounded-md animate-pulse flex-1" />
          </div>
          <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
