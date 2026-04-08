"use client";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.push("/tours");
  }, [status, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 13, color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
          PigPen Productions
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--accent)", marginBottom: 12, letterSpacing: "-1px" }}>
          TAPS
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", marginBottom: 8 }}>
          Tour Advance Prep System
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
          Upload your production rider, lock the AKB, and instantly see every gap
          between your tour requirements and each venue's tech packet — before
          the advance call happens.
        </p>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Sign in to continue</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
          Production team access only.
        </p>
        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", fontSize: 14, padding: "10px 0" }}
          onClick={() => signIn("google")}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Loading..." : "Sign in with Google"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
        {[
          { label: "Production Rider → AKB", desc: "Parse & lock your rider as the source of truth" },
          { label: "Tech Packet Analysis", desc: "Extract venue specs from uploaded packets" },
          { label: "Gap Detection", desc: "Instant comparison — mismatches flagged by severity" },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: "center", maxWidth: 180 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
