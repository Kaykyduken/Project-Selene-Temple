# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Lê o "rótulo" (.LBL) que acompanha os arquivos do PDS (arquivo de dados da NASA).
#
# Por que isso é necessário: nos DEMs do LOLA em .JP2, cada pixel guarda um
# número inteiro, e a altura real em metros é  inteiro * SCALING_FACTOR.
# Para o LDEM_80S_20M o fator é 0.5 (ou seja, o inteiro 2000 significa 1000 m).
# Esse fator NÃO está dentro do .JP2, só no .LBL. Sem ele as alturas saem dobradas.
#
# O OFFSET do rótulo (1737400 m) é o raio de referência da Lua: somando, vira
# "distância ao centro da Lua". Nós trabalhamos com altura em relação à esfera
# de referência, então o OFFSET não é somado.

import re
from pathlib import Path


def find_label(data_file: Path) -> Path | None:
    """Procura o .LBL do arquivo: 'NOME_JP2.LBL' (padrão do LOLA) ou 'NOME.LBL'."""
    suffix = data_file.suffix.lstrip(".").upper()
    for name in (f"{data_file.stem}_{suffix}.LBL", f"{data_file.stem}.LBL"):
        candidate = data_file.with_name(name)
        if candidate.exists():
            return candidate
    return None


def read_height_scale(data_file: Path) -> float | None:
    """Devolve o SCALING_FACTOR do rótulo, ou None se não houver rótulo/campo."""
    label = find_label(data_file)
    if label is None:
        return None
    text = label.read_text(encoding="latin-1")
    match = re.search(r"^\s*SCALING_FACTOR\s*=\s*([-+0-9.eE]+)", text, flags=re.MULTILINE)
    return float(match.group(1)) if match else None
