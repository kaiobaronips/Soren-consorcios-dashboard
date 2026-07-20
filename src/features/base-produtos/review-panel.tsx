"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ExtractionReviewStatus } from "@/repositories/extracted-products";
import type { ExtractedFieldKey, ExtractedProductRecord } from "@/repositories/extracted-products";
import type { ProductDocument } from "@/repositories/documents";
import type { Product } from "@/repositories/products";
import type { ColumnMapping } from "@/lib/pdf/parse-products";
import {
  approveAndPublishAction,
  approveExtractedAction,
  publishApprovedAction,
  rejectExtractedAction,
  remapColumnsAction,
  updateExtractedProductAction,
} from "./actions";

type Category = Product["category"];
type CorrectionIndex = Product["correctionIndex"];

const FIELDS: { key: ExtractedFieldKey; label: string; optional?: boolean }[] = [
  { key: "productName", label: "Produto" },
  { key: "productCode", label: "Código" },
  { key: "creditAmount", label: "Valor da carta" },
  { key: "termMonths", label: "Prazo (meses)" },
  { key: "totalAdministrationFeePercent", label: "Taxa adm (%)" },
  { key: "regularInstallmentAmount", label: "Parcela mensal" },
  { key: "first12InstallmentAmount", label: "Parcela 1ª–12ª", optional: true },
];

const STATUS_LABEL: Record<ExtractionReviewStatus, string> = {
  pending_review: "Pendente de revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
  published: "Publicado",
};
const STATUS_VARIANT: Record<ExtractionReviewStatus, "default" | "secondary" | "outline" | "destructive" | "success"> = {
  pending_review: "secondary",
  approved: "success",
  rejected: "destructive",
  published: "outline",
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "property", label: "Imóvel" },
  { value: "vehicle", label: "Veículo" },
  { value: "other", label: "Outros" },
];
const CORRECTIONS: { value: CorrectionIndex; label: string }[] = [
  { value: "NONE", label: "Nenhum" },
  { value: "IGPM", label: "IGP-M" },
  { value: "IPCA", label: "IPCA" },
  { value: "INCC", label: "INCC" },
  { value: "CUSTOM", label: "Personalizado" },
];

function confidenceBadge(confidence: number) {
  if (confidence >= 90) return { label: `${confidence}%`, tone: "text-success" };
  if (confidence >= 50) return { label: `${confidence}%`, tone: "text-warning" };
  return { label: `${confidence}%`, tone: "text-destructive" };
}

/** Editor de um campo: Input com badge de confiança e destaque de PENDENTE (value null). */
function FieldEditor({
  record,
  field,
  label,
  optional,
  disabled,
  onChanged,
}: {
  record: ExtractedProductRecord;
  field: ExtractedFieldKey;
  label: string;
  optional?: boolean;
  disabled: boolean;
  onChanged: () => void;
}) {
  const data = record[field];
  const isPending = data.value === null;
  const [value, setValue] = useState(data.value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badge = confidenceBadge(data.confidence);

  async function save() {
    if (value.trim() === (data.value ?? "").trim()) return;
    setSaving(true);
    setError(null);
    const res = await updateExtractedProductAction({ id: record.id, field, value });
    setSaving(false);
    if (res.error) setError(res.error);
    else onChanged();
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${record.id}-${field}`} className="text-xs">
          {label}
          {optional && <span className="ml-1 text-muted-foreground">(opcional)</span>}
        </Label>
        {isPending ? (
          <Badge variant="destructive" className="text-[10px]">PENDENTE</Badge>
        ) : (
          <span className={`text-[10px] font-medium ${badge.tone}`}>conf. {badge.label}</span>
        )}
      </div>
      <Input
        id={`${record.id}-${field}`}
        value={value}
        disabled={disabled || saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        className={isPending ? "border-destructive focus-visible:ring-destructive" : undefined}
        placeholder={isPending ? "Preencher…" : undefined}
      />
      {data.raw && data.raw !== data.value && (
        <p className="text-[10px] text-muted-foreground">cru: {data.raw}</p>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

function ProductCard({
  record,
  category,
  onCategory,
  administratorName,
  correctionIndex,
  onChanged,
}: {
  record: ExtractedProductRecord;
  category: Category;
  onCategory: (c: Category) => void;
  administratorName: string;
  correctionIndex: CorrectionIndex;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const published = record.reviewStatus === "published";

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else { onChanged(); router.refresh(); }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Página {record.page}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">geral {record.overallConfidence}%</span>
          <Badge variant={STATUS_VARIANT[record.reviewStatus]}>{STATUS_LABEL[record.reviewStatus]}</Badge>
        </div>
      </div>

      {record.issues.length > 0 && (
        <ul className="space-y-0.5 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
          {record.issues.map((issue, i) => <li key={i}>• {issue}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <FieldEditor
            key={f.key}
            record={record}
            field={f.key}
            label={f.label}
            optional={f.optional}
            disabled={published || pending}
            onChanged={onChanged}
          />
        ))}
        <div className="space-y-1">
          <Label htmlFor={`${record.id}-category`} className="text-xs">Categoria</Label>
          <NativeSelect
            id={`${record.id}-category`}
            value={category}
            disabled={published || pending}
            onChange={(e) => onCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </NativeSelect>
        </div>
      </div>

      {published && record.publishedProductId ? (
        <p className="text-sm text-muted-foreground">
          Publicado em{" "}
          <Link href="/produtos" className="underline">/produtos</Link>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {record.reviewStatus !== "approved" && (
            <Button size="sm" variant="outline" disabled={pending || record.reviewStatus === "rejected"}
              onClick={() => run(() => approveExtractedAction({ id: record.id }))}>
              Aprovar
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending || record.reviewStatus === "rejected"}
            onClick={() => run(() => rejectExtractedAction({ id: record.id }))}>
            Rejeitar
          </Button>
          <Button size="sm" disabled={pending || record.reviewStatus !== "approved"}
            onClick={() => run(() => approveAndPublishAction({ id: record.id, category, administratorName, correctionIndex }))}>
            Publicar
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReviewPanel({
  document,
  signedUrl,
  records,
}: {
  document: ProductDocument;
  signedUrl: string;
  records: ExtractedProductRecord[];
}) {
  const router = useRouter();
  const defaultAdmin = document.fileName.replace(/\.pdf$/i, "");
  const [administratorName, setAdministratorName] = useState(defaultAdmin);
  const [correctionIndex, setCorrectionIndex] = useState<CorrectionIndex>("NONE");
  const [categories, setCategories] = useState<Record<string, Category>>(
    Object.fromEntries(records.map((r) => [r.id, "property" as Category])),
  );
  const [mapping, setMapping] = useState<Record<ExtractedFieldKey, string>>({
    productName: "", productCode: "", creditAmount: "", termMonths: "",
    totalAdministrationFeePercent: "", regularInstallmentAmount: "", first12InstallmentAmount: "",
  });
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const approvedIds = records.filter((r) => r.reviewStatus === "approved").map((r) => r.id);

  function publishApproved() {
    setBulkError(null);
    setBulkMsg(null);
    startTransition(async () => {
      const res = await publishApprovedAction({
        documentId: document.id,
        administratorName,
        correctionIndex,
        items: approvedIds.map((id) => ({ id, category: categories[id] ?? "property" })),
      });
      if (res.error && !res.published) setBulkError(res.error);
      else { setBulkMsg(`${res.published ?? 0} produto(s) publicado(s).${res.error ? " Avisos: " + res.error : ""}`); router.refresh(); }
    });
  }

  function reprocess() {
    setBulkError(null);
    setBulkMsg(null);
    const parsed: ColumnMapping = {};
    for (const f of FIELDS) {
      const raw = mapping[f.key].trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0) parsed[f.key] = n;
    }
    startTransition(async () => {
      const res = await remapColumnsAction({ documentId: document.id, mapping: parsed });
      if (res.error) setBulkError(res.error);
      else { setBulkMsg(`Reprocessado: ${res.productsFound ?? 0} produto(s).`); router.refresh(); }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Esquerda: PDF de origem */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Documento de origem</h2>
          <a href={signedUrl} target="_blank" rel="noreferrer" className="text-xs underline">Abrir em nova aba</a>
        </div>
        <iframe src={signedUrl} title={document.fileName} className="h-[75vh] w-full rounded-xl border bg-muted/30" />
      </div>

      {/* Direita: produtos extraídos + controles de publicação */}
      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Dados de publicação</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="administrator" className="text-xs">Administradora</Label>
              <Input id="administrator" value={administratorName} onChange={(e) => setAdministratorName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="correction" className="text-xs">Índice de correção</Label>
              <NativeSelect
                id="correction"
                value={correctionIndex}
                onChange={(e) => setCorrectionIndex(e.target.value as CorrectionIndex)}
              >
                {CORRECTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </NativeSelect>
            </div>
          </div>
          <Button size="sm" disabled={pending || approvedIds.length === 0} onClick={publishApproved}>
            Publicar aprovados ({approvedIds.length})
          </Button>
          {bulkError && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {bulkError}
            </p>
          )}
          {bulkMsg && (
            <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
              {bulkMsg}
            </p>
          )}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">Mapeamento manual de colunas</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Informe o índice da coluna (0 = primeira) para os campos mal identificados e reprocesse.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`map-${f.key}`} className="text-[11px]">{f.label}</Label>
                <Input
                  id={`map-${f.key}`}
                  inputMode="numeric"
                  value={mapping[f.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="mt-3" disabled={pending} onClick={reprocess}>
            Reprocessar com este mapeamento
          </Button>
        </details>

        {records.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum produto extraído deste documento.</p>
        ) : (
          records.map((record) => (
            <ProductCard
              key={record.id}
              record={record}
              category={categories[record.id] ?? "property"}
              onCategory={(c) => setCategories((prev) => ({ ...prev, [record.id]: c }))}
              administratorName={administratorName}
              correctionIndex={correctionIndex}
              onChanged={() => router.refresh()}
            />
          ))
        )}
      </div>
    </div>
  );
}
