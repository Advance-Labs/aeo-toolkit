import type { Crumb } from '@/lib/seo';

/**
 * Visible breadcrumb trail (`Home / Tools / {tool}`). Renders the same trail used to build the
 * page's `BreadcrumbList` JSON-LD, so the visible structure matches the markup — Google expects
 * structured-data breadcrumbs to reflect an on-page breadcrumb. The final crumb is the current
 * page and is not linked. Colors use `slate-400` to clear WCAG AA contrast on the dark theme.
 */
export function Breadcrumb({ trail }: { trail: ReadonlyArray<Crumb> }): React.ReactElement {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {isLast ? (
                <span className="text-slate-300" aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <a href={crumb.path} className="transition hover:text-slate-200">
                    {crumb.name}
                  </a>
                  <span aria-hidden className="text-slate-600">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
