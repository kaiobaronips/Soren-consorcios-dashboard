"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadDocumentAction } from "./actions";

type UploadResult = { fileName: string; status: "ok" | "duplicate" | "error"; message: string };

/** Dropzone que envia múltiplos PDFs em sequência (um upload por vez) via server action. */
export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [pending, startTransition] = useTransition();

  async function uploadAll(files: File[]) {
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      setResults([{ fileName: "—", status: "error", message: "Selecione arquivos PDF" }]);
      return;
    }
    const collected: UploadResult[] = [];
    for (const file of pdfs) {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadDocumentAction(undefined, fd);
      if (res.error) collected.push({ fileName: file.name, status: "error", message: res.error });
      else if (res.duplicateOf) collected.push({ fileName: file.name, status: "duplicate", message: "Documento duplicado (ignorado)" });
      else collected.push({ fileName: file.name, status: "ok", message: "Enviado" });
      setResults([...collected]);
    }
    router.refresh();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    startTransition(() => void uploadAll(files));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-primary bg-accent" : "border-muted-foreground/25 hover:border-muted-foreground/40"
        }`}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileUp aria-hidden className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">
          Arraste PDFs de tabelas de produtos aqui, ou
        </p>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Enviando..." : "Selecionar arquivos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            startTransition(() => void uploadAll(files));
          }}
        />
      </div>

      {results.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {results.map((r, i) => (
            <li key={`${r.fileName}-${i}`} className="flex items-center gap-2">
              {r.status === "ok" ? (
                <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
              ) : r.status === "duplicate" ? (
                <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning" />
              ) : (
                <XCircle aria-hidden className="size-4 shrink-0 text-destructive" />
              )}
              <span className="truncate font-medium">{r.fileName}</span>
              <span className="text-muted-foreground">— {r.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
