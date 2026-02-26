const { runs } = require("@trigger.dev/sdk/v3");

async function fetchErrors() {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_O5O88IAl2EaP5nZ8cO4UfDkG";
    console.log("Fetching latest runs from Trigger.dev production...\n");

    const runList = await runs.list({
        limit: 5,
    });

    for (const run of runList.data) {
        console.log(`Run ${run.id} - Task: ${run.taskIdentifier} - Status: ${run.status}`);
        if (run.status === "FAILED" || run.status === "CRASHED") {
            const details = await runs.retrieve(run.id);
            console.log(`  ERROR:`);
            console.log(JSON.stringify(details.error, null, 2));
        }
    }
}

fetchErrors().catch(console.error);
