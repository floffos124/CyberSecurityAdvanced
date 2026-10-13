"""Laat de pipeline falen op Semgrep-bevindingen (ERROR/WARNING) die niet in .semgrep-baseline staan."""
import json
import sys

FAIL_SEVERITIES = {"ERROR", "WARNING"}

report_path, baseline_path = sys.argv[1], sys.argv[2]

accepted = set()
with open(baseline_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#"):
            rule_id, path = line.split()
            accepted.add((rule_id, path))

with open(report_path) as f:
    report = json.load(f)

if report.get("errors"):
    print(f"Semgrep meldde {len(report['errors'])} fout(en) tijdens de scan:")
    for err in report["errors"]:
        print(f"  {err.get('type')}: {err.get('message', '')[:200]}")
    sys.exit(1)

new = []
for r in report["results"]:
    key = (r["check_id"], r["path"])
    severity = r["extra"]["severity"]
    status = "aanvaard" if key in accepted else "NIEUW"
    print(f"[{severity}] {r['check_id']} {r['path']}:{r['start']['line']} ({status})")
    if severity in FAIL_SEVERITIES and key not in accepted:
        new.append(r)

if new:
    print(f"\n{len(new)} nieuwe bevinding(en) met severity {'/'.join(sorted(FAIL_SEVERITIES))}: pipeline faalt.")
    sys.exit(1)
print("\nGeen nieuwe bevindingen buiten de baseline.")
