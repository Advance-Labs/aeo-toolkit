import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/** Routes the site wants indexed, with crawl-priority hints. The landing page is the entry point; */
/** every tool page doubles as the ranking/answer page for its primary keyword. */
const ROUTES: ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/tools/audit', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/tools/eeat', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/tools/llms-txt', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/tools/chat', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/tools/graph', changeFrequency: 'weekly', priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/$/, '');
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
