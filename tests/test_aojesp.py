"""Testes sem internet para evitar atualizar valores incorretos."""
import sys
import unittest
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from atualizar_diligencias_aojesp import parse_aojesp, update_data

BASE={"cota_gratuita":103.16,"antecipacao":2755.71,"competencia":"Setembro/2026", "atualizado_em":"2026-11-13"}

class TestAOJESP(unittest.TestCase):
    def test_parse_public_html(self):
        source='''<main><h3>Diligências</h3>
<h3>Diligência Gratuita: R$ 103,16&nbsp;(Setembro/2026)</h3>
<h3>Valor da Antecipação: R$ 2.755,71</h3></main>'''
        self.assertEqual(parse_aojesp(source),{'cota_gratuita':103.16,'antecipacao':2755.71,'competencia':'Setembro/2026'})
    def test_parse_updated_values(self):
        source='''<h3>Diligência Gratuita: R$ 109,85 (Outubro/2026)</h3><h3>Valor da Antecipação: R$ 2.901,99</h3>'''
        got=parse_aojesp(source)
        after,updated=update_data(BASE,got,date(2026,11,14))
        self.assertEqual(after['cota_gratuita'],109.85)
        self.assertEqual(after['antecipacao'],2901.99)
        self.assertEqual(after['competencia'],'Outubro/2026')
        self.assertEqual(after['atualizado_em'],'2026-11-14')
        self.assertEqual(set(updated),{'cota_gratuita','antecipacao','competencia'})
    def test_missing_advance_retains_old(self):
        got=parse_aojesp('<h3>Diligência Gratuita: R$ 105,00 (Outubro/2026)</h3>')
        after,_=update_data(BASE,got,date(2026,11,14))
        self.assertEqual(after['cota_gratuita'],105.0)
        self.assertEqual(after['antecipacao'],2755.71)
    def test_missing_both_retains_all(self):
        after,changes=update_data(BASE,parse_aojesp('<html><h3>Diligências</h3></html>'),date(2026,11,14))
        self.assertEqual(after,BASE)
        self.assertFalse(changes)
    def test_identical_does_not_commit(self):
        got=parse_aojesp('<h3>Diligência Gratuita: R$ 103,16 (Setembro/2026)</h3><h3>Valor da Antecipação: R$ 2.755,71</h3>')
        after,changes=update_data(BASE,got,date(2026,11,14))
        self.assertEqual(after,BASE)
        self.assertFalse(changes)
    def test_conflict_fails_safely(self):
        with self.assertRaises(ValueError):
            parse_aojesp('<h3>Diligência Gratuita: R$ 103,16 (Setembro/2026)</h3><h3>Diligência Gratuita: R$ 990,16 (Outubro/2026)</h3>')
    def test_reject_future_outliers(self):
        with self.assertRaises(ValueError):
            parse_aojesp('<h3>Diligência Gratuita: R$ 999999,99</h3>')
    def test_old_competence_not_applied(self):
        after,changes=update_data(BASE,{'cota_gratuita':95.0,'competencia':'Agosto/2026','antecipacao':2800.0},date(2026,11,14))
        self.assertEqual(after['cota_gratuita'],103.16)
        self.assertEqual(after['antecipacao'],2800.0)
        self.assertEqual(changes,['antecipacao'])
    def test_html_without_scripts(self):
        text='''<script>Diligência Gratuita: R$ 1,00</script><style>Valor da Antecipação: R$ 999,99</style>
        <h3>Diligência Gratuita: R$ 103,16 (Setembro/2026)</h3><h3>Valor da Antecipação: R$ 2.755,71</h3>'''
        self.assertEqual(parse_aojesp(text)['cota_gratuita'],103.16)

if __name__=='__main__':unittest.main()
