"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { IconCurrentLocation } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

import {
  FLY_TO_EVENT,
  type FlyToDetail,
} from "@/components/place/map-search-input";
import type { Place } from "@/types/place";

type Feature = {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    comuna: string;
    href: string;
    rating: number;
    /** Locales con publicidad activa. Render con pin tomate + glow ring. */
    featured: boolean;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
};

function buildFeatures(places: Place[]): Feature[] {
  return places
    .filter((p) => Number.isFinite(p.coords.lat) && Number.isFinite(p.coords.lng))
    .map((p) => ({
      type: "Feature" as const,
      properties: {
        id: p.id,
        name: p.name,
        comuna: p.comunaLabel,
        href: `/${p.comuna}/${p.slug}`,
        rating: p.rating,
        featured: p.isFeatured,
      },
      geometry: { type: "Point" as const, coordinates: [p.coords.lng, p.coords.lat] },
    }));
}

/**
 * Separa features en `default` y `featured`. Los featured viven en una
 * source aparte sin clustering — siempre visibles en cualquier zoom y
 * nunca quedan absorbidos en los círculos negros del cluster.
 */
function splitFeatures(features: Feature[]): { default: Feature[]; featured: Feature[] } {
  const def: Feature[] = [];
  const fea: Feature[] = [];
  for (const f of features) {
    if (f.properties.featured) fea.push(f);
    else def.push(f);
  }
  return { default: def, featured: fea };
}

// ============================================================================
// Pin icons — burger en teardrop. Dos variantes:
//   - default: borde carbon, fondo mostaza. Pin standard.
//   - featured: borde tomate + glow ring. Locales con publicidad activa
//     (places.is_featured). Tamaño un poco mayor para destacar.
// SVG inline → data URL → HTMLImageElement → map.addImage con pixelRatio 2
// para que se vea nítido en retina.
// ============================================================================

const BURGER_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="104" viewBox="0 0 40 52">
  <path d="M20 2 C9.5 2 2 9.5 2 20 C2 30 12 42 20 50 C28 42 38 30 38 20 C38 9.5 30.5 2 20 2 Z" fill="#E8A02C" stroke="#1F1B17" stroke-width="2"/>
  <circle cx="20" cy="20" r="11.5" fill="#FAF6EE"/>
  <path d="M11 16 C11 12.5 14.5 10.5 20 10.5 C25.5 10.5 29 12.5 29 16 Z" fill="#E8A02C"/>
  <ellipse cx="16" cy="13.5" rx="0.5" ry="0.7" fill="#FAF6EE"/>
  <ellipse cx="20" cy="12" rx="0.5" ry="0.7" fill="#FAF6EE"/>
  <ellipse cx="24" cy="13.5" rx="0.5" ry="0.7" fill="#FAF6EE"/>
  <path d="M11 17.5 L29 17.5 L29 18.5 Q26.5 19.5 23.5 18.5 Q20.5 19.5 17.5 18.5 Q14.5 19.5 11 18.5 Z" fill="#6B8E4E"/>
  <rect x="11" y="20" width="18" height="2.6" rx="0.5" fill="#3E2723"/>
  <path d="M11 23 L29 23 L29 25.2 C29 26.8 25 27.5 20 27.5 C15 27.5 11 26.8 11 25.2 Z" fill="#C8862A"/>
</svg>`;

const BURGER_PIN_FEATURED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="120" viewBox="0 0 48 60">
  <circle cx="24" cy="24" r="22" fill="#C84B31" opacity="0.22"/>
  <path d="M24 4 C12 4 4 12 4 23 C4 35 16 49 24 57 C32 49 44 35 44 23 C44 12 36 4 24 4 Z" fill="#C84B31" stroke="#1F1B17" stroke-width="2"/>
  <circle cx="24" cy="22" r="13" fill="#FAF6EE"/>
  <path d="M14 18 C14 14 18 11.5 24 11.5 C30 11.5 34 14 34 18 Z" fill="#E8A02C"/>
  <ellipse cx="19" cy="15" rx="0.6" ry="0.8" fill="#FAF6EE"/>
  <ellipse cx="24" cy="13.5" rx="0.6" ry="0.8" fill="#FAF6EE"/>
  <ellipse cx="29" cy="15" rx="0.6" ry="0.8" fill="#FAF6EE"/>
  <path d="M14 19 L34 19 L34 20.2 Q31 21.5 27.5 20.2 Q24 21.5 20.5 20.2 Q17 21.5 14 20.2 Z" fill="#6B8E4E"/>
  <rect x="14" y="22" width="20" height="3" rx="0.6" fill="#3E2723"/>
  <path d="M14 25.5 L34 25.5 L34 28 C34 29.8 30 30.5 24 30.5 C18 30.5 14 29.8 14 28 Z" fill="#C8862A"/>
</svg>`;

// Cluster: forma de hamburguesa con patty oscura como fondo del count.
// Comunica "muchos locales" por la propia metáfora visual + el número
// (cuando hay glyphs disponibles, ej. PMTILES). El icon-size escala con
// point_count para señalar la magnitud incluso sin texto.
const BURGER_CLUSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 56 56">
  <path d="M4 23 C4 12 12 4 28 4 C44 4 52 12 52 23 Z" fill="#E8A02C"/>
  <ellipse cx="18" cy="14" rx="0.7" ry="1" fill="#FAF6EE"/>
  <ellipse cx="28" cy="10" rx="0.7" ry="1" fill="#FAF6EE"/>
  <ellipse cx="38" cy="14" rx="0.7" ry="1" fill="#FAF6EE"/>
  <path d="M4 23 L52 23 L52 25 Q47 27 42 25 Q37 27 32 25 Q27 27 22 25 Q17 27 12 25 Q7 27 4 25 Z" fill="#6B8E4E"/>
  <rect x="4" y="25" width="48" height="11" fill="#1F1B17"/>
  <path d="M4 36 L52 36 L52 40 C52 47 44 52 28 52 C12 52 4 47 4 40 Z" fill="#C8862A"/>
  <path d="M4 23 C4 12 12 4 28 4 C44 4 52 12 52 23 L52 40 C52 47 44 52 28 52 C12 52 4 47 4 40 Z" fill="none" stroke="#1F1B17" stroke-width="2"/>
</svg>`;

function loadSvgImage(svg: string, w: number, h: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(w, h);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("svg image load failed"));
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
}

// ============================================================================
// Tile source — dos modos:
// 1. PMTiles (recomendado prod): seteá NEXT_PUBLIC_PMTILES_URL apuntando a un
//    .pmtiles propio hosteado en R2/CDN con CORS abierto. Tiles vectoriales,
//    estilo protomaps "light", peso liviano por tile.
// 2. OSM raster (default dev): tiles raster de tile.openstreetmap.org. Funciona
//    sin setup, CORS abierto, free para tráfico moderado. NO usar en prod.
//
// El demo bucket público de Protomaps NO tiene CORS abierto a localhost, por
// eso lo dejamos como opt-in via env var en vez de default.
// ============================================================================

const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL ?? "";
const USE_PMTILES = PMTILES_URL.length > 0;

const PROTOMAPS_FONTS_URL =
  "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const PROTOMAPS_SPRITE_URL =
  "https://protomaps.github.io/basemaps-assets/sprites/v4/light";

// Centro Chile / Santiago como fallback cuando no hay pins
const CHILE_CENTER: [number, number] = [-70.65, -33.45];

let pmtilesRegistered = false;

type Props = {
  places: Place[];
  /** Coords del usuario (cookie hb_geo). Si está, se renderiza como marker tomate. */
  userCoords?: { lat: number; lng: number };
  /** Override de className para el container (ej. fixed inset-0 cuando es full screen). */
  className?: string;
};

export function PlacesMap({ places, userCoords, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const sourceReadyRef = useRef(false);
  const didInitialFitRef = useRef(false);
  // Snapshot de places usado dentro del init effect — evita capturar la
  // referencia "vieja" si el effect arranca antes que el primer update.
  const placesRef = useRef(places);
  placesRef.current = places;

  // Click del botón "saltar a mi ubicación". Usa flyTo (interpolación suave)
  // y forzamos `essential: true` para que la animación corra incluso si el
  // usuario tiene reduce-motion (sino el flyTo es instantáneo).
  function flyToUser() {
    const map = mapRef.current;
    if (!map || !userCoords) return;
    map.flyTo({
      center: [userCoords.lng, userCoords.lat],
      zoom: 15,
      duration: 900,
      essential: true,
    });
  }

  // ============================================================================
  // EFFECT 1: init-once. Crea el mapa una sola vez por montaje. NO depende de
  // `places` — los pines se actualizan en effect 2. Esto evita que cada cambio
  // de filtro tire el mapa y lo reconstruya (parpadeo + flicker de tiles).
  // ============================================================================
  useEffect(() => {
    if (!containerRef.current) return;

    let map: import("maplibre-gl").Map | null = null;
    let aborted = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;

      if (aborted || !containerRef.current) return;

      if (USE_PMTILES && !pmtilesRegistered) {
        const { Protocol } = await import("pmtiles");
        const protocol = new Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);
        pmtilesRegistered = true;
      }

      const baseStyle: maplibregl.StyleSpecification = USE_PMTILES
        ? {
            version: 8,
            glyphs: PROTOMAPS_FONTS_URL,
            sprite: PROTOMAPS_SPRITE_URL,
            sources: {
              protomaps: {
                type: "vector",
                url: `pmtiles://${PMTILES_URL}`,
                attribution:
                  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
              },
            },
            layers: (await import("protomaps-themes-base")).default(
              "protomaps",
              "light",
              "es",
            ),
          }
        : {
            version: 8,
            // glyphs URL → habilita symbol text layers (cluster-count) sobre
            // tiles raster. Protomaps assets es CORS-abierto y free.
            glyphs: PROTOMAPS_FONTS_URL,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution:
                  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxzoom: 19,
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          };

      const initialFeatures = buildFeatures(placesRef.current);

      // Centro inicial: prioridad usuario > primer pin > Chile
      const initialCenter: [number, number] = userCoords
        ? [userCoords.lng, userCoords.lat]
        : (initialFeatures[0]?.geometry.coordinates as [number, number]) ?? CHILE_CENTER;
      const initialZoom = userCoords ? 14 : initialFeatures.length > 0 ? 12 : 5;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center: initialCenter,
        zoom: initialZoom,
      });
      mapRef.current = map;

      // MapLibre toma el tamaño del container al construirse. Si el container
      // todavía está midiendo (ej. layout fullscreen recién montado) el canvas
      // queda con tamaño viejo y el mapa se ve cortado. Observamos cambios
      // en el container y forzamos resize.
      const containerEl = containerRef.current;
      if (containerEl && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (map) map.resize();
        });
        resizeObserver.observe(containerEl);
      }

      // Marker de usuario — punto azul tipo "blue dot" estilo Google Maps,
      // halo translúcido afuera para que se distinga de los pins de locales.
      if (userCoords) {
        const userEl = document.createElement("div");
        userEl.setAttribute("aria-label", "tu ubicación");
        userEl.style.width = "20px";
        userEl.style.height = "20px";
        userEl.style.position = "relative";
        userEl.innerHTML = `
          <span style="
            position: absolute; inset: -10px;
            background: rgba(59, 130, 246, 0.18);
            border-radius: 50%;
          "></span>
          <span style="
            position: absolute; inset: 0;
            background: #3B82F6;
            border: 2px solid #fff;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></span>
        `;
        new maplibregl.Marker({ element: userEl })
          .setLngLat([userCoords.lng, userCoords.lat])
          .addTo(map);
      }

      map.on("load", async () => {
        if (!map) return;

        // Forzamos resize cuando el style termina de cargar — defensivo
        // contra container size pendiente de aplicarse.
        map.resize();

        // Cargamos los SVG de pin ANTES del addLayer del symbol — sino la
        // capa se renderiza vacía hasta que las imágenes existan.
        try {
          const [pin, pinFeatured, cluster] = await Promise.all([
            loadSvgImage(BURGER_PIN_SVG, 80, 104),
            loadSvgImage(BURGER_PIN_FEATURED_SVG, 96, 120),
            loadSvgImage(BURGER_CLUSTER_SVG, 112, 112),
          ]);
          if (!map.hasImage("burger-pin")) {
            map.addImage("burger-pin", pin, { pixelRatio: 2 });
          }
          if (!map.hasImage("burger-pin-featured")) {
            map.addImage("burger-pin-featured", pinFeatured, { pixelRatio: 2 });
          }
          if (!map.hasImage("burger-cluster")) {
            map.addImage("burger-cluster", cluster, { pixelRatio: 2 });
          }
        } catch {
          // Si falla la carga (CSP rara), seguimos — MapLibre dibuja un
          // missing-image placeholder pequeño y el mapa sigue usable.
        }

        // Dos sources distintos:
        //  - `places`: defaults (no destacados), con clustering. Se agrupan
        //    en círculos negros cuando son muchos en poco espacio.
        //  - `places-featured`: destacados (publicidad), SIN clustering.
        //    Siempre visibles en cualquier zoom — nunca quedan absorbidos
        //    en un cluster, así el aviso vale la pena.
        const split = splitFeatures(initialFeatures);
        map.addSource("places", {
          type: "geojson",
          data: { type: "FeatureCollection", features: split.default },
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        });
        map.addSource("places-featured", {
          type: "geojson",
          data: { type: "FeatureCollection", features: split.featured },
        });
        sourceReadyRef.current = true;

        // Cluster: symbol layer con SVG burger. icon-size escala con
        // point_count — más locales = icono más grande, comunica magnitud
        // incluso sin glyphs (OSM raster no tiene fonts).
        map.addLayer({
          id: "clusters",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: {
            "icon-image": "burger-cluster",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "step",
              ["get", "point_count"],
              0.6,
              10,
              0.78,
              50,
              0.95,
            ],
          },
        });

        // Cluster count: text overlay sobre la patty del SVG. Funciona en
        // ambos modos porque el style OSM raster también declara glyphs.
        // Halo carbon refuerza el contraste sobre la patty oscura (la patty
        // ya es carbon, pero el halo hace el número más sólido a tamaños
        // chicos donde el aliasing puede comerse el contorno).
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Regular"],
            "text-size": [
              "step",
              ["get", "point_count"],
              11,
              10,
              13,
              50,
              15,
            ],
            "text-offset": [0, 0.15],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": "#FAF6EE",
            "text-halo-color": "#1F1B17",
            "text-halo-width": 1.2,
          },
        });

        map.addLayer({
          id: "pins-default",
          type: "symbol",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": "burger-pin",
            "icon-anchor": "bottom",
            // Overlap así no desaparecen pins en zooms bajos.
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 1,
          },
        });

        // Featured va último → render encima de clusters y pins-default.
        map.addLayer({
          id: "pins-featured",
          type: "symbol",
          source: "places-featured",
          layout: {
            "icon-image": "burger-pin-featured",
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 1,
          },
        });

        const handlePinClick = (e: import("maplibre-gl").MapLayerMouseEvent) => {
          if (!map || !e.features || e.features.length === 0) return;
          const feature = e.features[0];
          if (!feature) return;
          const coords = (feature.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          const props = feature.properties as {
            name: string;
            comuna: string;
            href: string;
            rating: number;
            featured?: boolean;
          };

          new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: "240px" })
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family: var(--font-geist), system-ui; padding: 6px 4px 4px 4px; min-width: 180px;">
                 <div style="font-family: var(--font-bricolage), system-ui; font-weight: 600; color: #1F1B17; font-size: 14px; line-height: 1.2;">${escapeHtml(props.name)}</div>
                 <div style="color: #6E5F4F; font-size: 11px; margin-top: 3px;">
                   <span style="color: #1F1B17; font-weight: 500;">★ ${props.rating.toFixed(1)}</span>
                   <span style="margin: 0 4px;">·</span>${escapeHtml(props.comuna)}
                 </div>
                 <a href="${props.href}"
                    style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 10px; padding: 8px 12px; background: #E8A02C; color: #1F1B17; font-family: var(--font-bricolage), system-ui; font-weight: 600; font-size: 12px; text-decoration: none; border-radius: 8px; transition: background 0.15s;"
                    onmouseover="this.style.background='#C8862A'"
                    onmouseout="this.style.background='#E8A02C'">
                   ver ficha
                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                 </a>
               </div>`,
            )
            .addTo(map);
        };

        map.on("click", "pins-default", handlePinClick);
        map.on("click", "pins-featured", handlePinClick);

        map.on("click", "clusters", async (e) => {
          if (!map || !e.features || e.features.length === 0) return;
          const feature = e.features[0];
          if (!feature) return;
          const clusterId = feature.properties?.cluster_id as
            | number
            | undefined;
          if (clusterId === undefined) return;

          const source = map.getSource("places") as
            | import("maplibre-gl").GeoJSONSource
            | undefined;
          if (!source) return;

          const zoom = await source.getClusterExpansionZoom(clusterId);
          const coords = (feature.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          map.easeTo({ center: coords, zoom });
        });

        for (const layer of ["pins-default", "pins-featured", "clusters"]) {
          map.on("mouseenter", layer, () => {
            if (map) map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            if (map) map.getCanvas().style.cursor = "";
          });
        }

        // Si tenemos userCoords ya centramos al construir el map, no hacemos
        // fitBounds. Si no, encuadramos los pins iniciales una sola vez.
        // Cambios de filtros NO refitean (sería disruptivo: el usuario perdió
        // el pan/zoom que tenía). Para "centrar en resultados" tendría que
        // existir un botón explícito.
        const canvas = map.getCanvas();
        const hasCanvasSize = canvas.width > 0 && canvas.height > 0;
        if (!userCoords && initialFeatures.length > 1 && hasCanvasSize && !didInitialFitRef.current) {
          const bounds = new maplibregl.LngLatBounds();
          for (const f of initialFeatures) {
            bounds.extend(f.geometry.coordinates as [number, number]);
          }
          try {
            map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
            didInitialFitRef.current = true;
          } catch {
            // Defensivo: si igual el canvas estaba en transición, ignoramos
          }
        }
      });
    })();

    return () => {
      aborted = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      map?.remove();
      map = null;
      mapRef.current = null;
      sourceReadyRef.current = false;
      didInitialFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCoords?.lat, userCoords?.lng]);

  // ============================================================================
  // EFFECT 1.5: flyTo handler. Escucha `hambuscador:flyTo` (CustomEvent en
  // window) y vuela el mapa al destino. Lo dispara `<MapSearchInput>` cuando
  // el usuario selecciona un place / comuna / región del dropdown. Decoupled
  // via window event para no acoplar el input al map ref (viven en subtrees
  // distintos).
  // ============================================================================
  useEffect(() => {
    function onFlyTo(e: Event) {
      const map = mapRef.current;
      if (!map) return;
      const detail = (e as CustomEvent<FlyToDetail>).detail;
      if (!detail) return;
      map.flyTo({
        center: [detail.lng, detail.lat],
        zoom: detail.zoom,
        duration: 900,
        essential: true,
      });
    }
    window.addEventListener(FLY_TO_EVENT, onFlyTo);
    return () => window.removeEventListener(FLY_TO_EVENT, onFlyTo);
  }, []);

  // ============================================================================
  // EFFECT 2: pins-update. Cada vez que cambia `places` (filtros, búsqueda),
  // sólo actualiza el GeoJSON source. El map instance + tiles + viewport se
  // mantienen — sin parpadeo.
  // ============================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const split = splitFeatures(buildFeatures(places));
    const apply = () => {
      const defaultSrc = map.getSource("places") as
        | import("maplibre-gl").GeoJSONSource
        | undefined;
      const featuredSrc = map.getSource("places-featured") as
        | import("maplibre-gl").GeoJSONSource
        | undefined;
      if (defaultSrc) {
        defaultSrc.setData({ type: "FeatureCollection", features: split.default });
      }
      if (featuredSrc) {
        featuredSrc.setData({ type: "FeatureCollection", features: split.featured });
      }
    };
    if (sourceReadyRef.current) {
      apply();
    } else {
      // El init aún no terminó de instalar las sources. Esperamos al load.
      map.once("load", apply);
    }
  }, [places]);

  // Si nos pasan className, asumimos que el padre controla el posicionamiento
  // (caso fullscreen). Sino, usamos el wrapper redondeado embebido.
  // En cualquier caso, el div ref={containerRef} tiene 100% width/height por
  // inline style — sino MapLibre's `.maplibregl-map { position: relative }`
  // pisa nuestras clases Tailwind y el container colapsa a 0 dentro de un
  // flex parent.
  if (className) {
    // `className` ya incluye `absolute` (caso fullscreen) que establece
    // contexto de posicionamiento para el botón "locate me". No agregar
    // `relative` acá: Tailwind generaría ambas position utilities y el
    // orden de cascada puede flipear a relative, rompiendo el fullscreen.
    return (
      <div className={className}>
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%" }}
          role="application"
          aria-label="mapa de hamburgueserías"
        />
        {userCoords ? <LocateMeButton onClick={flyToUser} /> : null}
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-200px)] min-h-100 rounded-xl overflow-hidden border border-crema-edge relative">
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        role="application"
        aria-label="mapa de hamburgueserías"
      />
      {userCoords ? <LocateMeButton onClick={flyToUser} /> : null}
    </div>
  );
}

/**
 * Botón flotante "saltar a mi ubicación". Posicionado justo arriba de los
 * zoom controls de MapLibre. Animación de press + ping cuando se aprieta.
 */
function LocateMeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="ir a mi ubicación"
      className="group absolute right-3 bottom-24 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white shadow-md border border-crema-edge text-carbon hover:bg-crema-deep transition-[transform,colors,box-shadow] duration-150 active:scale-90 hover:shadow-lg"
    >
      <IconCurrentLocation
        size={20}
        stroke={1.75}
        aria-hidden="true"
        className="transition-transform duration-150 group-active:rotate-[-15deg]"
      />
    </button>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
