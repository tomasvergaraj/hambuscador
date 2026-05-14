import { IconMessageCircleFilled } from "@tabler/icons-react";

/**
 * Render de la respuesta del owner a una reseña. Server-only — pura UI.
 * Se monta debajo de la review card cuando hay reply.
 */
export function ReplyCard({ text }: { text: string }) {
  return (
    <div className="relative z-20 mt-2 ml-4 pl-3 border-l-2 border-mostaza/40">
      <div className="flex items-center gap-1.5 mb-1">
        <IconMessageCircleFilled
          size={11}
          className="text-mostaza-deep"
          aria-hidden="true"
        />
        <span className="text-[10px] uppercase tracking-widest font-medium text-mostaza-deep">
          respuesta del dueño
        </span>
      </div>
      <p className="text-xs text-tinta-suave leading-relaxed whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}
