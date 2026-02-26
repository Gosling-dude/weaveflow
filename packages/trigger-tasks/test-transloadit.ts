import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function makeTransloaditSignature(paramsStr: string) {
    const secret = process.env.TRANSLOADIT_SECRET;
    if (!secret) throw new Error("TRANSLOADIT_SECRET missing");
    return `sha384:${createHmac("sha384", secret).update(Buffer.from(paramsStr, "utf-8")).digest("hex")}`;
}

async function uploadBinaryToTransloadit(data: Uint8Array, fileName: string, mimeType: string) {
    const key = process.env.TRANSLOADIT_KEY;
    if (!key) throw new Error("TRANSLOADIT_KEY missing");

    const params = {
        auth: {
            key,
            expires: new Date(Date.now() + 10 * 60_000).toISOString(),
        },
        steps: {
            "export": {
                "use": ":original",
                "robot": "/upload/handle"
            }
        },
    };

    const paramsStr = JSON.stringify(params);
    const formData = new FormData();
    formData.append("params", paramsStr);
    formData.append("signature", makeTransloaditSignature(paramsStr));
    formData.append("file", new Blob([data], { type: mimeType }), fileName);

    const createRes = await fetch("https://api2.transloadit.com/assemblies", {
        method: "POST",
        body: formData,
    });
    if (!createRes.ok) {
        throw new Error(`Transloadit upload failed: ${await createRes.text()}`);
    }

    const assembly = await createRes.json();
    console.log("Initial Assembly ok:", assembly.ok);
    console.log("uploads:", JSON.stringify(assembly.uploads, null, 2));
    console.log("results:", JSON.stringify(assembly.results, null, 2));

    for (let i = 0; i < 5; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const pollRes = await fetch(assembly.assembly_url, { cache: "no-store" });
        if (!pollRes.ok) continue;
        const poll = await pollRes.json();
        console.log(`Poll ${i + 1} ok:`, poll.ok);
        console.log(`Poll ${i + 1} results:`, JSON.stringify(poll.results, null, 2));
        if (poll.ok === "ASSEMBLY_COMPLETED") break;
    }
}

async function run() {
    process.env.TRANSLOADIT_KEY = "750c270bdc71e1e2d01f17b4c795fd19";
    process.env.TRANSLOADIT_SECRET = "0cdf0aee11b6459d7407cbd2146bdc7ff277c58c";

    const testData = new Uint8Array([1, 2, 3, 4]);
    await uploadBinaryToTransloadit(testData, "test.png", "image/png");
}

run().catch(console.error);
