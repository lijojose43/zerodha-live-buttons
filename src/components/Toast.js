import { usePaperTrading } from "../context/PaperTradingContext";

export default function Toast() {
  const { toast } = usePaperTrading();
  if (!toast) return null;

  const dotMap = {
    success: "bg-pos",
    error: "bg-neg",
    info: "bg-accent",
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-toast-in">
      <div className="flex items-center gap-2.5 rounded-md bg-ink px-3.5 py-2.5 text-[13px] font-medium text-canvas shadow-pop">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            dotMap[toast.type] || dotMap.info
          }`}
        />
        {toast.message}
      </div>
    </div>
  );
}
