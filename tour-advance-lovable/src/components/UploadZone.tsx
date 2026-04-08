import { useRef, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";

interface UploadZoneProps {
  label: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  onUpload: (file: File) => Promise<string | void>;  // returns success message or void
}

export function UploadZone({ label, hint, accept = ".pdf,.docx,.txt", disabled, onUpload }: UploadZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  async function run(file: File) {
    if (disabled || state === "uploading") return;
    setFileName(file.name);
    setState("uploading");
    setMessage("");
    try {
      const result = await onUpload(file);
      setState("done");
      setMessage(typeof result === "string" ? result : `${file.name} processed.`);
    } catch (e) {
      setState("error");
      setMessage((e as Error).message || "Upload failed.");
    }
  }

  return (
    <div>
      <div
        className={[
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          dragging ? "border-amber-500 bg-amber-950/10" : "border-zinc-700 hover:border-zinc-500",
          disabled || state === "uploading" ? "opacity-50 cursor-not-allowed" : "",
          state === "done" ? "border-green-700 bg-green-950/10" : "",
          state === "error" ? "border-red-700 bg-red-950/10" : "",
        ].join(" ")}
        onClick={() => state !== "uploading" && !disabled && ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) run(f); }}
      >
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); }} />

        <div className="flex flex-col items-center gap-2">
          {state === "uploading" ? (
            <Loader2 size={28} className="text-amber-400 animate-spin" />
          ) : state === "done" ? (
            <FileText size={28} className="text-green-400" />
          ) : (
            <Upload size={28} className={dragging ? "text-amber-400" : "text-zinc-500"} />
          )}

          <p className="font-semibold text-sm text-zinc-200">
            {state === "uploading" ? `Processing ${fileName}…` : state === "done" ? "Done!" : label}
          </p>

          {state === "uploading" && (
            <p className="text-xs text-zinc-500">Claude is extracting and analyzing — 30–60 seconds for large files</p>
          )}
          {state === "idle" && hint && (
            <p className="text-xs text-zinc-500">{hint}</p>
          )}
          {state === "idle" && (
            <p className="text-xs text-zinc-600">PDF, DOCX, or TXT · max 50 MB</p>
          )}
        </div>
      </div>

      {message && (
        <p className={`mt-2 text-xs ${state === "error" ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
