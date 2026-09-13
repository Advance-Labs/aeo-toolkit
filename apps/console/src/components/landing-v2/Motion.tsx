'use client';

/**
 * Landing motion system — GSAP + ScrollTrigger driven by Lenis (the sole smooth-scroll
 * engine). v6 adds the storytelling layer: a pinned, scrubbed three-line turn, a scan
 * sequence over the measure ledger, scroll-triggered score count-up, and slow parallax
 * on the narrative frames.
 *
 * Responsive contract: the pinned cinematic stage is a two-column desktop composition —
 * below lg (1024px) its stacked story content is taller than a phone viewport, so the
 * stage does not pin there. gsap.matchMedia gates it: desktop gets the zoom/scrub
 * sequence and header fold; smaller screens get the layers as ordinary sections with
 * per-line reveals and an on-enter count-up.
 *
 * Accessibility contract: under prefers-reduced-motion nothing is hidden, pinned, or
 * animated (final states render immediately); without JavaScript the markup is complete
 * — hidden/dimmed styles apply only under `html.has-motion`. Word splitting preserves
 * the accessible name (aria-label on the element, aria-hidden word spans).
 */

import { useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/** Split an element's text into masked word spans; preserves the accessible name. */
function splitWords(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? '';
  el.setAttribute('aria-label', text.trim());
  el.textContent = '';
  const words: HTMLElement[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const mask = document.createElement('span');
    mask.className = 'v2-word-mask';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'v2-word';
    inner.textContent = word;
    mask.appendChild(inner);
    el.appendChild(mask);
    el.appendChild(document.createTextNode(' '));
    words.push(inner);
  }
  return words;
}

export function Motion(): null {
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add('has-motion');

    let mm: gsap.MatchMedia | undefined;

    const ctx = gsap.context(() => {
      gsap.defaults({ ease: 'power3.out', duration: 0.85 });

      // ── Act I intro: headline words, then support, form, and the instrument.
      const heroTitle = document.querySelector<HTMLElement>('[data-hero-title]');
      const intro = gsap.timeline({ delay: 0.1 });
      if (heroTitle) {
        const words = splitWords(heroTitle);
        gsap.set(heroTitle, { visibility: 'visible' });
        intro.from(words, { yPercent: 110, duration: 0.9, stagger: 0.055, ease: 'expo.out' });
      }
      intro.from('[data-hero-sub]', { autoAlpha: 0, y: 18, duration: 0.75 }, heroTitle ? '-=0.45' : 0);
      intro.from('[data-hero-cta]', { autoAlpha: 0, y: 14, duration: 0.6 }, '-=0.5');
      intro.from(
        '[data-hero-sheet]',
        { autoAlpha: 0, y: 32, duration: 1.0, ease: 'power4.out' },
        '-=0.55',
      );

      // ── The cinematic stage. Desktop: scroll zooms past the hero while the void
      // frame surfaces; the story lines then play; the pin releases into normal
      // scrolling. Mobile: no pin — the layers stack, lines reveal on entry.
      const stage = document.querySelector<HTMLElement>('[data-stage]');
      if (stage) {
        const heroLayer = stage.querySelector<HTMLElement>('[data-stage-hero]');
        const storyLayer = stage.querySelector<HTMLElement>('[data-stage-story]');
        const lines = stage.querySelectorAll<HTMLElement>('[data-story-line]');
        const specimen = stage.querySelector<HTMLElement>('[data-story-specimen]');
        const shaderField = stage.querySelector<HTMLElement>('[data-stage-shader]');
        const scoreEl = stage.querySelector<HTMLElement>('[data-count]');

        const runCount = (vars: gsap.TweenVars | null, tl?: gsap.core.Timeline, at?: number): void => {
          if (!scoreEl) return;
          const target = Number(scoreEl.dataset.count ?? '0');
          const state = { n: 0 };
          const tween: gsap.TweenVars = {
            n: target,
            duration: 1.3,
            ease: 'none',
            onUpdate: () => {
              scoreEl.textContent = String(Math.round(state.n));
            },
            ...(vars ?? {}),
          };
          if (tl) tl.to(state, tween, at);
          else gsap.to(state, tween);
        };

        mm = gsap.matchMedia();

        // Desktop composition: the pinned two-layer zoom.
        mm.add('(min-width: 1024px)', () => {
          if (storyLayer) gsap.set(storyLayer, { autoAlpha: 0 });
          // Hover-capable devices fold the chrome once the stage releases; touch keeps
          // the header, since there is no hover to summon it back.
          const canFold = window.matchMedia('(hover: hover)').matches;
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: stage,
              // Absolute zero: the stage owns the scroll from the first wheel tick — the
              // hero never translates, it only zooms.
              start: () => 0,
              end: '+=320%',
              scrub: 0.4,
              pin: true,
              onLeave: () => {
                if (canFold) document.documentElement.classList.add('v2-header-folded');
              },
              onEnterBack: () => {
                document.documentElement.classList.remove('v2-header-folded', 'v2-header-peek');
              },
            },
          });
          if (heroLayer) {
            tl.to(
              heroLayer,
              {
                scale: 1.22,
                autoAlpha: 0,
                duration: 1.2,
                ease: 'power2.in',
                transformOrigin: '50% 42%',
              },
              0,
            );
          }
          if (shaderField) {
            tl.to(shaderField, { autoAlpha: 0, duration: 1.1, ease: 'power1.in' }, 0.1);
          }
          if (storyLayer) {
            tl.to(storyLayer, { autoAlpha: 1, duration: 1.0, ease: 'none' }, 0.2);
          }
          const lineStart = 1.25;
          const beat = 0.75;
          lines.forEach((line, i) => {
            tl.fromTo(
              line,
              { autoAlpha: 0, y: 44 },
              { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' },
              lineStart + i * beat,
            );
            if (i < lines.length - 1) {
              tl.to(line, { autoAlpha: 0.16, duration: 0.4 }, lineStart + i * beat + 0.6);
            }
          });
          if (specimen) {
            const at = lineStart + (lines.length - 1) * beat + 0.55;
            tl.fromTo(
              specimen,
              { autoAlpha: 0, xPercent: 16 },
              { autoAlpha: 1, xPercent: 0, duration: 1.2, ease: 'power2.out' },
              at,
            );
            runCount(null, tl, at + 0.3);
          }
          return () => {
            document.documentElement.classList.remove('v2-header-folded', 'v2-header-peek');
          };
        });

        // Stacked composition: the layers flow as sections; each line lands on entry.
        mm.add('(max-width: 1023.98px)', () => {
          lines.forEach((line) => {
            gsap.from(line, {
              autoAlpha: 0,
              y: 28,
              duration: 0.7,
              ease: 'power2.out',
              scrollTrigger: { trigger: line, start: 'top 86%' },
            });
          });
          if (specimen) {
            gsap.from(specimen, {
              autoAlpha: 0,
              y: 26,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: { trigger: specimen, start: 'top 85%' },
            });
          }
          runCount({
            duration: 1.2,
            ease: 'power2.out',
            scrollTrigger: { trigger: scoreEl ?? stage, start: 'top 80%', once: true },
          } as gsap.TweenVars);
        });
      }

      // ── Act II scan: rows brighten one by one as the scroll passes them.
      for (const item of gsap.utils.toArray<HTMLElement>('[data-scan-item]')) {
        ScrollTrigger.create({
          trigger: item,
          start: 'top 72%',
          onEnter: () => item.classList.add('is-scanned'),
          onLeaveBack: () => item.classList.remove('is-scanned'),
        });
      }

      // ── Act III: a score outside the stage counts up when its specimen enters.
      const looseScore = document.querySelector<HTMLElement>('[data-count]');
      if (looseScore && !looseScore.closest('[data-stage]')) {
        const target = Number(looseScore.dataset.count ?? '0');
        const state = { n: 0 };
        gsap.to(state, {
          n: target,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: { trigger: looseScore, start: 'top 80%', once: true },
          onUpdate: () => {
            looseScore.textContent = String(Math.round(state.n));
          },
        });
      }

      // ── Narrative frames: slow parallax inside their clipped figures.
      for (const img of gsap.utils.toArray<HTMLElement>('[data-parallax]')) {
        gsap.fromTo(
          img,
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: 'none',
            scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      }

      // ── Shared grammar: entry reveals and drawn rules.
      for (const el of gsap.utils.toArray<HTMLElement>('[data-reveal]')) {
        gsap.from(el, {
          autoAlpha: 0,
          y: 26,
          duration: 0.85,
          scrollTrigger: { trigger: el, start: 'top 82%' },
        });
      }
      for (const group of gsap.utils.toArray<HTMLElement>('[data-reveal-group]')) {
        gsap.from(group.querySelectorAll('[data-reveal-item]'), {
          autoAlpha: 0,
          y: 22,
          duration: 0.8,
          stagger: 0.08,
          scrollTrigger: { trigger: group, start: 'top 82%' },
        });
      }
      for (const rule of gsap.utils.toArray<HTMLElement>('[data-rule]')) {
        gsap.from(rule, {
          scaleX: 0,
          transformOrigin: 'left center',
          duration: 1.0,
          ease: 'expo.out',
          scrollTrigger: { trigger: rule, start: 'top 88%' },
        });
      }
    });

    // A thin invisible strip along the top edge: while the header is folded,
    // entering it peeks the chrome back down; leaving the header folds it again.
    const peekZone = document.createElement('div');
    peekZone.setAttribute('aria-hidden', 'true');
    Object.assign(peekZone.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      height: '18px',
      zIndex: '60',
      pointerEvents: 'auto',
      background: 'transparent',
    });
    const onZoneEnter = (): void => {
      if (document.documentElement.classList.contains('v2-header-folded')) {
        document.documentElement.classList.add('v2-header-peek');
      }
    };
    const headerEl = document.querySelector<HTMLElement>('body > header');
    const onHeaderLeave = (): void => {
      document.documentElement.classList.remove('v2-header-peek');
    };
    peekZone.addEventListener('pointerenter', onZoneEnter);
    headerEl?.addEventListener('pointerleave', onHeaderLeave);
    document.body.appendChild(peekZone);

    // Lenis through the GSAP ticker — one clock, ScrollTrigger stays synced.
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number): void => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onLoad = (): void => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    return () => {
      window.removeEventListener('load', onLoad);
      peekZone.removeEventListener('pointerenter', onZoneEnter);
      document.querySelector('body > header')?.removeEventListener('pointerleave', onHeaderLeave);
      peekZone.remove();
      document.documentElement.classList.remove('v2-header-folded', 'v2-header-peek');
      gsap.ticker.remove(tick);
      lenis.destroy();
      mm?.revert();
      ctx.revert();
      document.documentElement.classList.remove('has-motion');
    };
  }, []);

  return null;
}
