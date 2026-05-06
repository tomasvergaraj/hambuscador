import { Header } from "@/components/nav/header";
import { Button } from "@/components/ui/button";
import { ProgressDots } from "@/components/ui/progress-dots";

export const metadata = {
  title: "agregar lugar",
  description: "Agrega una hamburguesería nueva al directorio de Hambuscador.",
};

/**
 * Wizard de 3 pasos para agregar una hamburguesería.
 *
 * TODO Fase 1.5: implementar la lógica del wizard
 * - Paso 1: nombre + ubicación (autocomplete con Google Places o nominatim)
 * - Paso 2: detalles (tipo de cocina, especialidad, precio, horario)
 * - Paso 3: fotos
 *
 * TODO Fase 2: al submit, llamar API que cree el local en estado "pending"
 * para moderación. El usuario que lo agrega gana puntos cuando se aprueba.
 */
export default function AgregarPage() {
  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="agregar lugar" isModal />

      <div className="px-4 pt-4">
        <ProgressDots total={3} current={1} className="mb-3" />
        <p className="text-[10px] text-bronceado tracking-widest font-medium">PASO 1 DE 3</p>
        <h1 className="font-display font-semibold text-xl text-carbon mt-1 tracking-tight">
          ¿qué picá nos quieres mostrar?
        </h1>
      </div>

      <main className="px-4 pt-6 flex-1">
        <div className="rounded-xl bg-crema-deep border border-crema-edge p-6 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            wizard pendiente de implementar
          </p>
          <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
            TODO: nombre del local, búsqueda de dirección con autocompletado, mapa para confirmar
            ubicación. Pasar al paso 2.
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-crema border-t border-crema-edge px-4 py-3 z-30 flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1">
          atrás
        </Button>
        <Button variant="primary" size="lg" className="flex-[2]">
          continuar →
        </Button>
      </div>
    </div>
  );
}
