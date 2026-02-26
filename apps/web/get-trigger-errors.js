const { runs } = require("@trigger.dev/sdk/v3");

async function fetchErrors() {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_sNcGFvUqIR1Em78SmOEn";
    console.log("Fetching latest runs from Trigger.dev production...\n");

    const runList = await runs.list({
        limit: 50,
    });

    for (const run of runList.data) {
        if (run.status === "FAILED" || run.status === "CRASHED" || run.status === "EXECUTING" || run.status === "QUEUED") {
            console.log(`Run ${run.id} - Task: ${run.taskIdentifier} - Status: ${run.status}`);
            if (run.error) {
                console.log(`  ERROR:`);
                console.log(JSON.stringify(run.error, null, 2));
            }
        }
    }
}

fetchErrors().catch(console.error);
