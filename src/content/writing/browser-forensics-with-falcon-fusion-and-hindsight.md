---
title: "Browser forensics with Falcon Fusion SOAR and Hindsight"
date: 2026-11-23
description: "How a Windows browser collection outlives an RTR action, what a seven-day profile filter selects, and when Fusion can safely retrieve the ZIP."
draft: false
---

In June 2025, I wanted an analyst to be able to pick a Windows endpoint and a browser in CrowdStrike Falcon, then come back to a downloadable archive. Hindsight could parse the browser artifacts. The awkward part was timing. The Fusion script action I was using gave me no timeout setting, and a large profile could keep Hindsight busy after the action needed to return.

I split the work in two. One RTR script launches Hindsight on the endpoint. A second RTR script checks on the results each time Fusion calls it. In the original workflow, Fusion allowed up to 15 collection attempts and 15 minutes. An archived run shows the completed **Get file** action with a download link. That is where I would send an analyst looking for the evidence after seeing the Slack notification. [Original collection loop](https://github.com/user-attachments/assets/20e18ed6-fd69-4de0-ace0-78411486a042) · [Completed Get file action](https://github.com/user-attachments/assets/517bfd0b-2fbc-47ff-97d1-5814e32ae646)

## What a seven-day collection selects

Consider an investigation involving Chrome on a shared Windows device. The workflow resolves the signed-in user's local profile, finds Chrome's user-data directory and enumerates directories such as `Default` and `Profile 1`. The lookback belongs on the on-demand trigger so the analyst can choose it for that investigation. Fusion passes the value to the processing script. The following trigger payload uses a synthetic sensor ID.

```json
{
  "deviceID": "00000000000000000000000000000001",
  "selected_browser": "Google Chrome",
  "output_format": "jsonl",
  "profile_history_days": 7
}
```

The file checked for each candidate is its Chromium `History` database. Suppose processing starts on November 22 at 12:00 UTC. With a seven-day lookback, a file last written on November 15 at exactly 12:00 UTC qualifies. A file last written one second earlier falls outside the window. An analyst can inspect the timestamp on a test profile with PowerShell.

```powershell
$history = Get-Item -LiteralPath 'C:\Users\Analyst\AppData\Local\Google\Chrome\User Data\Default\History'
$history.LastWriteTimeUtc.ToString('o')
```

That distinction matters when interpreting the evidence. A profile that qualifies can contain visits from months ago. A database write can reflect maintenance, and a browser may have uncheckpointed writes in a SQLite journal. The timestamp helps decide which profiles to process. To establish when a particular visit occurred, inspect the visit record in the parsed output. Omitting the days field keeps all the usual candidate profiles in scope. [SQLite write-ahead logging](https://sqlite.org/wal.html)

## When the file appears before the writer finishes

The original processing script returned the filenames it expected Hindsight to produce. The collector used PowerShell's `Test-Path` on each name. A missing file made Fusion sleep and try again. Once all paths existed, the collector tried to zip them.

A small test exposed the race. A synthetic writer created the first eight bytes of a result. The original collector ran, archived all eight and reported success. The writer then added eight more. The final file was 16 bytes long, and the archive contained half of it. This matters for JSONL because Hindsight opens its destination and writes records incrementally. A second test simulated a compressor returning without producing a ZIP. The collector detected the missing archive, but its error flag had already been computed, so it still returned the missing path as a success. Both reproductions used PowerShell 7.4 on Linux. [Original collector](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/7bf009c/001-hindsight-collection.ps1) · [Hindsight JSONL writer](https://github.com/RyanDFIR/hindsight/blob/v2026.11/pyhindsight/analysis.py#L3806)

## Giving Fusion a result it can act on

The refreshed handoff ties each poll to a processing run. The processor resolves the signed-in account to its Windows security identifier (SID), so a local account and a domain account with the same username can be distinguished. A background worker records a profile's outcome after Hindsight exits. Fusion can retry while work is pending, stop on failure, and proceed to retrieval once the collector has compared the SHA-256 of each decompressed entry with the corresponding Hindsight output. A run with no qualifying profiles has its own outcome, so the analyst can distinguish an empty selection from a broken collection. The upstream Fusion step supplies the working directory throughout. [Workflow diagrams](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/31a3a9cf82753a49924728c70f0649daa1166d6d/docs/workflow.md) · [Refreshed scripts and schemas](https://github.com/alexandruhera/crowdstrike-hindsight-soar/tree/31a3a9cf82753a49924728c70f0649daa1166d6d)

On a Falcon-managed test endpoint, I would start with one recent profile and one stale profile, then check the names in the downloaded ZIP. For the failure path, I would let the loop expire and verify the final notification and the evidence left on disk. The June 2025 screenshots document the earlier deployment. The current tenant's action timeout, field mappings and cleanup behavior need a fresh tenant run. CrowdStrike's public reference documents RTR API timeout controls, and the action available to a Fusion workflow has its own configuration. [RTR scripts in Fusion](https://developer.crowdstrike.com/foundry/logic-capabilities/rtr-scripts/) · [RTR Admin API](https://developer.crowdstrike.com/api-reference/collections/real-time-response-admin/)
