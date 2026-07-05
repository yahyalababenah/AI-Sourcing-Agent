import { Play } from "lucide-react";

interface ReelTileProps {
  price: string;
  product: string;
  /** Number of RFQs this clip generated — the one metric that matters per
   * CLAUDE.md's "RFQ-per-View" rule. Views are deliberately not a prop here. */
  rfqCount: number;
  tint?: string;
  playColor?: string;
  onClick?: () => void;
}

// Per CLAUDE.md's "مكوّنات جاهزة" ReelTile spec: the commercial overlay never
// disappears, and the RFQ count is the loud, green, primary metric — views
// are not shown at all by this shared atom.
export function ReelTile({
  price,
  product,
  rfqCount,
  tint = "bg-slate-100",
  playColor = "text-supplier-500",
  onClick,
}: ReelTileProps) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden aspect-[2/3] ${tint} cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full bg-white/85 flex items-center justify-center">
          <Play className={`w-3.5 h-3.5 ${playColor}`} fill="currentColor" />
        </div>
      </div>

      {/* Commercial overlay — always present, never hidden */}
      <div className="absolute bottom-2 end-2 start-2 bg-slate-900/85 rounded-lg py-1 text-center">
        <span className="text-white text-[11px]">
          {price} · {product}
        </span>
      </div>

      {/* RFQ-per-View metric — bold and green, the only metric shown */}
      <div className="absolute top-2 end-2 text-[10px] text-supplier-400 font-medium bg-black/30 rounded px-1">
        {rfqCount} طلب سعر
      </div>
    </div>
  );
}
