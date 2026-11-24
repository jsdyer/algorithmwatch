# Algorithm Watch

<!-- coolcode:guide -->
Filter the register by institution, status or personal-information use and open the original fields before exporting your selection. An unknown impact level means no verified assessment join is available; blank source fields remain unreported.
<!-- /coolcode:guide -->

A static index of the Government of Canada AI Register MVP. Search systems and filter by institution, reported status, personal information and verified impact level. Open any record to see its source fields, then export the filtered results to CSV.

```sh
python3 scripts/build.py
python3 -m http.server --directory dist 8000
```

The build retrieves the documented official CSV, checks its schema and unique identifiers, and publishes a local JSON index to `dist/`. Build from a saved source file with `python3 scripts/build.py --register path/to/official.csv`. The register may not be comprehensive. The source supplies status dates and personal-information fields, with blanks left as unreported.

`data/assessments.json` contains individually reviewed Algorithmic Impact Assessment joins. Each join requires an exact normalized register ID, name and institution match. Its level is transcribed from the impact level explicitly published in the linked official PDF. Unmatched levels remain unknown. The match coverage can be expanded by reviewing new published assessments.

Source: [Treasury Board of Canada Secretariat, Government of Canada AI Register MVP](https://open.canada.ca/data/dataset/fcbc0200-79ba-4fa4-94a6-00e32facea6b). Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

<!-- schedule-reliability -->
## Schedule reliability

Public GitHub repositories can have scheduled workflows disabled after 60 days of inactivity. A separate weekly [schedule guard](.github/workflows/schedule-guard.yml) calls GitHub's enable-workflow API for an explicit list of refresh workflows and itself. It can restore workflows disabled for inactivity, preserves manually disabled workflows, and runs independently of collection failures.

This is an interim mitigation, not a scheduling guarantee: GitHub does not document active-workflow renewal as a permanent exemption, and scheduled runs can be delayed or dropped. A scheduler on our own Linux server is the planned independent trigger. The guard does not collect data, create dummy commits, or change source/check timestamps; successful collection and published data freshness still need monitoring.
<!-- /schedule-reliability -->
