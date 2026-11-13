# RemuneraTJ

O simulador está em `index.html`. **O arquivo de parâmetros é `js/tabelas.js`**.
Para alterar salários, GAJ, progressões, auxílios e previdência sem programar,
use `../ferramentas/abrir_atualizador.bat` no Windows ou gere o executável com
`../ferramentas/criar_executavel.bat`.

A página calcula apenas quando você clica em **Calcular remuneração**, não
ao editar campos. O módulo compartilhado `../shared/js/calculo.js` deve ser
preservado para manter a versão original do IRPF; há fallback se estiver ausente.

Leia `../README.md` e `../AUDITORIA_CODIGO.md` antes de usar ou publicar.

Desenvolvido por **Jonatas Calefi dos Santos** — jonatasklfsantos@outlook.com.
Este projeto é **não oficial** do TJSP.
