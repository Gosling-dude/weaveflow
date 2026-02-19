import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import WorkflowEditor from "@/components/workflow/workflow-editor";

export default async function WorkflowPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return <WorkflowEditor />;
}