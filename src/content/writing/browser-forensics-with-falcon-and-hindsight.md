---
title: "Browser forensics with Falcon Fusion and Hindsight"
date: 2026-11-28
description: "How I wired Hindsight into CrowdStrike Falcon Fusion and made collection wait for a verified archive."
---

In an incident, browser artifacts can help put a user's activity in order. Getting a usable report from an endpoint takes several steps, though. You have to find the right profile, run the parser, and retrieve the results. I built a Falcon Fusion workflow to make those steps repeatable on Windows using CrowdStrike Real Time Response (RTR) and Hindsight.

The part that needed the most care was deciding when collection was actually complete. A parser can create an output file before it finishes writing it. If the workflow sees that file and archives it immediately, the analyst can receive a ZIP that looks plausible and contains incomplete data.

## Prepare, process, collect

An analyst chooses a Falcon sensor, a browser, and a report format. The workflow supports Chrome, Edge, and Brave, with XLSX, JSONL, and SQLite output.

1. **Prepare.** Start with a dedicated working directory. Preparation deletes the directory and its contents if it already exists, then recreates it empty. That keeps a previous run's files out of the next archive. Sequential runs can reuse the directory. Overlapping runs on the same endpoint need separate paths.
2. **Process.** After RTR stages Hindsight, the processing script resolves the interactive Windows user's local profile and launches a parser process for each matching browser profile. It records the process ID, start time, and expected report path. Fusion can begin polling while those processes run.
3. **Collect.** Each poll checks that the process records match the expected reports, that the recorded processes have exited, and that the reports exist and are non-empty. The script checks the temporary ZIP's entries and sizes before moving it into place and returning its path.

Once collection returns a verified ZIP path, Fusion can retrieve it with RTR Get File. If the polling window expires, the workflow should report a timeout and skip retrieval.

## What the ZIP check actually proves

The revised collector can tell whether the expected files made it into the archive at the expected sizes. Its view of Hindsight is more limited. After the launch action returns, the collector can observe whether a recorded process is still running, but it cannot read that process's eventual exit code. Opening the reports and checking their contents is still part of validating the workflow.

That distinction matters when an analyst sees a green status in Fusion. A successful collection means the archive passed the collector's checks. A successful retrieval means RTR made it available. Each status tells you where to look when something is missing.

## What I tested

The PowerShell regression checks cover a populated working directory, missing profiles, launch errors, a process that's still running, and compression failures. Those checks passed locally. The deployed workflow still needs an end-to-end Windows test to confirm how Fusion handles retrieval, timeouts, and cleanup.

The repository includes the three scripts, their JSON schemas, and a first-run checklist for Falcon. [Hindsight workflow source and setup guide](https://github.com/alexandruhera/crowdstrike-hindsight-soar/tree/eeabea24ea12ee26defd47e2f325b03b84f59456)
