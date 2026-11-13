#!/usr/bin/env python3
"""Atualiza valores de diligências AOJESP com validação e fallback seguro.

Uso no GitHub Actions: python scripts/atualizar_diligencias_aojesp.py
Teste offline: python scripts/atualizar_diligencias_aojesp.py --html-file teste.html

A automação nunca zera um valor ausente/ilegível e não modifica dados em caso
 de falha na consulta. Faz no máximo uma leitura diária à fonte pública.
"""
from __future__ import annotations

import argparse
from datetime import date
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SITE = "https://aojesp.org.br/"
DATA_PATH = Path(__file__).resolve().parents[1] / "dados" / "diligencias-aojesp.json"
MONEY = r"R\s*\$\s*([\d\.]+,\d{2})"
GRATUITA_RE = re.compile(r"dilig[eê]ncia\s+gratuita\s*:?\s*" + MONEY, re.I)
ANTECIPACAO_RE = re.compile(r"valor\s+da\s+antecipa[cç][aã]o\s*:?\s*" + MONEY, re.I)
COMP_RE = re.compile(r"\(\s*([a-zçãéêíóôú]+\s*/\s*20\d{2})\s*\)", re.I)
MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5,
    "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
}


def normalized(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", text.lower())
                   if unicodedata.category(ch) != "Mn")


class ContentParser(HTMLParser):
    """Extrai texto visível e cabeçalhos, ignorando scripts e estilos."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.head_depth = 0
        self.curr_head: list[str] = []
        self.headings: list[str] = []
        self.text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "template"):
            self.skip += 1
        if not self.skip and tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.head_depth += 1
            if self.head_depth == 1:
                self.curr_head = []

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template"):
            self.skip = max(0, self.skip - 1)
        if not self.skip and tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self.head_depth:
            self.head_depth -= 1
            if not self.head_depth:
                heading = " ".join(" ".join(self.curr_head).split())
                if heading:
                    self.headings.append(heading)

    def handle_data(self, value):
        if not self.skip:
            if value.strip():
                self.text.append(value)
                if self.head_depth:
                    self.curr_head.append(value)


def currency(text: str, low: str, high: str) -> float:
    cleaned = text.replace(".", "").replace(",", ".")
    try:
        value = Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError(f"Moeda ilegível: {text}") from exc
    if not Decimal(low) <= value <= Decimal(high):
        raise ValueError(f"Valor fora do intervalo esperado: R$ {text}")
    return float(value)


def parse_competence(text: str) -> str | None:
    m = COMP_RE.search(text)
    if not m:
        return None
    month, year = re.split(r"\s*/\s*", m.group(1))
    if normalized(month) not in MONTHS or not 2024 <= int(year) <= 2050:
        return None
    return month.capitalize() + "/" + year


def competence_sort(comp: str) -> int | None:
    try:
        month, year = comp.split("/")
        return int(year) * 12 + MONTHS[normalized(month)]
    except (ValueError, KeyError):
        return None


def unique_match(lines: list[str], pattern: re.Pattern[str], low: str, high: str):
    finds = []
    for line in lines:
        m = pattern.search(line)
        if m:
            finds.append((currency(m.group(1), low, high), line))
    if not finds:
        return None
    values = {money for money, _ in finds}
    if len(values) > 1:
        raise ValueError("Fonte AOJESP apresenta valores conflitantes da mesma rubrica")
    return finds[0]


def parse_aojesp(html: str) -> dict:
    parser = ContentParser()
    parser.feed(html)
    # Preferir cabeçalhos porque os valores aparecem como h3 na página principal.
    headings = parser.headings
    unique = lambda p,lo,hi: unique_match(headings, p, lo, hi)
    gratis = unique(GRATUITA_RE, "1", "1000")
    antec = unique(ANTECIPACAO_RE, "100", "20000")
    # A seleção integral é somente fallback, para uma mudança futura de tag.
    # Blocos vizinhos separados por '\n' evitam misturar valores não relacionados.
    if gratis is None or antec is None:
        combined = "\n".join(" ".join(fragment.split()) for fragment in parser.text)
        textlines = [combined]
        # Em páginas sem h3 os rótulos e valores podem vir em nós adjacentes.
        # Isto não introduz um parse quando o texto não possui o rótulo explícito.
        if gratis is None:
            gratis = unique_match(textlines, GRATUITA_RE, "1", "1000")
        if antec is None:
            antec = unique_match(textlines, ANTECIPACAO_RE, "100", "20000")
    result = {}
    if gratis:
        result["cota_gratuita"] = gratis[0]
        competence = parse_competence(gratis[1])
        if competence:
            result["competencia"] = competence
    if antec:
        result["antecipacao"] = antec[0]
    return result


def update_data(previous: dict, current: dict, today: date) -> tuple[dict, list[str]]:
    next_data = dict(previous)
    updates = []
    old_comp = competence_sort(previous.get("competencia", ""))
    new_comp = competence_sort(current.get("competencia", ""))
    # Não retroceder a referência da cota. Atualização da antecipação é independente.
    if "cota_gratuita" in current:
        if old_comp is not None and (new_comp is None or new_comp < old_comp):
            print("AVISO: competência ausente ou anterior à armazenada; cota mantida.")
        else:
            if previous.get("cota_gratuita") != current["cota_gratuita"]:
                next_data["cota_gratuita"] = current["cota_gratuita"]
                updates.append("cota_gratuita")
            if current.get("competencia") and previous.get("competencia") != current["competencia"]:
                next_data["competencia"] = current["competencia"]
                updates.append("competencia")
    if "antecipacao" in current and previous.get("antecipacao") != current["antecipacao"]:
        next_data["antecipacao"] = current["antecipacao"]
        updates.append("antecipacao")
    if updates:
        next_data["atualizado_em"] = today.isoformat()
    return next_data, updates


def read_aojesp(timeout: int = 20) -> str:
    request = Request(SITE, headers={
        "User-Agent": "Mozilla/5.0 (compatible; RemuneraTJ/1.0; +https://github.com/Jonatasklf/Remuneratj)",
        "Accept": "text/html,application/xhtml+xml",
    })
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"HTTP {response.status} na AOJESP")
        content_type = response.headers.get("Content-Type", "").lower()
        if "text/html" not in content_type:
            raise ValueError(f"Resposta não é HTML: {content_type}")
        length = 0
        pieces = []
        while True:
            part = response.read(65536)
            if not part:
                break
            length += len(part)
            if length > 3_000_000:
                raise ValueError("HTML ultrapassou 3 MB")
            pieces.append(part)
        charset = response.headers.get_content_charset() or "utf-8"
        return b"".join(pieces).decode(charset, errors="replace")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--html-file", type=Path, help="Para testar offline com HTML local")
    ap.add_argument("--data", type=Path, default=DATA_PATH, help="Arquivo JSON do site")
    args = ap.parse_args(argv)
    try:
        prior = json.loads(args.data.read_text(encoding="utf-8"))
        if not isinstance(prior, dict) or not all(isinstance(prior.get(k), (int,float)) and prior[k]>0 for k in ("cota_gratuita","antecipacao")):
            raise ValueError("Arquivo JSON de referência inválido")
        html = args.html_file.read_text(encoding="utf-8") if args.html_file else read_aojesp()
        extracted = parse_aojesp(html)
        if not extracted:
            print("AVISO: AOJESP não apresentou valores reconhecíveis. Mantendo o último arquivo válido.")
            return 0
        updated, changes = update_data(prior, extracted, date.today())
        for field in ("cota_gratuita", "antecipacao"):
            if field not in extracted:
                print(f"AVISO: {field} ausente na AOJESP. Mantendo o último valor válido: {prior[field]}")
        if not changes:
            print("Nenhum valor novo validado; referências anteriores mantidas.")
            return 0
        updated["fonte"] = SITE
        args.data.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("Referências atualizadas:", ", ".join(changes))
        print(f"Cota gratuita: R$ {updated['cota_gratuita']:.2f}; antecipação: R$ {updated['antecipacao']:.2f}; competência: {updated.get('competencia','')}")
        return 0
    except (OSError, ValueError, HTTPError, URLError, json.JSONDecodeError) as error:
        # Erros não modificam o arquivo publicado. Status de falha fica visível no Actions.
        print(f"ERRO: leitura/validação falhou; o último JSON válido foi preservado. Detalhe: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
