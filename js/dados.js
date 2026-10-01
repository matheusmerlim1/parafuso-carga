/* ---------- dados normalizados ---------- */

/* Rosca métrica grossa (ISO 261 / ISO 262). A área de tração segue a ISO 898-1:
   At = π/4·(d − 0,9382·p)². Porca: altura m da ISO 4032 (sextavada estilo 1). */
const ROSCAS = [
  // d (mm), passo p (mm), altura da porca m (mm)
  [4, 0.7, 3.2], [5, 0.8, 4.7], [6, 1.0, 5.2], [8, 1.25, 6.8], [10, 1.5, 8.4],
  [12, 1.75, 10.8], [14, 2.0, 12.8], [16, 2.0, 14.8], [18, 2.5, 15.8], [20, 2.5, 18.0],
  [22, 2.5, 19.4], [24, 3.0, 21.5], [27, 3.0, 23.8], [30, 3.5, 25.6], [33, 3.5, 28.7],
  [36, 4.0, 31.0], [42, 4.5, 34.0], [48, 5.0, 38.0]
].map(([d, p, m]) => ({
  nome: 'M' + d, d, p, m,
  At: Math.PI / 4 * (d - 0.9382 * p) ** 2,       // área de tração
  dr: d - 1.226869 * p,                            // diâmetro menor (ISO 724, d3)
  Ad: Math.PI / 4 * d * d                          // área do corpo liso
}));

/* Uso frequente no mercado brasileiro — orientação, não dado de catálogo.
   Roscas: 1ª escolha da ISO 261 com estoque corrente (M14, M18, M22, M27 e M33 são 2ª escolha;
   M42 e M48 costumam ser sob encomenda). Classes: as mais encontradas em cada elemento. */
const ROSCAS_FREQ = [4, 5, 6, 8, 10, 12, 16, 20, 24, 30, 36];
const ROSCAS_2A = [14, 18, 22, 27, 33];
const CLASSES_FREQ = {
  parafuso: ['4.6', '8.8', '10.9', 'A2-70'],
  barra:    ['4.6', '8.8', 'A2-70'],
  pressao:  ['4.6', '8.8', 'A2-70']
};
const roscaFreq = d => ROSCAS_FREQ.includes(d);
const classeFreq = (tipo, id) => (CLASSES_FREQ[tipo] || []).includes(id);
const usoFrequente = a => roscaFreq(a.r.d) && classeFreq(a.tipo, a.classe.id);

/* Classes de resistência. Sp = resistência de prova, Sy = escoamento, Sut = ruptura (MPa).
   Aço carbono: ISO 898-1 (a 8.8 muda de valor acima de M16).
   Inox: ISO 3506-1; não há carga de prova normalizada, usa-se Rp0,2 no lugar de Sp.
   Se = limite de fadiga corrigido da rosca laminada (Shigley, Tab. 8-17); onde a tabela
   não traz a classe, estimado por Se ≈ 0,155·Sut, a mesma proporção das classes tabeladas. */
const CLASSES = [
  {id:'4.6',   tipo:'carbono', Sp:225, Sy:240, Sut:400, Se:62,  seEst:true,  E:207000, uso:'Baixa exigência, aço baixo carbono'},
  {id:'5.8',   tipo:'carbono', Sp:380, Sy:420, Sut:520, Se:81,  seEst:true,  E:207000, uso:'Uso geral'},
  {id:'8.8',   tipo:'carbono', Sp:580, Sy:640, Sut:800, Se:129, seEst:false, E:207000, uso:'Padrão em máquinas e estruturas',
    acima16:{Sp:600, Sy:660, Sut:830}},
  {id:'10.9',  tipo:'carbono', Sp:830, Sy:940, Sut:1040, Se:162, seEst:false, E:207000, uso:'Juntas de alta responsabilidade'},
  {id:'12.9',  tipo:'carbono', Sp:970, Sy:1100, Sut:1220, Se:190, seEst:false, E:207000, uso:'Alta pré-carga, espaço restrito (em geral cabeça cilíndrica ISO 4762)'},
  {id:'A2-70', tipo:'inox',    Sp:450, Sy:450, Sut:700, Se:109, seEst:true,  E:193000, uso:'Inox austenítico (A2 = 304, A4 = 316), mesmas propriedades'},
  {id:'A4-80', tipo:'inox',    Sp:600, Sy:600, Sut:800, Se:124, seEst:true,  E:193000, uso:'Inox 316 encruado, maior resistência'}
];
/* propriedades efetivas da classe para o diâmetro d */
function propsClasse(c, d) {
  return (c.acima16 && d > 16) ? {...c, ...c.acima16} : c;
}

/* Rigidez dos membros pelo ajuste exponencial de Wileman (Shigley, eq. 8-23 e Tab. 8-8):
   km = E·d·A·exp(B·d/l). Sy é um valor de referência para o esmagamento da chapa. */
const MEMBROS = [
  {id:'aco',      nome:'Aço estrutural (ASTM A36)', E:206800, A:0.78715, B:0.62873, Sy:250},
  {id:'aco-a572', nome:'Aço ASTM A572 Gr.50',       E:206800, A:0.78715, B:0.62873, Sy:345},
  {id:'aluminio', nome:'Alumínio (6061-T6)',        E:71000,  A:0.79670, B:0.63816, Sy:240},
  {id:'fofo',     nome:'Ferro fundido cinzento',    E:100000, A:0.77871, B:0.61616, Sy:170},
  {id:'cobre',    nome:'Cobre / bronze',            E:118600, A:0.79568, B:0.63553, Sy:200}
];

/* Fator de torque K (Shigley, Tab. 8-15): T = K·Fi·d */
const FATOR_K = [
  [0.30, 'Aço preto, sem acabamento'],
  [0.20, 'Zincado / sem lubrificação'],
  [0.18, 'Lubrificado (óleo)'],
  [0.16, 'Cadmiado'],
  [0.12, 'Pasta antiengripante']
];

/* Comprimentos comerciais de parafuso sextavado (ISO 4014 / ISO 4017), mm */
const COMPRIMENTOS = [10,12,16,20,25,30,35,40,45,50,55,60,65,70,75,80,90,100,110,120,130,140,150,160,180,200,220,240,260,280,300,320,340,360,380,400];

/* ---------- parafuso de pressão / nivelamento (carga axial de compressão) ---------- */

/* Material da rosca fêmea (porca soldada, chapa roscada ou furo roscado): Sy em MPa.
   A resistência ao cisalhamento é tomada como 0,577·Sy (von Mises). */
const FEMEAS = [
  {id:'aco',      nome:'Chapa de aço ASTM A36',          Sy:250},
  {id:'aco-a572', nome:'Chapa de aço ASTM A572 Gr.50',   Sy:345},
  {id:'porca8',   nome:'Porca de aço classe 8 (ISO 898-2)', Sy:640},
  {id:'fofo',     nome:'Ferro fundido cinzento',         Sy:170},
  {id:'aluminio', nome:'Alumínio 6061-T6',               Sy:240}
];

/* Contato da ponta com a base.
   plana: a ponta gira sobre a base; atrito num diâmetro efetivo 2/3·d_r (pressão uniforme)
   sapata: sapata articulada que não gira — sem atrito de ponta; a área de apoio é a da sapata */
const PONTAS = [
  {id:'plana',  nome:'Ponta plana (gira sobre a base)'},
  {id:'sapata', nome:'Sapata articulada (não gira)'}
];

/* Comprimento efetivo de flambagem Le = K·L (Shigley §4-11) */
const K_FLAMB = [
  [2.0, 'Ponta livre para deslocar (a favor da segurança)'],
  [1.0, 'Ponta guiada lateralmente (rótula)'],
  [0.7, 'Ponta travada na base (atrito ou encaixe)']
];

/* Fatores de largura do filete na raiz na área de espanamento
   (Norton, Projeto de Máquinas, cap. 15):
   rosca ISO/UNS externa w_i = 0,80; interna w_o = 0,88 */
const W_EXT = 0.80, W_INT = 0.88;
