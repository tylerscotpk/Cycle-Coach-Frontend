import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("Checking backend...");

  useEffect(() => {
    const base = import.meta.env.VITE_BACKEND_URL;

    if (!base) {
      setStatus("❌ VITE_BACKEND_URL is missing in Vercel env vars");
      return;
    }

    fetch(`${base}/api/health`)
      .then(async (r) => {
        const text = await r.text();
        setStatus(r.ok ? `✅ Backend OK: ${text}` : `❌ Backend error: ${r.status} ${text}`);
      })
      .catch((e) => setStatus(`❌ Backend unreachable: ${e.message}`));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Cycle Coach</h1>
      <p>{status}</p>
    </div>
  );
}