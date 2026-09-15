import { usePaperTrading } from "../context/PaperTradingContext";

export default function Toast() {
  const { toast } = usePaperTrading();
  if (!toast) return null;

  const colorMap = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div
        className={`px-4 py-2.5 rounded-lg shadow-lg text-white text-sm font-medium ${
          colorMap[toast.type] || colorMap.info
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
