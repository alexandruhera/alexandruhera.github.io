---
title: "Browser forensics with Falcon Fusion and Hindsight"
date: 2026-11-28
description: "A walkthrough of the PowerShell stages behind browser profile discovery, UTC report naming, and ZIP collection."
---

Browser artifacts can help put an incident in order. I built this workflow to run Hindsight against the interactive Windows user's browser profiles and package the reports for retrieval through CrowdStrike Falcon RTR. The examples below follow the linked script revision and use a fictional sensor, hostname, and run time.

## What the operator configures

The trigger schema requires `deviceID`, `selected_browser`, and `output_format`. It declares Google Chrome and XLSX as defaults. It also accepts Microsoft Edge and Brave, and the `jsonl` and `sqlite` formats. These are the fields sent to the trigger. [Trigger schema](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/schemas/trigger-input.schema.json)

```json
{
  "deviceID": "0123456789abcdef0123456789abcdef",
  "selected_browser": "Google Chrome",
  "output_format": "xlsx"
}
```

**Prepare** receives `forensic_analysis_path`. It rejects an empty path or a filesystem root. If the supplied path exists, it deletes it recursively, including its contents, then creates the directory and returns the supplied path. **Process** receives that path, the staged executable path as `forensic_tool_path`, the hostname as `system_hostname`, and the browser and format from the trigger. **Collect** receives the directory, hostname, and browser, plus `forensic_results` and `analysis_timestamp` from Process. The scripts return `has_processing_errors` and include `exception_messages` on failure. [Prepare](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/prepare.ps1) · [Process](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/process.ps1) · [Collect](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/collect.ps1)

## How profile discovery works

PowerShell reads `Win32_ComputerSystem.UserName` and removes the domain prefix. It checks `Win32_UserProfile` for a local profile whose folder name matches that username and requires exactly one match. From that profile, it appends the path associated with the browser selected in Fusion.

The configured paths are relative to the Windows profile directory.

```text
Google Chrome
AppData\Local\Google\Chrome\User Data

Microsoft Edge
AppData\Local\Microsoft\Edge\User Data

Brave
AppData\Local\BraveSoftware\Brave-Browser\User Data
```

The script enumerates immediate child directories and matches `Default` or `Profile` followed by a whitespace character and one or more digits, such as `Profile 1`. It starts one Hindsight process per match and returns the profile names, their paths, and the expected result paths. [Process script](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/process.ps1)

There are two decisions here. The PowerShell script chooses the directory from the operator's browser selection. It then passes Hindsight `-i` for that profile path, `-o` for the output base, `-f` for the format, and `-t UTC` for the output timezone. It supplies no browser override. The linked upstream CLI revision documents that omitting the override lets Hindsight detect the browser from the profile's files. That behavior is documented for the linked upstream revision. Check the staged binary's version when validating it. [Process script](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/process.ps1) · [Hindsight CLI source](https://github.com/obsidianforensics/hindsight/blob/45ab943668ca763d402d3015851e86927b18d463/hindsight.py#L76-L104)

## How the filenames are built

Before starting Hindsight, Process takes the current UTC time once and formats it as `yyyy-MM-ddTHH-mm-ss-fff`. All profiles in that invocation share the same timestamp. Whitespace in browser and profile names becomes hyphens. The hostname is carried through as supplied. For a Chrome run on `WIN-DFIR-042` with `Default` and `Profile 1`, the expected reports look like this.

```text
WIN-DFIR-042-Google-Chrome-Default-2026-11-28T14-32-09-417.xlsx
WIN-DFIR-042-Google-Chrome-Profile-1-2026-11-28T14-32-09-417.xlsx
```

The ZIP name uses the same hostname, browser, and timestamp. The process manifest uses the timestamp alone after its `hindsight-` prefix. The collector puts the expected reports in the ZIP and keeps the process manifest outside it. [Process script](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/process.ps1) · [Collection script](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/collect.ps1)

```text
WIN-DFIR-042-Google-Chrome-2026-11-28T14-32-09-417.zip
hindsight-2026-11-28T14-32-09-417.json
```

In this example, the filename marks the processing invocation at 14:32:09.417 UTC. Hindsight's separate `-t UTC` argument selects the display timezone for the artifact timestamps in its output. That lets an analyst identify the run from the filename and read the artifact timeline in UTC. [Hindsight CLI source](https://github.com/obsidianforensics/hindsight/blob/45ab943668ca763d402d3015851e86927b18d463/hindsight.py#L99-L104)

## What collection verifies

Each call to Collect makes one attempt. It checks that the manifest and expected report paths agree. If a live process matches both the recorded process ID and start time, the script returns a processing error for that attempt. Once the expected reports exist and are non-empty, Collect builds a temporary ZIP, checks the number of entries, their names, and their uncompressed sizes, then moves the archive to its final path. Its success response includes `zip_file_path`. Fusion owns the retry schedule and the separate retrieval action. [Collection script](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/scripts/collect.ps1)

The archive checks verify that the expected files were packaged. The collector has no exit code for a Hindsight process that finished after the launch action returned. The local PowerShell regression suite covers directory reset, profile and launch failures, live-process detection, and ZIP creation failures. Retrieval, timeout, and cleanup still need an end-to-end run in Falcon on Windows. [Regression checks](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/tests/reliability.ps1) · [Falcon setup guide](https://github.com/alexandruhera/crowdstrike-hindsight-soar/blob/eeabea24ea12ee26defd47e2f325b03b84f59456/docs/setup.md)
