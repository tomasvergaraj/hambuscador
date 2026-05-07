"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { IconCurrentLocation } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

import type { Place } from "@/types/place";

type Feature = {
  type: "Feature";
  properties: { id: string; name: string; comuna: string; href: string; rating: number };
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
      },
      geometry: { type: "Point" as const, coordinates: [p.coords.lng, p.coords.lat] },
    }));
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

      map.on("load", () => {
        if (!map) return;

        // Forzamos resize cuando el style termina de cargar — defensivo
        // contra container size pendiente de aplicarse.
        map.resize();

        map.addSource("places", {
          type: "geojson",
          data: { type: "FeatureCollection", features: initialFeatures },
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        });
        sourceReadyRef.current = true;

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#1F1B17",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              10,
              22,
              50,
              28,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#F5EFE6",
          },
        });

        // Cluster count: con OSM raster no hay glyphs disponibles, usamos un
        // text-font genérico que MapLibre puede ignorar sin romper el render.
        if (USE_PMTILES) {
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "places",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Noto Sans Regular"],
              "text-size": 12,
            },
            paint: {
              "text-color": "#F5EFE6",
            },
          });
        }

        map.addLayer({
          id: "pins",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#E8A02C",
            "circle-radius": 10,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#1F1B17",
          },
        });

        map.on("click", "pins", (e) => {
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
        });

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

        for (const layer of ["pins", "clusters"]) {
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
  // EFFECT 2: pins-update. Cada vez que cambia `places` (filtros, búsqueda),
  // sólo actualiza el GeoJSON source. El map instance + tiles + viewport se
  // mantienen — sin parpadeo.
  // ============================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const features = buildFeatures(places);
    const apply = () => {
      const source = map.getSource("places") as
        | import("maplibre-gl").GeoJSONSource
        | undefined;
      if (!source) return;
      source.setData({ type: "FeatureCollection", features });
    };
    if (sourceReadyRef.current) {
      apply();
    } else {
      // El init aún no terminó de instalar la source. Esperamos al load del map.
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
