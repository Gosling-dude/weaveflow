import { configure } from "@trigger.dev/sdk/v3";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
    const result = await fetch("https://api.trigger.dev/api/v1/projects/proj_ndcpenrxtkjmcmjvpfce/environments", {
        headers: { Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}` }
    }).then(r => r.json());
    console.log(JSON.stringify(result, null, 2));
}
main().catch(console.error);
