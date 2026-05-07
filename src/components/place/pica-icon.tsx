import {
  IconCoin,
  IconFlameFilled,
  IconLeaf,
  IconMapPinFilled,
  IconSparkles,
} from "@tabler/icons-react";

import type { PicaIconName } from "@/lib/picas";

const ICON_MAP = {
  flame: IconFlameFilled,
  leaf: IconLeaf,
  coin: IconCoin,
  sparkles: IconSparkles,
  "map-pin": IconMapPinFilled,
} as const;

type Props = {
  name: PicaIconName;
  size?: number;
  className?: string;
  stroke?: number;
};

/**
 * Icono de una lista curada. Mapea `PicaIconName` a un componente Tabler.
 * El color se hereda vía `currentColor` (set en el padre con className).
 */
export function PicaIcon({ name, size = 24, className, stroke = 2 }: Props) {
  const Component = ICON_MAP[name];
  return (
    <Component
      size={size}
      stroke={stroke}
      className={className}
      aria-hidden="true"
    />
  );
}
