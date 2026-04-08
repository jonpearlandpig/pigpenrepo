"use client";
import { useRef, useState } from "react";

interface UploadZoneProps {
  accept?: string;
  label?: string;
  hint?: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function UploadZone({ accept = ".pdf,.docx,.txt", label = "Drop file here", hint, onUpload, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleFile(file: File) {
    setError("");
    setSuccess("");
    setUploading(true);
    try {
      await onUpload(file);
      setSuccess(`${file.name} processed successfully.`);
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        className={`upload-zone${dragging ? " drag-over" : ""}`}
        style={{ opacity: disabled || uploading ? 0.5 : 1 }}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={onChange} />
        <div style={{ fontSize: 28, marginBottom: 8 }}>
          {uploading ? "⏳" : "📄"}
        </div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {uploading ? "Processing..." : label}
        </div>
        {hint && !uploading && (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{hint}</div>
        )}
        {uploading && (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Extracting and analyzing — this may take 30–60 seconds for large documents.
          </div>
        )}
      </div>
      {error && <p className="error-msg" style={{ marginTop: 8 }}>{error}</p>}
      {success && <p className="success-msg" style={{ marginTop: 8 }}>{success}</p>}
    </div>
  );
}
