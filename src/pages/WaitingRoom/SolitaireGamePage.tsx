import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SolitaireGame } from '@/components/waiting-room/solitaire/SolitaireGame';

export default function SolitaireGamePage() {
  return (
    <div className="mx-auto py-6 space-y-6 max-w-[1180px] px-4">
      <div className="flex items-center gap-4">
        <Link
          to="/soba-za-cekanje"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Nazad na hub
        </Link>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
          Solitaire (Klondike)
        </h1>
        <p className="text-sm text-muted-foreground">
          Slozi sve 4 boje u foundation gomile (A → K). Tableau: kralj na prazno, naredna karta nizeg ranga obrnute boje.
          Tezine (Lako = garantovano resiva / Srednje / Tesko draw-3), undo, hint i auto-zavrsi.
        </p>
      </div>

      <SolitaireGame />
    </div>
  );
}
