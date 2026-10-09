"""Probes for Parameter.spec beyond the hidden tests."""
import warnings, click
res = {}
def warned_from_here(define):
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        define()
    return [x for x in w if issubclass(x.category, DeprecationWarning)], __file__
def plain():
    class O(click.Option):
        @property
        def human_readable_name(self):
            return "x"
ws, f = warned_from_here(plain)
res["subclass_warning_points_at_user"] = bool(ws) and ws[0].filename == f
class Mid(click.Option):
    def __init_subclass__(cls, **kw):
        super().__init_subclass__(**kw)
def mid():
    class O2(Mid):
        @property
        def human_readable_name(self):
            return "x"
ws, f = warned_from_here(mid)
res["subclass_warning_through_intermediate"] = bool(ws) and ws[0].filename == f
def noov():
    class O3(click.Option):
        pass
ws, _ = warned_from_here(noov)
res["no_warning_without_override"] = not ws
res["option_spec"] = click.Option(["-t", "--times"]).spec == "--times"
res["argument_spec"] = click.Argument(["filename"]).spec == "FILENAME"
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    v = click.Option(["--my-opt"]).human_readable_name
res["hrn_warns_and_returns_spec"] = v == "--my-opt" and any(issubclass(x.category, DeprecationWarning) and x.filename == __file__ for x in w)
for k, v in res.items():
    print("PASS" if v else "FAIL", k)
