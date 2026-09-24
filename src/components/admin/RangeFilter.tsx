import { useMemo, useState } from "react";

import { rangeDates, type RangeKey } from "@/lib/finance";

const OPTIONS: [RangeKey, string][] = [
  ["all", "All time"],
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
  ["custom", "Custom"],
];

export function useRange(initial: RangeKey = "all") {
  const [key, setKey] = useState<RangeKey>(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => rangeDates(key, from, to), [key, from, to]);
  const ui = (
    <div className="adm-filters">
      <select value={key} onChange={(e) => setKey(e.target.value as RangeKey)} aria-label="Date range">
        {OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {key === "custom" && (
        <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </>
      )}
    </div>
  );
  return { range, ui };
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="adm-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}
