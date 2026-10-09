"""Probes for click.Duration beyond the hidden tests. Prints one line per probe: PASS/FAIL name."""
import pathlib, re, sys
from datetime import timedelta
import click
from click.testing import CliRunner

root = pathlib.Path(sys.argv[1])
res = {}

def run(t, args, default=None):
    @click.command()
    @click.option("--d", type=t, default=default, show_default=True)
    def cli(d):
        click.echo(repr(d))
    return CliRunner().invoke(cli, args)

D = click.Duration
r = run(D(), ["--d", "9" * 5000 + "s"])
res["huge_is_usage_error"] = r.exit_code == 2 and r.exception is not None and isinstance(r.exception, SystemExit)
r = run(D(), ["--d", "99999999999d"])
res["overflow_is_usage_error"] = r.exit_code == 2
r = run(D(min=timedelta(seconds=1), max=timedelta(hours=1)), ["--d", "2h"])
res["range_error_in_duration_syntax"] = r.exit_code == 2 and "1:00:00" not in r.output and re.search(r"\b1h\b", r.output) is not None
r = run(D(min=timedelta(seconds=1), max=timedelta(hours=1)), ["--help"])
res["range_in_help"] = "<=" in r.output or "between" in r.output.lower()
r = run(D(), ["--help"], default=timedelta(minutes=2))
res["default_in_duration_syntax"] = "0:02:00" not in r.output and "2m" in r.output
r = run(D(), ["--d", "1h30m"])
res["ok_value"] = r.exit_code == 0 and "5400" in r.output
r = run(D(), ["--d", "-5s"])
res["negative_message_says_negative"] = r.exit_code == 2 and "negative" in r.output.lower()
docs = "\n".join(p.read_text(errors="ignore") for p in (root / "docs").rglob("*") if p.suffix in (".md", ".rst"))
mentions = [l for l in docs.splitlines() if "Duration" in l or "1h30m" in l or "90s" in l]
res["docs_prose_and_example"] = len(mentions) >= 3 and ("1h30m" in docs or "90s" in docs or "5m" in docs)
for k, v in res.items():
    print("PASS" if v else "FAIL", k)
