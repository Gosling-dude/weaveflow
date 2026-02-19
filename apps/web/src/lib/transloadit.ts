import { createHash } from "node:crypto";

type UploadKind = "image" | "video";

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

export function validateUploadFile(file: File, kind: UploadKind) {
  if (kind === "image" && !IMAGE_MIMES.has(file.type)) {
    throw new Error("Unsupported image format");
  }
  if (kind === "video" && !VIDEO_MIMES.has(file.type)) {
    throw new Error("Unsupported video format");
  }
}

function makeSignedParams() {
  const key = process.env.TRANSLOADIT_KEY;
  const secret = process.env.TRANSLOADIT_SECRET;
  if (!key || !secret) {
    throw new Error("Transloadit credentials are missing");
  }

  const params = {
    auth: {
      key,
      expires: new Date(Date.now() + 10 * 60_000).toISOString(),
    },
    steps: {
      upload: {
        robot: "/upload/handle",
      },
    },
  };

  const paramsStr = JSON.stringify(params);
  const signature = `sha384:${createHash("sha384").update(paramsStr + secret).digest("hex")}`;
  return { paramsStr, signature };
}

function extractResultUrl(results: Record<string, Array<Record<string, unknown>>> | undefined) {
  if (!results) return null;
  const uploadStep = results.upload;
  if (!Array.isArray(uploadStep) || uploadStep.length === 0) return null;
  const first = uploadStep[0];
  const url = first.ssl_url ?? first.url;
  return typeof url === "string" ? url : null;
}

export async function uploadToTransloadit(file: File) {
  const { paramsStr, signature } = makeSignedParams();

  const form = new FormData();
  form.append("params", paramsStr);
  form.append("signature", signature);
  form.append("file", file);

  const createRes = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: form,
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Transloadit upload failed: ${errorBody}`);
  }

  const assembly = (await createRes.json()) as {
    ok: string;
    assembly_url: string;
    results?: Record<string, Array<Record<string, unknown>>>;
    error?: string;
  };

  let outputUrl = extractResultUrl(assembly.results);
  if (outputUrl) return outputUrl;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const pollRes = await fetch(assembly.assembly_url, { cache: "no-store" });
    if (!pollRes.ok) continue;
    const poll = (await pollRes.json()) as {
      ok: string;
      results?: Record<string, Array<Record<string, unknown>>>;
      error?: string;
    };
    if (poll.ok === "ASSEMBLY_EXECUTING") continue;
    if (poll.error) throw new Error(`Transloadit assembly error: ${poll.error}`);
    outputUrl = extractResultUrl(poll.results);
    if (outputUrl) return outputUrl;
  }

  throw new Error("Transloadit assembly timed out");
}
