"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";

// ============================================================================
// PinPickerMap — mini-mapa con un marker draggable. Usa la misma estrategia
// de tiles que `<PlacesMap />` (PMTiles si está seteado, OSM raster sino).
//
// Se le pasa lat/lng controlados desde fuera; cuando el usuario arrastra el
// pin se dispara `onChange` con las nuevas coords.
// ============================================================================

const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL ?? "";
const USE_PMTILES = PMTILES_URL.length > 0;

const PROTOMAPS_FONTS_URL =
  "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const PROTOMAPS_SPRITE_URL =
  "https://protomaps.github.io/basemaps-assets/sprites/v4/light";

let pmtilesRegistered = false;

type Props = {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  zoom?: number;
};

export function PinPickerMap({ lat, lng, onChange, zoom = 16 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);

  // Init mapa una vez
  useEffect(() => {
    if (!containerRef.current) return;

    let aborted = false;

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

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center: [lng, lat],
        zoom,
      });
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      mapRef.current = map;

      const marker = new maplibregl.Marker({
        color: "#E8A02C",
        draggable: true,
      })
        .setLngLat([lng, lat])
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onChange(ll.lat, ll.lng);
      });
      markerRef.current = marker;
    })();

    return () => {
      aborted = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Solo init una vez; lat/lng/onChange los sincronizamos en otro effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando lat/lng cambian desde fuera (autocomplete eligió otra dirección),
  // movemos el marker y centramos el mapa.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    marker.setLngLat([lng, lat]);
    map.easeTo({ center: [lng, lat], duration: 400 });
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="w-full h-48 rounded-md overflow-hidden border border-crema-edge"
      role="application"
      aria-label="ajustar ubicación del local"
    />
  );
}
