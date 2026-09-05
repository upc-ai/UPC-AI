import { redirect } from "next/navigation";

/** The knowledge page moved into the admin panel (/admin/documents). */
export default function ChatAdminRedirect() {
  redirect("/admin/documents");
}
