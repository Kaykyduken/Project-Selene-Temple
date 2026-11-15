# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Junta as métricas das regiões num arquivo pequeno (summary.json), para o site
# mostrar a comparação entre todas sem precisar baixar os 9 arquivos grandes.
# É chamado automaticamente no fim de build_site.py; também roda sozinho:
#     python3 build_summary.py
# Só usa a biblioteca padrão do Python.

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"


def main() -> None:
    catalog = json.loads((DATA_DIR / "sites.json").read_text(encoding="utf-8"))
    rows = []
    for site in catalog["sites"]:
        path = DATA_DIR / "sites" / f"{site['id']}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        rows.append({
            "id": site["id"],
            "sun_time_pct": data["metrics"]["sun_time_pct"]["value"],
            "earth_time_pct": data["metrics"]["earth_time_pct"]["value"],
            "longest_no_sun_h": data["metrics"]["longest_no_sun_h"]["value"],
            "fictitious": data["fictitious"],
        })
    periods = {(d := json.loads((DATA_DIR / "sites" / f"{r['id']}.json").read_text(encoding="utf-8")))["period"]["start_utc"]
               + "|" + d["period"]["end_utc"] for r in rows}
    summary = {"contract_version": "0.1", "same_period": len(periods) == 1, "sites": rows}
    (DATA_DIR / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    print(f"Resumo de {len(rows)} regiões salvo em {DATA_DIR / 'summary.json'}")


if __name__ == "__main__":
    main()
