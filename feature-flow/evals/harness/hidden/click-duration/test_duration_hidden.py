from datetime import timedelta

import pytest

import click
import click.types


def run(runner, type_, args, **opts):
    @click.command()
    @click.option("--wait", type=type_, **opts)
    def cli(wait):
        click.echo(f"wait={wait!r}")

    return runner.invoke(cli, args)


@pytest.mark.parametrize(
    ("value", "expect"),
    [
        ("90s", timedelta(seconds=90)),
        ("5m", timedelta(minutes=5)),
        ("1h30m", timedelta(hours=1, minutes=30)),
        ("2d4h", timedelta(days=2, hours=4)),
        ("1m500ms", timedelta(minutes=1, milliseconds=500)),
        ("250ms", timedelta(milliseconds=250)),
        ("1d2h3m4s5ms", timedelta(days=1, hours=2, minutes=3, seconds=4, milliseconds=5)),
        ("45", timedelta(seconds=45)),
        ("0s", timedelta(0)),
        ("0", timedelta(0)),
    ],
)
def test_parses(value, expect):
    assert click.Duration().convert(value, None, None) == expect


def test_exported():
    assert click.types.Duration is click.Duration


def test_timedelta_passes_through():
    value = timedelta(minutes=3)
    assert click.Duration().convert(value, None, None) == value


def test_defaults_and_envvar(runner):
    result = run(runner, click.Duration(), [], default=timedelta(minutes=1))
    assert result.exit_code == 0, result.output
    assert "wait=datetime.timedelta(seconds=60)" in result.output
    result = run(runner, click.Duration(), [], default="2m")
    assert "wait=datetime.timedelta(seconds=120)" in result.output
    result = runner.invoke(
        click.command()(
            click.option("--wait", type=click.Duration(), envvar="WAIT")(
                lambda wait: click.echo(f"wait={wait!r}")
            )
        ),
        [],
        env={"WAIT": "1h"},
    )
    assert "wait=datetime.timedelta(seconds=3600)" in result.output


@pytest.mark.parametrize(
    "value",
    ["", "abc", "5x", "1.5h", "30m1h", "1h1h", "-5s", "1h-30m", "h", "ms", "5 days"],
)
def test_rejects_as_usage_error(runner, value):
    result = run(runner, click.Duration(), ["--wait", value])
    assert result.exit_code == 2, result.output
    assert isinstance(result.exception, SystemExit)
    assert "Invalid value" in result.output
    assert "Traceback" not in result.output


def test_overflow_is_a_usage_error(runner):
    result = run(runner, click.Duration(), ["--wait", "99999999999d"])
    assert result.exit_code == 2, (result.output, result.exception)
    assert isinstance(result.exception, SystemExit)


def test_bounds_are_inclusive(runner):
    bounded = click.Duration(min=timedelta(seconds=1), max=timedelta(hours=1))
    assert run(runner, bounded, ["--wait", "1s"]).exit_code == 0
    assert run(runner, bounded, ["--wait", "1h"]).exit_code == 0
    assert run(runner, bounded, ["--wait", "30m"]).exit_code == 0
    for value in ["0s", "999ms", "1h1s", "2d"]:
        result = run(runner, bounded, ["--wait", value])
        assert result.exit_code == 2, (value, result.output)
        assert "Invalid value" in result.output


def test_one_sided_bounds(runner):
    assert run(runner, click.Duration(min=timedelta(minutes=1)), ["--wait", "59s"]).exit_code == 2
    assert run(runner, click.Duration(min=timedelta(minutes=1)), ["--wait", "3d"]).exit_code == 0
    assert run(runner, click.Duration(max=timedelta(minutes=1)), ["--wait", "61s"]).exit_code == 2
    assert run(runner, click.Duration(max=timedelta(minutes=1)), ["--wait", "0s"]).exit_code == 0


def test_help_metavar(runner):
    result = run(runner, click.Duration(), ["--help"])
    assert result.exit_code == 0
    assert "DURATION" in result.output


def test_info_dict():
    info = click.Duration().to_info_dict()
    assert info["param_type"] == "Duration"
    assert info["name"] == "duration"
