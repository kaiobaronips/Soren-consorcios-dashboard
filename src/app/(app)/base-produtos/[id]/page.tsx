import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/repositories/profiles";
import { getDocument, getDocumentSignedUrl } from "@/repositories/documents";
import { listByDocument } from "@/repositories/extracted-products";
import { ReviewPanel } from "@/features/base-produtos/review-panel";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  // Staff-only: consultor não acessa a revisão.
  if (profile.role === "consultant") redirect("/");

  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();

  const [signedUrl, records] = await Promise.all([
    getDocumentSignedUrl(document.storagePath),
    listByDocument(id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Link href="/base-produtos" className="text-sm text-muted-foreground underline">
            ← Base de Produtos
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{document.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            {records.length} produto(s) candidato(s). Revise cada campo, aprove e publique.
          </p>
        </div>
      </div>
      <ReviewPanel document={document} signedUrl={signedUrl} records={records} />
    </div>
  );
}
