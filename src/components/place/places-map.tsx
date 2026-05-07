"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";

import type { Place } from "@/types/place";

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

export function PlacesMap({ places }: { places: Place[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: import("maplibre-gl").Map | null = null;
    let aborted = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;

      if (aborted || !containerRef.current) return;

      // Registrar protocolo PMTiles solo si vamos a usarlo
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

      const features = places
        .filter(
          (p) =>
            Number.isFinite(p.coords.lat) && Number.isFinite(p.coords.lng),
        )
        .map((p) => ({
          type: "Feature" as const,
          properties: {
            id: p.id,
            name: p.name,
            comuna: p.comunaLabel,
            href: `/${p.comuna}/${p.slug}`,
            rating: p.rating,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [p.coords.lng, p.coords.lat],
          },
        }));

      map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center:
          (features[0]?.geometry.coordinates as [number, number]) ??
          CHILE_CENTER,
        zoom: features.length > 0 ? 12 : 5,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      map.on("load", () => {
        if (!map) return;

        map.addSource("places", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        });

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

          new maplibregl.Popup({ offset: 16, closeButton: false })
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family: var(--font-geist), system-ui; padding: 4px 2px; min-width: 140px;">
                 <div style="font-weight: 600; color: #1F1B17; font-size: 13px;">${escapeHtml(props.name)}</div>
                 <div style="color: #6E5F4F; font-size: 11px; margin-top: 2px;">★ ${props.rating.toFixed(1)} · ${escapeHtml(props.comuna)}</div>
                 <a href="${props.href}" style="display: inline-block; margin-top: 6px; color: #C84B31; font-size: 11px; font-weight: 500;">ver ficha →</a>
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

        if (features.length > 1) {
          const bounds = new maplibregl.LngLatBounds();
          for (const f of features) {
            bounds.extend(f.geometry.coordinates as [number, number]);
          }
          map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
        }
      });
    })();

    return () => {
      aborted = true;
      map?.remove();
      map = null;
    };
  }, [places]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-200px)] min-h-100 rounded-xl overflow-hidden border border-crema-edge"
      role="application"
      aria-label="mapa de hamburgueserías"
    />
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
