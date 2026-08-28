"""Export commanders.json for the thirty-two web app.

Reads the arcanists-rubric commander catalog (commander_entries in the
TrueNAS Postgres) and writes a minimal name -> colour-identity list:

    {"generated": "YYYY-MM-DD",
     "commanders": [["Zada, Hedron Grinder", "R", 0], ...]}

The third element is 1 when the commander can legally head a two-commander
pair (it appears in at least one partner/background pair entry). The app
uses it only for a soft warning, never to block.

Run from the arcanists-rubric checkout so DATABASE_URL is in scope:

    cd ~/projects/arcanists-rubric
    set -a && . ./.env && set +a
    backend/.venv/bin/python ~/projects/thirty-two/tools/export_commanders.py
"""

import datetime
import json
import os
import pathlib

import sqlalchemy as sa

OUT = pathlib.Path(__file__).resolve().parent.parent / "commanders.json"


def main() -> None:
    engine = sa.create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as conn:
        solos = conn.execute(sa.text(
            "select display_name, color_identity, oracle_ids "
            "from commander_entries where not is_pair")).fetchall()
        pair_rows = conn.execute(sa.text(
            "select oracle_ids from commander_entries where is_pair")).fetchall()

    pairable = {oid for (oids,) in pair_rows for oid in oids}
    # Double-faced names carry the back face ("Esika, God of the Tree // The
    # Prismatic Bridge"); people paste the front face, which is unique on its
    # own across the whole catalog.
    commanders = sorted(
        [name.split(" // ")[0], identity, 1 if oids[0] in pairable else 0]
        for name, identity, oids in solos)

    payload = {
        "generated": datetime.date.today().isoformat(),
        "commanders": commanders,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(blob + "\n")
    # Same payload as a script global, so index.html works from file:// where
    # fetch() of a local JSON is blocked.
    OUT.with_suffix(".js").write_text("window.T32_DATA=" + blob + ";\n")
    n_pairable = sum(1 for c in commanders if c[2])
    print(f"wrote {len(commanders)} commanders ({n_pairable} pairable) -> "
          f"{OUT} and commanders.js")


if __name__ == "__main__":
    main()
