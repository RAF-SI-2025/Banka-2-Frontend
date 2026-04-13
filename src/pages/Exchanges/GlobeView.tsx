import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { Clock, TrendingUp, Landmark } from 'lucide-react';
import type { Exchange } from '@/types/celina3';
import { useTheme } from '@/context/ThemeContext';

/** Geographic coordinates for each supported exchange. */
const EXCHANGE_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  NYSE:    { lat: 40.7069, lng: -74.0113, city: 'New York, SAD' },
  NASDAQ:  { lat: 40.7580, lng: -73.9855, city: 'New York, SAD' },
  CME:     { lat: 41.8780, lng: -87.6298, city: 'Chicago, SAD' },
  LSE:     { lat: 51.5156, lng: -0.0919,  city: 'London, UK' },
  XETRA:   { lat: 50.1109, lng: 8.6821,   city: 'Frankfurt, Nemacka' },
  BELEX:   { lat: 44.8125, lng: 20.4612,  city: 'Beograd, Srbija' },
};

interface PointData {
  lat: number;
  lng: number;
  size: number;
  color: string;
  exchange: Exchange;
  city: string;
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
}

/** Parse "HH:mm" into minutes-since-midnight. */
function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Format minutes remaining as "Xh Ym". */
function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 0) return '-';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Compute local time + time remaining until next state change for an exchange. */
function computeStatus(exchange: Exchange, now: Date): {
  localTime: string;
  status: 'OPEN' | 'CLOSED';
  remaining: string;
  remainingLabel: string;
} {
  let localDate: Date;
  try {
    const formatter = new Intl.DateTimeFormat('sr-RS', {
      timeZone: exchange.timeZone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const localStr = formatter.format(now);
    localDate = new Date(`1970-01-01T${localStr}:00`);
  } catch {
    localDate = now;
  }

  const localMinutes = localDate.getHours() * 60 + localDate.getMinutes();
  const openMinutes = parseTime(exchange.openTime);
  const closeMinutes = parseTime(exchange.closeTime);

  const isOpen = exchange.currentlyOpen ?? exchange.isCurrentlyOpen ?? exchange.isOpen ?? false;
  const status: 'OPEN' | 'CLOSED' = isOpen ? 'OPEN' : 'CLOSED';

  let remainingMinutes: number;
  let remainingLabel: string;
  if (isOpen) {
    remainingMinutes = closeMinutes - localMinutes;
    if (remainingMinutes < 0) remainingMinutes += 24 * 60;
    remainingLabel = 'Zatvara se za';
  } else {
    remainingMinutes = openMinutes - localMinutes;
    if (remainingMinutes < 0) remainingMinutes += 24 * 60;
    remainingLabel = 'Otvara se za';
  }

  return {
    localTime: `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`,
    status,
    remaining: formatDuration(remainingMinutes),
    remainingLabel,
  };
}

/**
 * Compute sun direction vector in world space based on current UTC time.
 * Approximation: ignores Earth tilt subtleties but accounts for seasonal declination.
 */
function getSunDirection(date: Date): THREE.Vector3 {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  // Subsolar longitude: at 12:00 UTC sun is over Greenwich (0°), moves westward 15°/hour
  const sunLng = -((utcHours - 12) * 15);

  // Day of year for declination calculation
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  // Earth axial tilt 23.45°, day 80 ≈ March 21 equinox
  const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 80) * Math.PI / 180);

  // Convert lat/lng to 3D unit vector (matching three-globe coord system)
  const latRad = declination * Math.PI / 180;
  const lngRad = sunLng * Math.PI / 180;
  return new THREE.Vector3(
    Math.cos(latRad) * Math.sin(lngRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.cos(lngRad)
  ).normalize();
}

const dayNightVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const dayNightFragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;
    float intensity = dot(normalize(vWorldNormal), normalize(sunDirection));
    // Smooth twilight band: -0.15 (deep night) to 0.25 (full day)
    float dayMix = smoothstep(-0.15, 0.25, intensity);
    // Boost night side a touch so city lights stay visible
    nightColor *= 1.4;
    vec3 color = mix(nightColor, dayColor, dayMix);
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface Props {
  exchanges: Exchange[];
}

export default function GlobeView({ exchanges }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hoveredPoint, setHoveredPoint] = useState<PointData | null>(null);

  // Day/night shader material — loads textures once and exposes sunDirection uniform
  const dayNightMaterial = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const dayTex = loader.load('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const nightTex = loader.load('//unpkg.com/three-globe/example/img/earth-night.jpg');
    return new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTex },
        nightTexture: { value: nightTex },
        sunDirection: { value: getSunDirection(new Date()) },
      },
      vertexShader: dayNightVertexShader,
      fragmentShader: dayNightFragmentShader,
    });
  }, []);

  // Update sun position every 30 seconds (sun moves ~7.5° per 30 min, so 30s is plenty smooth)
  useEffect(() => {
    const update = () => {
      dayNightMaterial.uniforms.sunDirection.value = getSunDirection(new Date());
      dayNightMaterial.uniforms.sunDirection.value.needsUpdate = true;
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [dayNightMaterial]);

  // Update every second for live countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Responsive size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: Math.min(rect.width * 0.75, 600) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Setup globe controls + pause auto-rotate on user interaction
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls() as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
      minDistance: number;
      maxDistance: number;
      addEventListener: (event: string, handler: () => void) => void;
      removeEventListener: (event: string, handler: () => void) => void;
    } | null;
    if (!controls) return;

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom = true;
    controls.minDistance = 200;
    controls.maxDistance = 600;

    let resumeTimeout: ReturnType<typeof setTimeout> | null = null;
    const onStart = () => {
      controls.autoRotate = false;
      if (resumeTimeout) clearTimeout(resumeTimeout);
    };
    const onEnd = () => {
      if (resumeTimeout) clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(() => { controls.autoRotate = true; }, 5000);
    };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);

    // Focus on Europe (between NYSE and Asia)
    globeRef.current.pointOfView({ lat: 25, lng: 10, altitude: 2.5 }, 0);

    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      if (resumeTimeout) clearTimeout(resumeTimeout);
    };
  }, [size.width]);

  // Build point data — only depends on exchanges, NOT on tick (tick is for popup countdown only)
  const points: PointData[] = useMemo(() => {
    return exchanges
      .filter(e => EXCHANGE_COORDS[e.acronym])
      .map(e => {
        const coords = EXCHANGE_COORDS[e.acronym];
        const isOpen = e.currentlyOpen ?? e.isCurrentlyOpen ?? e.isOpen ?? false;
        return {
          lat: coords.lat,
          lng: coords.lng,
          size: 0.8,
          color: isOpen ? '#10b981' : '#ef4444',
          exchange: e,
          city: coords.city,
        };
      });
  }, [exchanges]);

  // Build arcs between all open exchanges (show "global market" connectivity)
  const arcs: ArcData[] = useMemo(() => {
    const openPoints = points.filter(p => p.color === '#10b981');
    const result: ArcData[] = [];
    for (let i = 0; i < openPoints.length; i++) {
      for (let j = i + 1; j < openPoints.length; j++) {
        result.push({
          startLat: openPoints[i].lat,
          startLng: openPoints[i].lng,
          endLat: openPoints[j].lat,
          endLng: openPoints[j].lng,
          color: ['#10b981', '#6366f1'],
        });
      }
    }
    return result;
  }, [points]);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const backgroundImageUrl = '//unpkg.com/three-globe/example/img/night-sky.png';

  // tick is intentionally referenced so re-renders pick up latest local time for countdown
  void tick;
  const hoverStatus = hoveredPoint ? computeStatus(hoveredPoint.exchange, new Date()) : null;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative rounded-3xl overflow-hidden border border-slate-200/80 dark:border-white/[0.08] bg-gradient-to-br from-slate-100 via-indigo-50/40 to-white dark:from-[#060a1e] dark:via-[#0a0f2e] dark:to-[#060a1e] shadow-2xl shadow-indigo-500/10"
      >
        {/* Aurora glow behind globe */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] bg-gradient-to-b from-indigo-400/20 dark:from-indigo-500/20 to-transparent rounded-full blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] bg-gradient-to-tr from-violet-400/15 dark:from-violet-500/15 to-transparent rounded-full blur-[80px]" />

        {/* Globe canvas */}
        <div className="relative flex items-center justify-center">
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            globeMaterial={dayNightMaterial}
            backgroundImageUrl={isDark ? backgroundImageUrl : ''}
            backgroundColor="rgba(0,0,0,0)"
            showAtmosphere
            atmosphereColor={isDark ? '#6366f1' : '#818cf8'}
            atmosphereAltitude={0.2}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointRadius="size"
            pointAltitude={0.02}
            pointLabel={(d) => {
              const p = d as PointData;
              return `<div style="background:rgba(15,18,45,0.95);color:white;padding:10px 14px;border-radius:10px;border:1px solid rgba(99,102,241,0.4);font-family:system-ui,sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.4);backdrop-filter:blur(10px)">
                <div style="font-weight:700;font-size:13px;margin-bottom:2px">${p.exchange.name}</div>
                <div style="font-size:11px;color:#94a3b8">${p.exchange.acronym} &bull; ${p.city}</div>
              </div>`;
            }}
            onPointHover={(p) => setHoveredPoint(p as PointData | null)}
            pointsMerge={false}
            arcsData={arcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcDashLength={0.6}
            arcDashGap={1.4}
            arcDashInitialGap={1}
            arcDashAnimateTime={8000}
            arcStroke={0.4}
            arcAltitudeAutoScale={0.4}
          />
        </div>

        {/* Stats overlay - top left */}
        <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-2">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-4 py-2 text-xs font-semibold shadow-lg">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {points.filter(p => p.color === '#10b981').length} otvorenih berzi
          </div>
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-4 py-2 text-xs font-semibold shadow-lg">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            {points.filter(p => p.color === '#ef4444').length} zatvorenih berzi
          </div>
        </div>

        {/* Instructions - top right */}
        <div className="pointer-events-none absolute top-4 right-4 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-4 py-2 text-xs text-slate-600 dark:text-slate-400 shadow-lg">
          Prevuci misem da rotiras &bull; Scroll za zoom
        </div>

        {/* Hovered exchange details - bottom */}
        {hoveredPoint && hoverStatus && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(500px,calc(100%-2rem))]">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.05] backdrop-blur-xl p-5 shadow-2xl animate-fade-up">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg ${hoverStatus.status === 'OPEN' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-red-500 to-rose-500'}`}>
                    <Landmark className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{hoveredPoint.exchange.name}</h3>
                    <p className="text-xs text-slate-500">{hoveredPoint.exchange.acronym} &bull; {hoveredPoint.city}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${hoverStatus.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30'}`}>
                  {hoverStatus.status === 'OPEN' ? 'OTVORENA' : 'ZATVORENA'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-slate-100 dark:bg-white/[0.03] p-3">
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <Clock className="h-3 w-3" />
                    Lokalno vreme
                  </div>
                  <div className="font-mono font-bold text-sm">{hoverStatus.localTime}</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-white/[0.03] p-3">
                  <div className="text-slate-500 mb-1">Radno vreme</div>
                  <div className="font-mono font-bold text-sm">{hoveredPoint.exchange.openTime}-{hoveredPoint.exchange.closeTime}</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-white/[0.03] p-3">
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    {hoverStatus.remainingLabel}
                  </div>
                  <div className={`font-mono font-bold text-sm ${hoverStatus.status === 'OPEN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    {hoverStatus.remaining}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
          Otvorena berza
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
          Zatvorena berza
        </div>
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-6 bg-gradient-to-r from-emerald-500 to-indigo-500" />
          Aktivna trgovina
        </div>
      </div>
    </div>
  );
}
