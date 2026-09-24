import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  Calendar,
  User,
  Eye,
  Search,
  ArrowRight,
  ArrowLeft,
  Share2,
  Tag,
  Clock,
  Sparkles,
  ChevronRight,
  Check,
  Globe,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { NewsPost } from '../types';
import { INITIAL_NEWS_POSTS } from '../constants/initialCmsData';

interface NewsViewProps {
  initialSlug?: string;
  onNavigate?: (view: string) => void;
}

export const NewsView: React.FC<NewsViewProps> = ({ initialSlug, onNavigate }) => {
  const { language, t } = useLanguage();

  const [posts, setPosts] = useState<NewsPost[]>(() => INITIAL_NEWS_POSTS);
  const [categories, setCategories] = useState<string[]>(['All', 'Event Updates', 'Campus News']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalPosts, setTotalPosts] = useState<number>(() => INITIAL_NEWS_POSTS.length);

  // Detail view state
  const [activeArticle, setActiveArticle] = useState<NewsPost | null>(null);
  const [articleLoading, setArticleLoading] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Fetch news list
  const fetchNews = async (page: number = 1, cat: string = 'All', search: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '9',
      });
      if (cat && cat !== 'All') params.append('category', cat);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/news?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotalPages(data.totalPages || 1);
        setTotalPosts(data.total || 0);
        if (data.categories && data.categories.length > 0) {
          setCategories(['All', ...data.categories]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch news posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load specific article by slug or id
  const loadArticle = async (idOrSlug: string) => {
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/news/${encodeURIComponent(idOrSlug)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveArticle(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to load article:', err);
    } finally {
      setArticleLoading(false);
    }
  };

  useEffect(() => {
    if (initialSlug) {
      loadArticle(initialSlug);
    } else {
      fetchNews(1, selectedCategory, searchQuery);
    }
  }, [initialSlug]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchNews(1, selectedCategory, searchQuery);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
    fetchNews(1, cat, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchNews(newPage, selectedCategory, searchQuery);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyLink = () => {
    if (!activeArticle) return;
    const url = `${window.location.origin}/?view=news&article=${activeArticle.slug || activeArticle.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // ARTICLE DETAIL VIEW
  if (activeArticle) {
    const title = language === 'bn' ? activeArticle.title_bn || activeArticle.title_en : activeArticle.title_en;
    const content = language === 'bn' ? activeArticle.content_bn || activeArticle.content_en : activeArticle.content_en;

    return (
      <div className="bg-slate-50 min-h-screen py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <button
              onClick={() => {
                setActiveArticle(null);
                fetchNews(currentPage, selectedCategory, searchQuery);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-700" />
              <span>{language === 'bn' ? 'সকল সংবাদে ফিরে যান' : 'Back to News & Updates'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#0f4d2a] font-bold text-xs rounded-xl border border-emerald-200 transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? (language === 'bn' ? 'লিঙ্ক কপি হয়েছে!' : 'Link Copied!') : (language === 'bn' ? 'সংবাদ শেয়ার করুন' : 'Share Article')}</span>
            </button>
          </div>

          {/* Article Container */}
          <article className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Featured Hero Image */}
            {activeArticle.featured_image && (
              <div className="relative h-64 sm:h-96 w-full bg-slate-900 overflow-hidden">
                <img
                  src={activeArticle.featured_image}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs text-white/90">
                  <span className="px-3 py-1 bg-amber-400 text-slate-950 font-bold rounded-lg uppercase tracking-wider text-[11px]">
                    {activeArticle.category || 'Reunion Update'}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium bg-slate-900/60 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{activeArticle.views || 1} {language === 'bn' ? 'বার পঠিত' : 'views'}</span>
                  </span>
                </div>
              </div>
            )}

            <div className="p-6 sm:p-10 space-y-6">
              {/* Meta information */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span>
                    {activeArticle.publish_date
                      ? new Date(activeArticle.publish_date).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Recently Published'}
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>{activeArticle.author || 'NASH Alumni Media Wing'}</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 leading-tight">
                {title}
              </h1>

              {/* Excerpt / Lead */}
              {(activeArticle.excerpt_en || activeArticle.excerpt_bn) && (
                <div className="p-4 bg-emerald-50/60 rounded-2xl border-l-4 border-emerald-600 text-slate-700 text-sm sm:text-base font-medium leading-relaxed italic">
                  {language === 'bn' ? activeArticle.excerpt_bn || activeArticle.excerpt_en : activeArticle.excerpt_en || activeArticle.excerpt_bn}
                </div>
              )}

              {/* Main Content Body */}
              <div className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line">
                {content}
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {language === 'bn' ? 'বিভাগ:' : 'Category:'}
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
                    {activeArticle.category}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('register')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f4d2a] hover:bg-[#135d34] text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{language === 'bn' ? '৮৫ বছর পূর্তিতে নিবন্ধন করুন' : 'Register for 85th Reunion'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    );
  }

  // PUBLIC NEWS LISTING VIEW
  const featuredPost = posts.find(p => p.is_featured) || posts[0];
  const regularPosts = posts.filter(p => p.id !== featuredPost?.id);

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-[#0f4d2a] text-xs font-bold uppercase tracking-wider">
            <Newspaper className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'দাপ্তরিক সংবাদ ও হালনাগাদ' : 'Official News & Announcements'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            {language === 'bn'
              ? '৮৫ বছর পূর্তি পুনর্মিলনী সংবাদ ও তথ্যপ্রবাহ'
              : '85th Anniversary News & Media Wing'}
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            {language === 'bn'
              ? 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয়ের ৮৫তম বর্ষপূর্তি ও প্রাক্তন শিক্ষার্থী পুনর্মিলনী ২০২৭ সংক্রান্ত সর্বশেষ তথ্য, অনুষ্ঠানমালা ও পরিষদ নোটিশ।'
              : 'Official real-time updates, press releases, program schedules, and batch announcements for the grand 85th reunion.'}
          </p>
        </div>

        {/* Search and Category Filter Toolbar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {(categories.length > 0 ? categories : ['All', 'Reunion Updates', 'Announcements', 'Heritage', 'Executive']).map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0f4d2a] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={language === 'bn' ? 'সংবাদ বা বিষয়বস্তু খুঁজুন...' : 'Search articles, topics...'}
              className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition cursor-pointer"
            >
              {language === 'bn' ? 'খুঁজুন' : 'Search'}
            </button>
          </form>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'bn' ? 'সংবাদ লোড করা হচ্ছে...' : 'Loading news updates from database...'}
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 space-y-3">
            <Newspaper className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {language === 'bn' ? 'কোনো সংবাদ পাওয়া যায়নি' : 'No news articles found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'bn'
                ? 'বর্তমান অনুসন্ধান বা বিভাগের অধীনে কোনো প্রকাশিত প্রতিবেদন নেই।'
                : 'No published articles match your active filter criteria. Try clearing search keywords.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  fetchNews(1, 'All', '');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {language === 'bn' ? 'ফিল্টার পরিষ্কার করুন' : 'Clear Filters'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured Article Card */}
            {featuredPost && currentPage === 1 && (
              <div
                onClick={() => loadArticle(featuredPost.slug || featuredPost.id)}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden cursor-pointer group grid grid-cols-1 lg:grid-cols-12 gap-0"
              >
                <div className="lg:col-span-7 h-64 lg:h-96 relative overflow-hidden bg-slate-900">
                  <img
                    src={featuredPost.featured_image || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80'}
                    alt={featuredPost.title_en}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-amber-400 text-slate-950 font-bold text-xs rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-slate-950" />
                      {language === 'bn' ? 'প্রধান সংবাদ' : 'Featured Story'}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-md">
                        {featuredPost.category}
                      </span>
                      <span>•</span>
                      <span>
                        {featuredPost.publish_date
                          ? new Date(featuredPost.publish_date).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Recent'}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-emerald-800 transition line-clamp-3">
                      {language === 'bn' ? featuredPost.title_bn || featuredPost.title_en : featuredPost.title_en}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-4 leading-relaxed">
                      {language === 'bn' ? featuredPost.excerpt_bn || featuredPost.excerpt_en : featuredPost.excerpt_en || featuredPost.excerpt_bn}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                    <span className="font-medium text-slate-500">
                      {featuredPost.author || 'NASH Media Wing'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-[#0f4d2a] group-hover:translate-x-1 transition-transform">
                      <span>{language === 'bn' ? 'বিস্তারিত পড়ুন' : 'Read Full Story'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Regular Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(currentPage === 1 ? regularPosts : posts).map(post => {
                const title = language === 'bn' ? post.title_bn || post.title_en : post.title_en;
                const excerpt = language === 'bn' ? post.excerpt_bn || post.excerpt_en : post.excerpt_en || post.excerpt_bn;

                return (
                  <div
                    key={post.id}
                    onClick={() => loadArticle(post.slug || post.id)}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition overflow-hidden cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail */}
                      <div className="h-48 relative overflow-hidden bg-slate-900">
                        <img
                          src={post.featured_image || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80'}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold rounded uppercase tracking-wider">
                            {post.category || 'News'}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                          <span>
                            {post.publish_date
                              ? new Date(post.publish_date).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recent'}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-800 transition line-clamp-2 leading-snug">
                          {title}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {excerpt}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500 truncate max-w-[130px]">
                        {post.author || 'Alumni Office'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 group-hover:translate-x-1 transition-transform">
                        <span>{language === 'bn' ? 'পড়ুন' : 'Read'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  {language === 'bn' ? 'পূর্ববর্তী' : 'Previous'}
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                      currentPage === p
                        ? 'bg-[#0f4d2a] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  {language === 'bn' ? 'পরবর্তী' : 'Next'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
