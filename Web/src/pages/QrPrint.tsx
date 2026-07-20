import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { AppLayout } from "@/components/AppLayout";
import { getAssets } from "@/lib/repository";

export default function QrPrint() {
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: getAssets });

  const origin = useMemo(() => window.location.origin, []);

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-5">
          <div>
            <h1 className="text-base font-semibold">QR Print Sheet</h1>
            <p className="text-xs text-muted-foreground">Print & stick on assets / panels.</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="print-area grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {assets.map((a) => {
              const url = `${origin}/a/${a.qr_hash}`;
              return (
                <div
                  key={a.id}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/20 bg-white p-3 text-black"
                >
                  <div className="rounded bg-white p-1.5">
                    <QRCodeSVG value={url} size={120} level="M" />
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] font-bold">{a.code}</p>
                    <p className="text-[11px] font-semibold leading-tight">{a.name.split("—")[0]}</p>
                    <p className="text-[9px] text-gray-600">{a.location}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
