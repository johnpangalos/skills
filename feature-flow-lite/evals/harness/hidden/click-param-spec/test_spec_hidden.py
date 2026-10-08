"""Hidden tests for Parameter.spec (upstream tests from pallets/click#3877, plus extras)."""

import warnings

import pytest

import click
from click.parser import _split_opt


@pytest.mark.parametrize(
    ("param_decls", "expected_spec", "expected_name"),
    [
        (["-t", "--times"], "--times", "times"),
        (["--times", "-t"], "--times", "times"),
        (["-t"], "-t", "t"),
        (["-t", "--times", "--repeat"], "--times", "times"),
        (["--color/--no-color"], "--color", "color"),
        (["/debug;/no-debug"], "/debug", "debug"),
    ],
)
def test_option_spec(param_decls, expected_spec, expected_name):
    opt = click.Option(param_decls)
    assert opt.spec == expected_spec
    assert opt.name == expected_name
    assert _split_opt(opt.spec)[1].replace("-", "_").lower() == opt.name


def test_option_spec_with_explicit_name():
    opt = click.Option(["--times", "repeat_count"])
    assert opt.spec == "--times"
    assert opt.name == "repeat_count"


@pytest.mark.parametrize(
    ("kwargs", "expected_spec", "expected_help_spec"),
    [
        ({}, "FILENAME", "FILENAME"),
        ({"required": False}, "FILENAME", "[FILENAME]"),
        ({"nargs": -1}, "FILENAME", "[FILENAME]..."),
        ({"metavar": "<file>"}, "<file>", "<file>"),
    ],
)
def test_argument_spec_and_help_spec(kwargs, expected_spec, expected_help_spec):
    arg = click.Argument(["filename"], **kwargs)
    ctx = click.Context(click.Command("cli"))
    assert arg.spec == expected_spec
    assert arg.get_help_spec(ctx) == expected_help_spec


@pytest.mark.parametrize("help_text", [None, "path to the file"])
def test_argument_help_spec_matches_help_record(help_text):
    arg = click.Argument(["filename"], help=help_text)
    ctx = click.Context(click.Command("cli"))
    assert arg.get_help_spec(ctx) == "FILENAME"
    assert arg.get_help_record(ctx)[0] == arg.get_help_spec(ctx)


def test_get_help_spec_lives_on_parameter():
    assert "get_help_spec" in click.Parameter.__dict__
    assert "spec" in click.Parameter.__dict__


@pytest.mark.parametrize(
    ("param", "expected"),
    [
        (click.Option(["-t", "--times"]), "--times"),
        (click.Argument(["filename"]), "FILENAME"),
    ],
    ids=["option", "argument"],
)
def test_human_readable_name_deprecated(param, expected):
    with pytest.warns(DeprecationWarning, match="human_readable_name"):
        assert param.human_readable_name == expected
    assert param.spec == expected


@pytest.mark.parametrize("base", [click.Parameter, click.Option, click.Argument])
def test_human_readable_name_override_warns_at_class_definition(base):
    with pytest.warns(DeprecationWarning, match="spec"):

        class Custom(base):  # type: ignore[misc, valid-type]
            @property
            def human_readable_name(self) -> str:
                return "custom"


@pytest.mark.parametrize("base", [click.Parameter, click.Option, click.Argument])
def test_subclass_without_override_is_silent(base):
    with warnings.catch_warnings():
        warnings.simplefilter("error", DeprecationWarning)

        class Custom(base):  # type: ignore[misc, valid-type]
            pass


def test_click_itself_never_reads_human_readable_name(runner):
    @click.command()
    @click.option("--my-option", type=int, deprecated=True)
    @click.option("--count", type=int, required=True)
    @click.argument("src")
    def cli(my_option, count, src):
        pass

    with warnings.catch_warnings():
        warnings.simplefilter("error", DeprecationWarning)
        for args in (["--my-option", "x", "a"], ["a"], ["--count", "1"], ["--count", "1", "--my-option", "2", "a"]):
            result = runner.invoke(cli, args)
            assert not isinstance(result.exception, DeprecationWarning), (args, result.exception)


def test_deprecated_option_message_uses_spec(runner):
    @click.command()
    @click.option("--my-option", deprecated=True)
    def cli(my_option):
        pass

    result = runner.invoke(cli, ["--my-option", "hello"])
    assert "option '--my-option' is deprecated" in result.output


def test_error_messages_use_spec(runner):
    @click.command()
    @click.option("-c", "--max-count", type=int)
    @click.option("--level", type=int, required=True)
    @click.argument("input_file")
    def cli(max_count, level, input_file):
        pass

    result = runner.invoke(cli, ["--level", "1", "--max-count", "x", "a"])
    assert result.exit_code == 2
    assert "'--max-count'" in result.output and "max_count" not in result.output
    result = runner.invoke(cli, ["a"])
    assert "'--level'" in result.output
    result = runner.invoke(cli, ["--level", "1"])
    assert "INPUT_FILE" in result.output
