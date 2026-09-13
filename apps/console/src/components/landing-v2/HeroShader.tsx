'use client';

/**
 * Animated hero background: ruucm/shadergradient rendering a slow purple-and-green
 * field in the system's exact tones (#7C3AED violet, #A8F326 signal, near-black base),
 * sitting behind the hero content under a dark contrast overlay.
 *
 * Client-only (r3f), loaded dynamically so it never renders on the server; under
 * prefers-reduced-motion it renders nothing and the static backdrop stands in.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ShaderGradientCanvas = dynamic(
  () => import('shadergradient').then((m) => m.ShaderGradientCanvas),
  { ssr: false },
);
const ShaderGradient = dynamic(() => import('shadergradient').then((m) => m.ShaderGradient), {
  ssr: false,
});

/** Built with the shadergradient customizer, colors pinned to the v2 tokens. */
const GRADIENT_URL =
  'https://www.shadergradient.co/customize?animate=on&axesHelper=off&brightness=1&cAzimuthAngle=180&cDistance=3.9&cPolarAngle=115&cameraZoom=1&color1=%230a0a0b&color2=%237c3aed&color3=%23a8f326&destination=onCanvas&embedMode=off&envPreset=dawn&format=gif&fov=45&frameRate=10&gizmoHelper=hide&grain=on&lightType=3d&pixelDensity=1&positionX=-0.5&positionY=0.1&positionZ=0&range=disabled&rangeEnd=40&rangeStart=0&reflection=0.1&rotationX=0&rotationY=0&rotationZ=235&shader=defaults&type=waterPlane&uAmplitude=0&uDensity=1.1&uFrequency=5.5&uSpeed=0.13&uStrength=2.4&uTime=0.2&wireframe=false';

export function HeroShader(): React.ReactElement | null {
  const [enabled, setEnabled] = useState(false);
  // Bumped when the browser evicts our WebGL context (tab-wide context cap under
  // heavy navigation): a lost context freezes the canvas into a still of its last
  // frame, so we remount for a fresh context. After 3 losses we stop fighting.
  const [generation, setGeneration] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Desktop only: a full-stage animated shader is the single heaviest thing a phone
    // GPU could be asked to do here, and below lg the stage doesn't pin anyway — a
    // static tint (landing-v2.css) stands in on small screens.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    if (!reduce && wide) setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const hostEl = hostRef.current;
    if (!hostEl) return undefined;
    let timer = 0;
    // Capture phase: the event fires on the (dynamically mounted) canvas below us.
    const onLost = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setGeneration((g) => g + 1), 400);
    };
    hostEl.addEventListener('webglcontextlost', onLost, true);
    return () => {
      window.clearTimeout(timer);
      hostEl.removeEventListener('webglcontextlost', onLost, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {generation < 3 ? (
        <ShaderGradientCanvas
          key={generation}
          style={{ position: 'absolute', inset: 0, opacity: 0.55 }}
          pixelDensity={1}
          fov={45}
        >
          <ShaderGradient control="query" urlString={GRADIENT_URL} />
        </ShaderGradientCanvas>
      ) : (
        /* The GPU keeps evicting us — settle on a static field in the same palette. */
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.55,
            background:
              'radial-gradient(120% 90% at 85% -10%, rgba(168,243,38,0.18) 0%, transparent 55%), radial-gradient(130% 100% at 15% 110%, rgba(124,58,237,0.6) 0%, transparent 60%), linear-gradient(200deg, #101024 0%, #0a0a0b 70%)',
          }}
        />
      )}
      {/* Contrast overlay: the field stays atmosphere, the type stays readable. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,11,0.55) 0%, rgba(10,10,11,0.35) 45%, rgba(10,10,11,0.82) 100%)',
        }}
      />
    </div>
  );
}
