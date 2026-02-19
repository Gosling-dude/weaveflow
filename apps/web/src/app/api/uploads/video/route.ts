import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/server-auth";
import { uploadToTransloadit, validateUploadFile } from "@/lib/transloadit";

export async function POST(request: Request) {
  try {
    await requireDbUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    validateUploadFile(file, "video");
    const url = await uploadToTransloadit(file);
    return NextResponse.json({
      url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}