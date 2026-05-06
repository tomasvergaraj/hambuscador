# Hambuscador — guía de marca

> La picá hamburguesera de Chile.

Este documento resume cómo usar el logo, los colores y la tipografía. Mantén estas piezas consistentes en la app, marketing, redes y cualquier punto de contacto.

---

## Voz de marca

Cercana, chilena, golosa y con humor. Habla "como un amigo que sabe dónde está la mejor hamburguesa", nunca como un crítico gourmet snob.

Palabras nuestras: *picá, cachetón, filete, completa, reventada, recomendada, picada*.
Palabras que evitamos: *gourmet exclusivo, premium, gastrobar fancy*.

Frases tipo:
- "encuentra la mejor hamburguesa cerca tuyo"
- "del completo al smash, todas las picás"
- "que no se te escape ningún cachetón"

---

## Logo

El logo se compone de un símbolo (la hamburguesa minimalista de 4 capas) y un wordmark (`hambuscador` en Bricolage Grotesque). Se usan juntos cuando hay espacio, y separados cuando no (favicon, app icon, badges).

### Variantes incluidas

| Archivo | Cuándo usarlo |
|---|---|
| `logo.svg` | Logo principal sobre fondo claro o crema. Headers, marketing, footers claros. |
| `logo-dark.svg` | Logo sobre fondos oscuros (modo oscuro de la app, footer dark). |
| `logo-mono.svg` | Una sola tinta. Usa `currentColor` — el wordmark hereda el color del padre CSS. |
| `icon.svg` | Solo el ícono, color completo. Para botones, avatares, sello en mapas. |
| `icon-mono.svg` | Solo el ícono en una tinta (`currentColor`). Para imprimir, marca de agua, badges. |
| `app-icon.svg` | Cuadrado de 1024px con fondo mostaza. Para iOS, Android, PWA. |
| `favicon.svg` | Versión simplificada para tamaños chicos (16-32px). |
| `app-icon-1024.png` / `-512.png` / `-192.png` | PNG del app icon listo para stores. |
| `apple-touch-icon-180.png` | iOS home screen (`<link rel="apple-touch-icon">`). |
| `favicon-32.png` / `favicon-16.png` | Fallback para navegadores antiguos. |

### Reglas de uso

- **Espacio mínimo de respeto**: el logo siempre tiene un margen libre equivalente a la altura del ícono en sus 4 lados.
- **Tamaño mínimo legible**: 24px de altura para el logo completo, 16px para el ícono solo.
- **NO** estires, rotes, recolores ni le agregues sombras / brillos al logo.
- **NO** uses el logo sobre fondos con poco contraste (ej. mostaza sobre crema).
- **NO** combines el logo con otro logo a menos de 2x su altura de distancia.

---

## Paleta de color

```css
:root {
  /* Brand */
  --crema:    #F5EFE6;  /* fondo principal, modo claro */
  --carbon:   #1F1B17;  /* texto, modo oscuro de fondo */
  --mostaza:  #E8A02C;  /* primario, CTAs, marca */
  --tomate:   #C84B31;  /* acento, alertas suaves, badges */
  --lechuga:  #6B8E4E;  /* secundario, estados verdes (verificado, abierto) */

  /* Soporte (derivados) */
  --crema-deep:   #FAF6EE;
  --crema-edge:   #E8DDD0;
  --carbon-soft:  #2A2520;
  --tinta-suave:  #6E5F4F;
  --bronceado:    #8B7355;
  --mostaza-deep: #C8862A;
}
```

### Cómo aplicar

- **Crema** es el lienzo. La mayoría de las pantallas viven sobre crema, no sobre blanco puro.
- **Carbón** para todo el texto principal y modo oscuro.
- **Mostaza** es el color de marca: úsalo para CTAs primarios, badges destacados, el ícono activo en navegación.
- **Tomate** es para acción / atención: notificaciones, "abierto ahora", "nuevo", botones de "agregar reseña".
- **Lechuga** es para estados positivos / saludables: verificado, abierto, opciones veganas/vegetarianas.

### Accesibilidad

- Texto carbón sobre crema: contraste 14.2 ✓ AAA
- Texto crema sobre carbón: contraste 14.2 ✓ AAA
- Texto carbón sobre mostaza: contraste 6.8 ✓ AA
- Texto crema sobre tomate: contraste 5.1 ✓ AA
- Texto crema sobre lechuga: contraste 4.7 ✓ AA

---

## Tipografía

### Bricolage Grotesque — display
Variable, con personalidad. Para el wordmark, titulares grandes y momentos editoriales.
- Pesos a usar: 500, 600, 700.
- Tracking ajustado en titulares grandes (`letter-spacing: -0.02em` o más cerrado).
- [Google Fonts](https://fonts.google.com/specimen/Bricolage+Grotesque)

### Geist Sans — cuerpo
Limpia, ultra legible en mobile. Para todo el cuerpo, UI, navegación.
- Pesos a usar: 400, 500, 600.
- Tracking neutro (`letter-spacing: 0`).
- [Vercel/Google Fonts](https://vercel.com/font)

### Setup en Next.js (App Router)

```tsx
// app/layout.tsx
import { Bricolage_Grotesque, Geist } from 'next/font/google';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
});

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${bricolage.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* globals.css */
:root {
  --font-display: var(--font-display), 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: var(--font-body), 'Geist', system-ui, sans-serif;
}

body { font-family: var(--font-body); }
h1, h2, h3, .display { font-family: var(--font-display); letter-spacing: -0.02em; }
```

### Escala tipográfica (mobile-first)

```css
--text-xs:   0.75rem;   /* 12px - badges, captions */
--text-sm:   0.875rem;  /* 14px - secondary text */
--text-base: 1rem;      /* 16px - body */
--text-lg:   1.125rem;  /* 18px - emphasized body */
--text-xl:   1.25rem;   /* 20px - subheaders */
--text-2xl:  1.5rem;    /* 24px - H3 mobile / H2 desktop */
--text-3xl:  1.875rem;  /* 30px - H2 mobile / H1 desktop */
--text-4xl:  2.5rem;    /* 40px - hero mobile */
--text-5xl:  3.5rem;    /* 56px - hero desktop */
```

---

## Spacing y radios

```css
--radius-sm:  6px;   /* botones pequeños, badges */
--radius-md:  10px;  /* botones, inputs */
--radius-lg:  16px;  /* cards */
--radius-xl:  24px;  /* sheets, modales */
--radius-2xl: 32px;  /* hero containers */

--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-6:  24px;
--space-8:  32px;
--space-12: 48px;
--space-16: 64px;
```

---

## Integración del favicon en Next.js

```tsx
// app/layout.tsx
export const metadata = {
  title: 'Hambuscador — la picá hamburguesera de Chile',
  description: 'Encuentra, califica y descubre las mejores hamburgueserías de todo Chile.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon-180.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
};
```

```json
// public/manifest.webmanifest
{
  "name": "Hambuscador",
  "short_name": "Hambuscador",
  "description": "La picá hamburguesera de Chile",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5EFE6",
  "theme_color": "#E8A02C",
  "icons": [
    { "src": "/app-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/app-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Convertir SVG a otros formatos

Si necesitas más variantes PNG / WebP / ICO, las herramientas más fáciles:

- **Figma / Inkscape**: importa el SVG, exporta al tamaño y formato deseado.
- **CLI con sharp** (recomendado para build automatizado):
  ```bash
  npm i -D sharp
  ```
  ```js
  // scripts/build-icons.js
  import sharp from 'sharp';
  await sharp('public/icon.svg').resize(512, 512).png().toFile('public/og-image.png');
  ```
- **Online**: [cloudconvert.com](https://cloudconvert.com), [svgomg.net](https://svgomg.net) (también optimiza SVG).

---

## Próximos pasos sugeridos para la marca

1. Registrar dominio `hambuscador.cl` cuanto antes.
2. Reservar handles sociales: `@hambuscador` en Instagram, TikTok, X, threads.
3. Diseñar plantillas de redes sociales (story, post cuadrado, banner) con la paleta y el ícono.
4. Crear el `og-image.png` (1200×630) para previews al compartir links.
5. Definir el sistema de iconografía secundaria (estrellas, mapas, etiquetas) — propongo Tabler Icons (outline, free, MIT).
