# Parafuso & Carga

Verificação e seleção de parafusos, barras roscadas e parafusos de pressão a partir do
carregamento, com memorial de cálculo completo e relatório em PDF e Word.

**Site:** https://matheusmerlim1.github.io/parafuso-carga/

## Modelos

| Aba | O que verifica |
|---|---|
| Junta axial | Tração e cisalhamento repartidos; pré-carga, rigidez (Wileman), separação da junta, corte, esmagamento, interação, atrito e fadiga (Goodman) |
| Grupo na chapa | Carga excêntrica num grupo de parafusos: corte primário F/n e secundário M·r/Σr² (Shigley §8-12) |
| Poste na base | Placa de base com chumbadores: giro sobre a borda comprimida, F = M·d/Σd² |
| Parafuso de pressão | Nivelamento sob carga axial: torque para subir e descer, compressão + torção, flambagem, espanamento dos filetes e esmagamento da base |

Para cada combinação de rosca (M4 a M48) e classe (ISO 898-1 e ISO 3506-1), a página calcula o
coeficiente de segurança da verificação que governa e indica o menor tamanho que atende,
destacando as roscas e classes de uso frequente no mercado.

## Estrutura

```
index.html
css/style.css          tema, layout, memorial e impressão
js/dados.js            roscas, classes, materiais, fatores
js/calculo.js          cálculo (sem DOM)
js/memorial.js         memorial de cálculo passo a passo
js/desenho.js          desenhos e animações em SVG
js/relatorio.js        relatório PDF (impressão) e Word (.docx, gerado sem bibliotecas)
js/app.js              interface
```

HTML, CSS e JavaScript puros, sem build: basta abrir o `index.html`.

## Fontes

BUDYNAS, R. G.; NISBETT, J. K. *Elementos de Máquinas de Shigley*, 10ª ed. — cap. 8 e §4-11.
NORTON, R. L. *Projeto de Máquinas*, cap. 15. ISO 898-1, ISO 3506-1, ISO 261/262, ISO 4032.

Ferramenta de pré-dimensionamento. Não substitui a verificação e a ART de um engenheiro responsável.
