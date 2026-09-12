'use client';

/**
 * Hero instrument: an unframed node cloud filling the hero's right half — green graph
 * with a violet minority, slow orbit, damped pointer parallax; previews the Backlink
 * Graph tool.
 *
 * Data-flow layer (experiment): the mesh carries traffic. Small pulses travel the
 * nearest-neighbor links; "probe" streaks fire from outer nodes into the wireframe
 * core along tracer beams — the audit sampling its mesh of searches and prompts —
 * and each probe surfaces a mock query label at its source node (synthesized,
 * illustrative; the honest live graph lives in the tool).
 *
 * Discipline unchanged: DPR capped, rendering pauses when the tab is hidden, full
 * disposal on unmount, context loss swaps to the fallback, reduced motion renders a
 * single static frame (no pulses, no labels).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const NODE_COUNT = 520;
const LINKS_PER_NODE = 2;
const PULSE_COUNT = 110;
const PROBE_COUNT = 10;
const LABEL_COUNT = 3;

// Mock traffic — the kinds of searches and prompts the audit samples. Synthesized
// atmosphere, phrased as queries so they can't read as real analytics.
const QUERIES = [
  '“best aeo tool for saas”',
  '“why isn’t my site cited by chatgpt”',
  '“llms.txt example”',
  '“how do ai engines pick sources”',
  '“schema markup for ai overviews”',
  '“seo vs aeo”',
  '“is my site crawlable by claude”',
  '“e-e-a-t checklist”',
  'prompt · “recommend a crm”',
  'prompt · “top analytics tools”',
  'prompt · “compare audit tools”',
  '“answer engine optimization guide”',
];

export function NodeFieldViewport(): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const labelLayer = labelLayerRef.current;
    if (!host || !labelLayer) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
    camera.position.z = 2.75;

    const group = new THREE.Group();
    scene.add(group);

    // A wider jittered shell than the framed version — the cloud is meant to fill
    // the whole half, not sit inside a card.
    const positions = new Float32Array(NODE_COUNT * 3);
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.92 + Math.random() * 0.55);
      positions.set([v.x, v.y, v.z], i * 3);
    }
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pointMat = new THREE.PointsMaterial({
      color: 0xa8f326,
      size: 0.028,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Points(pointGeo, pointMat));

    // Nearest-neighbor links.
    const linkPositions: number[] = [];
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    for (let i = 0; i < NODE_COUNT; i += 1) {
      p.fromArray(positions, i * 3);
      const nearest: Array<{ d: number; j: number }> = [];
      for (let j = 0; j < NODE_COUNT; j += 1) {
        if (j === i) continue;
        q.fromArray(positions, j * 3);
        nearest.push({ d: p.distanceToSquared(q), j });
      }
      nearest.sort((a, b) => a.d - b.d);
      for (let k = 0; k < LINKS_PER_NODE; k += 1) {
        const n = nearest[k];
        if (!n) continue;
        q.fromArray(positions, n.j * 3);
        linkPositions.push(p.x, p.y, p.z, q.x, q.y, q.z);
      }
    }
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(linkPositions, 3));
    const linkMat = new THREE.LineBasicMaterial({
      color: 0xa8f326,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.LineSegments(linkGeo, linkMat));

    // The violet minority — the Advance Labs duo.
    const accentCount = 140;
    const accentPositions = new Float32Array(accentCount * 3);
    for (let i = 0; i < accentCount; i += 1) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.92 + Math.random() * 0.55);
      accentPositions.set([v.x, v.y, v.z], i * 3);
    }
    const accentGeo = new THREE.BufferGeometry();
    accentGeo.setAttribute('position', new THREE.BufferAttribute(accentPositions, 3));
    const accentMat = new THREE.PointsMaterial({
      color: 0xb6a4fd,
      size: 0.032,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Points(accentGeo, accentMat));

    // Wire core anchors the field.
    const coreGeo = new THREE.IcosahedronGeometry(0.4, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xa8f326,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    // ── Data-flow layer ─────────────────────────────────────────────────────────
    const linkCount = linkPositions.length / 6;

    // Pulses riding the links: bright packets that respawn on a new link when they
    // reach the far end.
    const pulseLink = new Int32Array(PULSE_COUNT);
    const pulseT = new Float32Array(PULSE_COUNT);
    const pulseSpeed = new Float32Array(PULSE_COUNT);
    const pulsePositions = new Float32Array(PULSE_COUNT * 3);
    for (let i = 0; i < PULSE_COUNT; i += 1) {
      pulseLink[i] = Math.floor(Math.random() * linkCount);
      pulseT[i] = Math.random();
      pulseSpeed[i] = 0.006 + Math.random() * 0.008;
    }
    const pulseGeo = new THREE.BufferGeometry();
    const pulseAttr = new THREE.BufferAttribute(pulsePositions, 3);
    pulseAttr.setUsage(THREE.DynamicDrawUsage);
    pulseGeo.setAttribute('position', pulseAttr);
    const pulseMat = new THREE.PointsMaterial({
      color: 0xc3ff57,
      size: 0.04,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
    group.add(pulsePoints);

    // Probes: streaks fired from outer nodes into the core, each with a tracer beam
    // (source → current position) that vanishes when the probe lands.
    const probeNode = new Int32Array(PROBE_COUNT);
    const probeT = new Float32Array(PROBE_COUNT).fill(2); // >1 = idle
    const probeSpeed = new Float32Array(PROBE_COUNT);
    const probePositions = new Float32Array(PROBE_COUNT * 3);
    const beamPositions = new Float32Array(PROBE_COUNT * 6);
    const probeGeo = new THREE.BufferGeometry();
    const probeAttr = new THREE.BufferAttribute(probePositions, 3);
    probeAttr.setUsage(THREE.DynamicDrawUsage);
    probeGeo.setAttribute('position', probeAttr);
    const probeMat = new THREE.PointsMaterial({
      color: 0xd9ff85,
      size: 0.055,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Points(probeGeo, probeMat));
    const beamGeo = new THREE.BufferGeometry();
    const beamAttr = new THREE.BufferAttribute(beamPositions, 3);
    beamAttr.setUsage(THREE.DynamicDrawUsage);
    beamGeo.setAttribute('position', beamAttr);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0xc3ff57,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.LineSegments(beamGeo, beamMat));

    // Query labels: DOM chips tracking the projected screen position of a probe's
    // source node while it fires.
    type QueryLabel = { el: HTMLDivElement; node: number; life: number; ttl: number };
    const labels: QueryLabel[] = [];
    const labelPool: HTMLDivElement[] = [];
    for (let i = 0; i < LABEL_COUNT; i += 1) {
      const el = document.createElement('div');
      el.style.cssText = [
        'position:absolute',
        'left:0',
        'top:0',
        'opacity:0',
        'white-space:nowrap',
        'pointer-events:none',
        "font-family:var(--font-mono, ui-monospace, monospace)",
        'font-size:11px',
        'letter-spacing:0.08em',
        'color:rgba(216,255,150,0.85)',
        'text-shadow:0 0 12px rgba(168,243,38,0.45)',
      ].join(';');
      labelLayer.appendChild(el);
      labelPool.push(el);
    }
    let queryCursor = Math.floor(Math.random() * QUERIES.length);
    let spawnCooldown = 30;

    const worldV = new THREE.Vector3();
    const spawnProbe = (): void => {
      // Find an idle probe slot; fire it from a random outer node.
      for (let i = 0; i < PROBE_COUNT; i += 1) {
        if ((probeT[i] ?? 0) <= 1) continue;
        probeNode[i] = Math.floor(Math.random() * NODE_COUNT);
        probeT[i] = 0;
        probeSpeed[i] = 0.008 + Math.random() * 0.006;
        // Roughly every other probe carries a visible query chip.
        const el = labelPool.find((cand) => !labels.some((l) => l.el === cand));
        if (el && Math.random() < 0.55) {
          queryCursor = (queryCursor + 1) % QUERIES.length;
          el.textContent = QUERIES[queryCursor] ?? '';
          labels.push({ el, node: probeNode[i] ?? 0, life: 0, ttl: 150 });
        }
        return;
      }
    };

    const stepFlow = (): void => {
      // Pulses along links.
      for (let i = 0; i < PULSE_COUNT; i += 1) {
        let t = (pulseT[i] ?? 0) + (pulseSpeed[i] ?? 0.006);
        if (t >= 1) {
          pulseLink[i] = Math.floor(Math.random() * linkCount);
          t = 0;
        }
        pulseT[i] = t;
        const base = (pulseLink[i] ?? 0) * 6;
        pulsePositions[i * 3] =
          (linkPositions[base] ?? 0) + ((linkPositions[base + 3] ?? 0) - (linkPositions[base] ?? 0)) * t;
        pulsePositions[i * 3 + 1] =
          (linkPositions[base + 1] ?? 0) + ((linkPositions[base + 4] ?? 0) - (linkPositions[base + 1] ?? 0)) * t;
        pulsePositions[i * 3 + 2] =
          (linkPositions[base + 2] ?? 0) + ((linkPositions[base + 5] ?? 0) - (linkPositions[base + 2] ?? 0)) * t;
      }
      pulseAttr.needsUpdate = true;

      // Probes into the core (ease-in: they accelerate as the core pulls them).
      spawnCooldown -= 1;
      if (spawnCooldown <= 0) {
        spawnProbe();
        spawnCooldown = 34 + Math.floor(Math.random() * 50);
      }
      for (let i = 0; i < PROBE_COUNT; i += 1) {
        const t = probeT[i] ?? 2;
        if (t > 1) {
          probePositions.fill(0, i * 3, i * 3 + 3);
          beamPositions.fill(0, i * 6, i * 6 + 6);
          continue;
        }
        const eased = t * t;
        const n = (probeNode[i] ?? 0) * 3;
        const sx = positions[n] ?? 0;
        const sy = positions[n + 1] ?? 0;
        const sz = positions[n + 2] ?? 0;
        // Land on the core's surface (radius 0.4), not at the origin.
        const reach = 1 - eased * 0.72;
        probePositions[i * 3] = sx * reach;
        probePositions[i * 3 + 1] = sy * reach;
        probePositions[i * 3 + 2] = sz * reach;
        beamPositions[i * 6] = sx;
        beamPositions[i * 6 + 1] = sy;
        beamPositions[i * 6 + 2] = sz;
        beamPositions[i * 6 + 3] = sx * reach;
        beamPositions[i * 6 + 4] = sy * reach;
        beamPositions[i * 6 + 5] = sz * reach;
        probeT[i] = t + (probeSpeed[i] ?? 0.008);
      }
      probeAttr.needsUpdate = true;
      beamAttr.needsUpdate = true;

      // Labels track their node's projected position; fade in, hold, fade out.
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (let i = labels.length - 1; i >= 0; i -= 1) {
        const label = labels[i];
        if (!label) continue;
        label.life += 1;
        if (label.life >= label.ttl) {
          label.el.style.opacity = '0';
          labels.splice(i, 1);
          continue;
        }
        worldV.fromArray(positions, label.node * 3).applyMatrix4(group.matrixWorld).project(camera);
        const x = (worldV.x * 0.5 + 0.5) * w;
        const y = (-worldV.y * 0.5 + 0.5) * h;
        // Behind the camera, off-canvas, or too close to the right edge to fit the
        // chip: hide rather than clip mid-word.
        const visible = worldV.z < 1 && x > 8 && x < w - 220 && y > 24 && y < h - 12;
        const ramp = Math.min(label.life / 20, (label.ttl - label.life) / 30, 1);
        label.el.style.opacity = visible ? String(0.9 * ramp) : '0';
        label.el.style.transform = `translate(${Math.round(x + 10)}px, ${Math.round(y - 18)}px)`;
      }
    };
    // ────────────────────────────────────────────────────────────────────────────

    const resize = (): void => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
    const onPointer = (e: PointerEvent): void => {
      const rect = host.getBoundingClientRect();
      pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 0.5;
      pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 0.35;
    };
    const onLeave = (): void => {
      pointer.tx = 0;
      pointer.ty = 0;
    };

    let raf = 0;
    let running = false;
    const tick = (): void => {
      group.rotation.y += 0.0016;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      group.rotation.x = pointer.y;
      group.rotation.z = pointer.x * 0.4;
      group.updateMatrixWorld();
      stepFlow();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    const start = (): void => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = (): void => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVisibility = (): void => {
      if (document.hidden) stop();
      else if (!reduceMotion) start();
    };

    const onContextLost = (e: Event): void => {
      e.preventDefault();
      stop();
      setFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    if (reduceMotion) {
      // Static frame: no traffic, no labels — the still graph alone.
      renderer.render(scene, camera);
    } else {
      host.addEventListener('pointermove', onPointer);
      host.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVisibility);
      start();
    }

    return () => {
      stop();
      ro.disconnect();
      host.removeEventListener('pointermove', onPointer);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      labelPool.forEach((el) => el.remove());
      pointGeo.dispose();
      pointMat.dispose();
      linkGeo.dispose();
      linkMat.dispose();
      accentGeo.dispose();
      accentMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      probeGeo.dispose();
      probeMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div data-hero-sheet className="relative h-[420px] w-full sm:h-[500px] lg:h-[560px]">
      {/* The unframed cloud: fills the column, spills past where the card used to end. */}
      <div
        ref={hostRef}
        className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
        aria-hidden="true"
      >
        {failed ? (
          <div className="flex h-full items-center justify-center">
            <p className="v2-label">Viewport offline · graph renders in the tool</p>
          </div>
        ) : null}
      </div>
      {/* Mock query chips riding the probes — decorative, synthesized. The layer must
          not eat pointer events, or the canvas parallax beneath it goes dead. */}
      <div
        ref={labelLayerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
    </div>
  );
}
