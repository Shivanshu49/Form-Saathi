# Pilot study records

`results-template.json` is the empty shape a study copies into `results/` — one
file per session or per day, each `{ "protocolVersion": "1.0", "sessions": [...] }`.
Every session record is validated by `report.ts` against the schema described in
[the usability protocol](../docs/usability-protocol.md): a pseudonym, the
condition and order position, the workflow, variant and scenario, and counts
and durations. There is no field for a name, a field value, a transcript or a
recording, and unknown keys are rejected, so nothing personal can be filed here
by accident. Observations go in a separate session log kept outside this
repository.

```bash
node studies/report.ts studies/results/*.json > studies/report.md
```

The generator prints an empty report when there are no sessions and never fills
in placeholder numbers. `results/` is committed empty on purpose: no participant
session has been run, and this repository must never contain invented results.
