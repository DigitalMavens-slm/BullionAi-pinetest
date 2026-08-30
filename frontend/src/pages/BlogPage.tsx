import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
import { Calendar, Clock, ArrowRight, BookOpen, TrendingUp, BarChart2, Zap, Search } from "lucide-react";

const CATEGORIES = [
  { slug: "gold", name: "Gold Analysis", icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50" },
  { slug: "silver", name: "Silver Analysis", icon: TrendingUp, color: "text-slate-500", bg: "bg-slate-50" },
  { slug: "crude-oil", name: "Crude Oil", icon: Zap, color: "text-orange-500", bg: "bg-orange-50" },
  { slug: "trading-education", name: "Trading Education", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
  { slug: "platform-updates", name: "Platform Updates", icon: Search, color: "text-violet-600", bg: "bg-violet-50" },
];

const ARTICLES = [
  {
    slug: "gold-breaks-60k-resistance-mcx",
    title: "Gold Breaks ₹60,000 Resistance on MCX — What's Next?",
    excerpt: "MCX Gold futures surged past the key ₹60,000/10g level yesterday. Our AI engine triggered a BUY signal at ₹59,850 with targets at ₹60,500 and ₹61,200. Here's the technical breakdown.",
    category: "gold",
    author: "Research Team",
    date: "2026-08-28",
    readTime: "5 min",
    featured: true,
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
  },
  {
    slug: "silver-outperforms-gold-ratio-analysis",
    title: "Silver Outperforms Gold: Gold/Silver Ratio Drops Below 80",
    excerpt: "The gold/silver ratio has compressed to 78.5, signaling potential silver outperformance. MCX Silver futures show momentum building above ₹72,000/kg. Key levels to watch.",
    category: "silver",
    author: "Research Team",
    date: "2026-08-25",
    readTime: "4 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=450&fit=crop",
  },
  {
    slug: "crude-oil-inventory-draw-bullish",
    title: "Crude Oil Rally Continues on Inventory Draw — MCX Targets ₹8,200",
    excerpt: "API reported a larger-than-expected crude inventory draw of 4.2M barrels. MCX Crude Oil futures broke above ₹7,800 resistance. Our strategy shows TGT1 at ₹8,050, TGT2 at ₹8,200.",
    category: "crude-oil",
    author: "Research Team",
    date: "2026-08-22",
    readTime: "4 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1559526324-4f035d45e00b?w=800&h=450&fit=crop",
  },
  {
    slug: "risk-management-stop-loss-placement",
    title: "Stop Loss Placement: ATR-Based vs Fixed Percentage",
    excerpt: "Why fixed percentage stops fail in volatile markets. How BullionAI uses ATR (Average True Range) to set dynamic stop losses that adapt to market conditions — with real MCX examples.",
    category: "trading-education",
    author: "Education Team",
    date: "2026-08-20",
    readTime: "7 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
  },
  {
    slug: "trend-alignment-rsi-momentum",
    title: "Trend Alignment & Confirmation: Why Combined Indicators Reduce False Signals",
    excerpt: "Trading against the prevailing trend is a common error. Our engine aligns RSI momentum, MACD and Supertrend bias before triggering — here's how it filters noise and false signals.",
    category: "trading-education",
    author: "Education Team",
    date: "2026-08-18",
    readTime: "6 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=450&fit=crop",
  },
  {
    slug: "v2-0-release-push-notifications",
    title: "BullionAI v2.0: Push Notifications, Dark Mode Terminal, Mobile Redesign",
    excerpt: "Major platform update: real-time browser push alerts for watchlist signals, redesigned mobile terminal with bottom navigation, enhanced chart rendering, and IST timezone fixes.",
    category: "platform-updates",
    author: "Product Team",
    date: "2026-08-15",
    readTime: "3 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1559526324-4f035d45e00b?w=800&h=450&fit=crop",
  },
  {
    slug: "mcx-gold-signal-accuracy-q2",
    title: "MCX Gold Signal Accuracy: Q2 2026 Performance Review",
    excerpt: "Transparent look at our MCX Gold signals for April–June 2026. 68% win rate, 1.8:1 risk-reward, max drawdown 4.2%. Full trade log with SHA-256 verification hashes.",
    category: "gold",
    author: "Research Team",
    date: "2026-07-10",
    readTime: "8 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
  },
  {
    slug: "nifty-banknifty-correlation-trading",
    title: "NIFTY & Bank NIFTY Correlation: Pair Trading Opportunities",
    excerpt: "When NIFTY and Bank NIFTY diverge, mean-reversion opportunities emerge. Our analysis of 200+ divergence events and how to structure defined-risk pair trades on NSE F&O.",
    category: "trading-education",
    author: "Research Team",
    date: "2026-07-05",
    readTime: "9 min",
    featured: false,
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=450&fit=crop",
  },
];
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

const featuredArticle = ARTICLES.find(a => a.featured)!;
const regularArticles = ARTICLES.filter(a => !a.featured);

function CategoryBadge({ category }: { category: typeof CATEGORIES[0] }) {
  const Icon = category.icon;
  return (
    <Link to={`/blog?category=${category.slug}`} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${category.bg} border border-transparent hover:border-amber-200 transition`}>
      <Icon className={`h-3 w-3 ${category.color}`} />
      <span className="text-[11px] font-bold uppercase tracking-wider">{category.name}</span>
    </Link>
  );
}

function ArticleCard({ article, variant = "default" }: { article: typeof ARTICLES[0]; variant?: "featured" | "default" }) {
  const cat = CATEGORIES.find(c => c.slug === article.category)!;

  if (variant === "featured") {
    return (
      <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="absolute inset-0">
          <img src={article.image} alt="" className="h-full w-full object-cover opacity-15" loading="eager" />
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <CategoryBadge category={cat} />
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Calendar className="h-3 w-3" /> {formatDate(article.date)}
              <span className="mx-1">·</span>
              <Clock className="h-3 w-3" /> {article.readTime}
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight max-w-2xl">{article.title}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600 max-w-xl">{article.excerpt}</p>
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{article.author.charAt(0)}</span>
              </div>
              <span className="text-[12px] font-medium text-slate-700">{article.author}</span>
            </div>
            <Link to={`/blog/${article.slug}`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-dark">
              Read More <ArrowRight className="h-3.5 w-3.5" />
            </Link>
        </div>
      </div>
    </article>
  );
}

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-amber-300 hover:shadow-lg">
      <div className="aspect-video relative overflow-hidden">
        <img src={article.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute top-3 left-3">
          <CategoryBadge category={cat} />
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(article.date)}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {article.readTime}</span>
        </div>
        <h3 className="font-display text-[16px] font-bold leading-tight line-clamp-2">{article.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500 line-clamp-2">{article.excerpt}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{article.author.charAt(0)}</span>
            </div>
            <span className="text-[11px] font-medium text-slate-600">{article.author}</span>
          </div>
          <Link to={`/blog/${article.slug}`} className="text-[12px] font-semibold text-accent hover:text-accent-dark flex items-center gap-1">
            Read <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            Market Intelligence
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Insights & Market Analysis
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 max-w-2xl mx-auto">
            Deep-dive analysis on Gold, Silver, Crude Oil, and equity markets. Trading education, strategy breakdowns, and platform updates — all from the BullionAI research desk.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 border-y border-slate-200/50">
        <div className="flex flex-wrap gap-3 justify-center" role="group" aria-label="Blog categories">
          {CATEGORIES.map((cat) => (
            <CategoryBadge key={cat.slug} category={cat} />
          ))}
        </div>
      </section>

      {/* Featured Article */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <ArticleCard article={featuredArticle} variant="featured" />
      </section>

      {/* Latest Articles */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 bg-slate-50/50">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl font-bold tracking-tight">Latest Articles</h2>
          <Link to="/blog" className="text-[13px] font-semibold text-accent hover:text-accent-dark flex items-center gap-1">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {regularArticles.slice(0, 6).map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="rounded-3xl bg-navy p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Get Market Insights Delivered</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-200 max-w-xl mx-auto">
            Weekly analysis on Gold, Silver, Crude Oil, and NSE/BSE markets. No spam. Unsubscribe anytime.
          </p>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row items-center justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 outline-none focus:border-accent-light focus:bg-white/15"
              required
            />
            <button type="submit" className="gold-cta flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold whitespace-nowrap">
              Subscribe
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-3 text-[11px] text-slate-500">By subscribing, you agree to our <a href="/privacy" className="underline hover:text-amber-400">Privacy Policy</a>.</p>
        </div>
      </section>
    </div>
  );
}

// Individual Article Page Component
export function BlogArticlePage({ article }: { article: typeof ARTICLES[0] }) {
  const cat = CATEGORIES.find(c => c.slug === article.category)!;

  useEffect(() => {
    const url = `https://bullionai.digitalmavens.in/blog/${article.slug}`;
    const articleJsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": article.title,
      "description": article.excerpt,
      "image": article.image,
      "author": { "@type": "Organization", "name": "BullionAI" },
      "publisher": { "@type": "Organization", "name": "BullionAI", "logo": { "@type": "ImageObject", "url": "https://bullionai.digitalmavens.in/favicon.svg" } },
      "datePublished": article.date,
      "dateModified": article.date,
      "mainEntityOfPage": url,
      "articleSection": cat.name,
    };
    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bullionai.digitalmavens.in/" },
        { "@type": "ListItem", "position": 2, "name": "Insights", "item": "https://bullionai.digitalmavens.in/blog" },
        { "@type": "ListItem", "position": 3, "name": article.title, "item": url },
      ],
    };
    const script1 = document.createElement("script");
    script1.type = "application/ld+json";
    script1.text = JSON.stringify(articleJsonLd);
    const script2 = document.createElement("script");
    script2.type = "application/ld+json";
    script2.text = JSON.stringify(breadcrumbJsonLd);
    document.head.appendChild(script1);
    document.head.appendChild(script2);
    return () => {
      script1.remove();
      script2.remove();
    };
  }, [article, cat.name]);


  const content = `
    <h2>Market Context</h2>
    <p>MCX Gold futures have been consolidating in a tight range between ₹59,200 and ₹60,000 for the past three weeks. Yesterday's session saw a decisive break above the ₹60,000 psychological resistance level on above-average volume.</p>
    
    <h2>Technical Analysis</h2>
    <p>Our AI engine combines multiple technical inputs before generating a signal:</p>
    <ul>
      <li><strong>Trend:</strong> EMA 20/50 bullish crossover confirmed; price above the long-term EMA</li>
      <li><strong>Momentum:</strong> RSI at 62 (strong but not overbought); MACD histogram turning positive</li>
      <li><strong>Direction:</strong> Higher high / higher low structure intact; Supertrend flipped bullish</li>
      <li><strong>Volume:</strong> Bullish engulfing candle with volume spike 2.3x the average</li>
    </ul>
    
    <h2>Signal Generated</h2>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; font-family: monospace;">
      <div><strong>Signal:</strong> BUY</div>
      <div><strong>Entry:</strong> ₹59,850</div>
      <div><strong>Stop Loss:</strong> ₹59,450 (ATR-based, 1.5x)</div>
      <div><strong>Target 1:</strong> ₹60,500</div>
      <div><strong>Target 2:</strong> ₹61,200</div>
      <div><strong>Risk:Reward:</strong> 1:1.6 / 1:3.2</div>
      <div><strong>Confidence:</strong> HIGH</div>
    </div>
    
    <h2>Risk Factors</h2>
    <p>Key risk events this week: US CPI data (Wednesday), FOMC minutes (Wednesday), India CPI (Friday). Gold typically reacts to USD Index moves and real yields. Position sizing should account for event volatility.</p>
    
    <h2>Trade Management</h2>
    <p>Per BullionAI strategy rules: When Target 1 (₹60,500) is achieved, the stop loss moves to breakeven + ₹200. Target 2 remains active. If price retraces to SL before T1, the trade is closed for a small loss. Maximum risk per trade: 2% of allocated capital.</p>
    
    <h2>Disclaimer</h2>
    <p><em>This analysis is for informational purposes only and does not constitute financial advice. Trading futures and options involves substantial risk of loss. Past performance is not indicative of future results. Consult a SEBI-registered investment advisor before making trading decisions.</em></p>
  `;

  return (
    <article className="min-h-screen bg-white">
      <header className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-700 mb-6 inline-block">
          <span>←</span> Back to Insights
        </Link>
        <div className="flex items-center gap-2 mb-4">
          <CategoryBadge category={cat} />
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Calendar className="h-3 w-3" /> {formatDate(article.date)}
            <span className="mx-1">·</span>
            <Clock className="h-3 w-3" /> {article.readTime}
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{article.title}</h1>
        <div className="mt-4 flex items-center gap-4 text-[13px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{article.author.charAt(0)}</span>
            </div>
            <span className="font-medium text-slate-700">{article.author}</span>
          </div>
          <span>·</span>
          <span>BullionAI Research</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <img src={article.image} alt="" className="w-full h-auto rounded-2xl" loading="eager" />
        
        <div className="mt-8 prose prose-slate max-w-none text-[14px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: content }} />
        
        {/* Share & Related */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-[15px] font-bold">Share this article</h3>
            <div className="flex items-center gap-2">
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="Share on Twitter">𝕏</a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="Share on LinkedIn">in</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(article.title + " " + window.location.href)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700" aria-label="Share on WhatsApp">WhatsApp</a>
            </div>
          </div>
          
          <h3 className="font-display text-[15px] font-bold mb-4">Related Articles</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {regularArticles.filter(a => a.category === article.category).slice(0, 2).map((related) => (
              <Link key={related.slug} to={`/blog/${related.slug}`} className="rounded-xl border border-slate-200 p-4 hover:border-amber-300 transition">
                <p className="font-medium text-slate-800 line-clamp-2">{related.title}</p>
                <p className="mt-1 text-[12px] text-slate-500">{formatDate(related.date)} · {related.readTime}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function BlogArticleRoute() {
  const { slug } = useParams<{ slug: string }>();
  const article = ARTICLES.find(a => a.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="font-display text-2xl font-bold">Article Not Found</h1>
          <p className="mt-2 text-[13px] text-slate-500">The article you're looking for doesn't exist or has been moved.</p>
          <Link to="/blog" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-slate-400">
            {"<"} Back to Insights
          </Link>
        </div>
      </div>
    );
  }

  return <BlogArticlePage article={article} />;
}