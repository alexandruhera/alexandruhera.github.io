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

## What gets auto-detected

The analyst picks the browser in Fusion. On the endpoint, the script uses Windows CIM to identify the signed-in user because the RTR action runs under a separate account. It matches that username to the final folder name of a local Windows profile and requires exactly one match. It then opens the selected browser’s standard User Data directory under that profile.

For Chrome, that is `AppData\Local\Google\Chrome\User Data`. Edge and Brave use their own standard paths. If the directory contains `Default` and `Profile 1`, the script launches Hindsight once for each. The current discovery rules cover `Default` and numbered `Profile` folders for the interactive user. A missing interactive user, an ambiguous Windows profile, or no matching browser profile returns an error to Fusion. Additional Windows users and custom browser data paths are outside that discovery scope.

## A sample Falcon configuration

Here is an illustrative trigger payload for a Chrome collection on a test sensor. The sensor ID is a placeholder.

```json
{
  "deviceID": "0123456789abcdef0123456789abcdef",
  "selected_browser": "Google Chrome",
  "output_format": "xlsx"
}
```

Fusion resolves the hostname from the sensor and supplies a dedicated working path, such as `C:\Hindsight\Run-042`. Prepare returns the path that RTR uses for staging and that the later actions use for collection and cleanup. Processing receives the staged executable path, browser, format, and hostname. Collection receives the same working path, browser, and hostname, plus the expected report paths and run timestamp from Processing.

| Format | When I would use it |
| --- | --- |
| XLSX | Review the timeline in a spreadsheet. |
| JSONL | Feed records into a scripted analysis pipeline. |
| SQLite | Query the results locally with SQL. |

The published Fusion example uses up to 15 attempts and 15 minutes. That limit belongs to Fusion. Each collector invocation performs one check and returns. If Slack is configured, launch and collection outcomes can be sent to the designated channel.

## Read the filenames in UTC

The processing script takes a UTC timestamp once, before launching the parser processes, using `yyyy-MM-ddTHH-mm-ss-fff`. It separately passes `-t UTC` to Hindsight so the report’s rendered timeline uses UTC too. The filename timestamp identifies processing time. Events inside the report retain their own timestamps. Keeping both on the same time basis makes it easier to compare the report with Falcon events or other logs.

For hostname `WIN-DFIR-042`, Chrome, and a launch at 14:32:09.417 UTC, the endpoint would see names like these:

```text
WIN-DFIR-042-Google-Chrome-Default-2026-11-28T14-32-09-417.xlsx
WIN-DFIR-042-Google-Chrome-Profile-1-2026-11-28T14-32-09-417.xlsx
WIN-DFIR-042-Google-Chrome-2026-11-28T14-32-09-417.zip
hindsight-2026-11-28T14-32-09-417.json
```

Each report carries the hostname, browser, profile, and timestamp. Spaces in browser and profile names become hyphens. The ZIP covers every matching profile, so its name omits the profile. The JSON file stays in the working directory for the collector’s process checks. For case records, pair the archive name with the Falcon sensor ID and Fusion run ID, since the filename alone does not uniquely identify a sensor or record who collected it.

## What the ZIP check actually proves

The revised collector can tell whether the expected files made it into the archive at the expected sizes. Its view of Hindsight is more limited. After the launch action returns, the collector can observe whether a recorded process is still running, but it cannot read that process's eventual exit code. Opening the reports and checking their contents is still part of validating the workflow.

That distinction matters when an analyst sees a green status in Fusion. A successful collection means the archive passed the collector's checks. A successful retrieval means RTR made it available. Each status tells you where to look when something is missing.

## What I tested

The PowerShell regression checks cover a populated working directory, missing profiles, launch errors, a process that's still running, and compression failures. Those checks passed locally. The deployed workflow still needs an end-to-end Windows test to confirm how Fusion handles retrieval, timeouts, and cleanup.

The repository includes the three scripts, their JSON schemas, and a first-run checklist for Falcon. [Hindsight workflow source and setup guide](https://github.com/alexandruhera/crowdstrike-hindsight-soar/tree/eeabea24ea12ee26defd47e2f325b03b84f59456)
