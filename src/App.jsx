import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("Checking backend...");

  // Step 2.4 (state)
  const [licenseKey, setLicenseKey] = useState("");
  const [validateResult, setValidateResult] = useState(null);

  // Step 2.3 (function) — MUST be inside App() (or above it)
  async function validateLicense(licenseKey) {
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/license/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      }
    );

    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  useEffect(() => {
    const base = import.meta.env.VITE_BACKEND_URL;

    if (!base) {
      setStatus("❌ VITE_BACKEND_URL is missing in Vercel env vars");
      return;
    }

    fetch(`${base}/api/health`)
      .then(async (r) => {
        const text = await r.text();
        setStatus(
          r.ok
            ? `✅ Backend OK: ${text}`
            : `❌ Backend error: ${r.status} ${text}`
        );
      })
      .catch((e) => setStatus(`❌ Backend unreachable: ${e.message}`));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Cycle Coach</h1>
      <p>{status}</p>

      {/* Step 2.5 (UI) */}
      <div style={{ marginTop: 16 }}>
        <h3>License Validation</h3>

        <input
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="Enter license key (ex: TEST-123 or CC-123)"
          style={{ padding: 8, width: 320 }}
        />

        <button
          style={{ marginLeft: 8, padding: "8px 12px" }}
          onClick={async () => {
            try {
              const result = await validateLicense(licenseKey);
              setValidateResult(result);
            } catch (e) {
              setValidateResult({
                ok: false,
                status: "fetch-failed",
                data: { error: String(e) },
              });
            }
          }}
        >
          Validate
        </button>

        {validateResult && (
          <pre
            style={{
              marginTop: 12,
              background: "#111",
              color: "#0f0",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(validateResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}