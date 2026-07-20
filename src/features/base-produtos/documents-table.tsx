"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { processDocumentAction } from "./actions";
import type { DocumentStatus, ProductDocument } from "@/repositories/documents";

const STATUS: Record<DocumentStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" }> = {
  uploaded: { label: "Enviado", variant: "secondary" },
  processing: { label: "Processando", variant: "outline" },
  review_required: { label: "Revisão pendente", variant: "default" },
  completed: { label: "Concluído", variant: "success" },
  failed: { label: "Falha", variant: "destructive" },
};

export function DocumentsTable({ documents }: { documents: ProductDocument[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleProcess(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await processDocumentAction({ documentId: id });
      setPendingId(null);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  if (documents.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Nenhum documento enviado ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const status = STATUS[doc.status];
              const canProcess = doc.status === "uploaded" || doc.status === "failed";
              const canReview = doc.status === "review_required" || doc.status === "completed";
              return (
                <TableRow key={doc.id} className="transition-colors hover:bg-muted/50">
                  <TableCell className="font-medium">{doc.fileName}</TableCell>
                  <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canProcess && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === doc.id}
                          onClick={() => handleProcess(doc.id)}
                        >
                          {pendingId === doc.id ? "Processando..." : doc.status === "failed" ? "Reprocessar" : "Processar"}
                        </Button>
                      )}
                      {canReview && (
                        <Button size="sm" render={<Link href={`/base-produtos/${doc.id}`} />}>
                          Revisar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
