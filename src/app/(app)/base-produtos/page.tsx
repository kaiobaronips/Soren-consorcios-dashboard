import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/repositories/profiles";
import { listDocuments } from "@/repositories/documents";
import { UploadDropzone } from "@/features/base-produtos/upload-dropzone";
import { DocumentsTable } from "@/features/base-produtos/documents-table";

export default async function BaseProdutosPage() {
  const profile = await getCurrentProfile();
  // Staff-only: consultor não acessa a Base de Produtos.
  if (profile.role === "consultant") redirect("/");

  const documents = await listDocuments();

  return (
    <div className="space-y-6">
      <UploadDropzone />
      <DocumentsTable documents={documents} />
    </div>
  );
}
