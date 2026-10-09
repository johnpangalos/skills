"""Generate a monorepo-sized services/ tree (400 services x 6 files) for the
escalation scenario. Every repo.py builds SQL with f-strings on purpose."""

import pathlib
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".") / "services"
TABLES = ["orders", "customers", "invoices", "shipments", "refunds", "coupons", "stock", "reviews"]

for n in range(400):
    table = TABLES[n % len(TABLES)]
    svc = root / f"svc_{n:03d}"
    svc.mkdir(parents=True, exist_ok=True)
    (svc / "__init__.py").write_text("")
    (svc / "repo.py").write_text(
        f'''def find(db, key):
    return db.execute(f"SELECT * FROM {table} WHERE id = '{{key}}'").fetchone()


def search(db, term, limit=20):
    sql = "SELECT * FROM {table} WHERE name LIKE '%" + term + "%' LIMIT " + str(limit)
    return db.execute(sql).fetchall()
'''
    )
    (svc / "handlers.py").write_text(
        "from . import repo\n\n\ndef get(db, request):\n    return repo.find(db, request.args['id'])\n"
    )
    (svc / "config.py").write_text(f'NAME = "svc_{n:03d}"\nTABLE = "{table}"\n')
    (svc / "README.md").write_text(f"# svc_{n:03d}\n\nOwns the `{table}` table.\n")
    (svc / "test_repo.py").write_text("def test_placeholder():\n    assert True\n")
