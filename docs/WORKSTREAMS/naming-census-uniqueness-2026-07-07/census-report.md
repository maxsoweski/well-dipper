# System-name uniqueness census

Workstream: `naming-census-uniqueness-2026-07-07`, AC3 → AC6/AC7. Generated
by `scripts/name-census.mjs` — re-run with `node scripts/name-census.mjs`.
This is evidence for Max's AC6 UAT review of the position-derived naming
scheme. No dates or run-specific values appear below (see "Determinism").

## The guarantee, and how it is verified here

Since increment 3b (ac5-decision.md), a system's name is a **pure,
injective function of its canonical galactic position** — there is no
registry and no persistence. Uniqueness is structural:

> **By construction:** the position is quantized to a fixed lattice at
> `Q = 1e-6 kpc` (0.001 pc); the three lattice coordinates are packed into
> one mixed-radix locator `L`; and every name class embeds `L` injectively
> (survey number, or word + base-36 code), except the rare bare-word class
> which is drawn from a finite region-partitioned supply indexed injectively
> by position. Distinct positions → distinct `L` → distinct names.

The named-via columns below drive the **exact production call-site RNG
chains** (`warp-star-<idx>` sky-click, `warp-nav-<seed>` NavComputer,
`feat-<seed>` feature route). The generator **ignores** those seeds — which
is precisely why every path agrees and revisits are stable. This tool asserts
that agreement on every sample.

## Headline — verification

| check | result |
| --- | --- |
| Total names generated (4-region census) | 120,000 |
| Distinct position cells sampled | 120,000 |
| Distinct names produced | 120,000 |
| **Duplicate names across distinct cells** (AC6: must be 0) | **0** |
| Revisit mismatches (same cell → different name; must be 0) | 0 |
| Path disagreements (sky-click vs nav vs feature; must be 0) | 0 |
| Procgen designations in real designation space (must be 0) | 0 |
| Collisions with a real HYG name (must be 0) | 0 |

`distinct names === distinct cells` and `duplicate names across cells === 0`
together are the empirical face of the by-construction injectivity: at this
volume every distinct position got its own name, and no two distinct cells
ever shared one.

Determinism fingerprint (FNV-1a over sorted summary stats): `8047928b`

## Class mix (region flavor, re-expressed over the new classes)

Region only steers the class MIX (core catalog-heavy → rim fantasy-leaning);
it never affects uniqueness. `survey` = fictional-prefix catalogue
designation; `multipart` = region-flavoured word + position code; `bare` =
RARE settled-era proper name (uniform sampling surfaces ~none — see the
dedicated showcase below).

| region | samples | survey | multipart | bare |
| --- | --- | --- | --- | --- |
| core | 30,000 | 54.80% | 45.20% | 0 |
| arm | 30,000 | 30.01% | 69.99% | 0 |
| rim | 30,000 | 14.96% | 85.04% | 0 |
| halo | 30,000 | 25.28% | 74.72% | 0 |

Galaxy-wide totals — survey: 37,516, multipart: 82,484, bare: 0.

## HYG cross-check (procgen vs. real star names)

`public/assets/data/hyg-stars.json` ships 15,598 entries
(HYG v4.0, regenerated in increment 3a / AC9 — 0 remaining `"` artifacts).
Every distinct procgen name in this census was checked against the full set
of 15,546 distinct meaningful real names.

| metric | value |
| --- | --- |
| HYG entries (raw) | 15,598 |
| HYG entries with the `"` artifact name | 0 |
| HYG distinct meaningful names | 15,546 |
| Distinct procgen names colliding with a real name | 0 |

**Zero collisions.** The catalog class uses fictional survey prefixes
(disjoint from real designation space) and the bare-word class is
structurally blocklisted against the real proper-name set
(`src/generation/data/realProperNames.js`), so a procgen name can never
equal a real star name.

## Bare-word showcase (the RARE settled-era proper names)

Bare fantasy words are deliberately rare (~1 in 16.8M positions), so a
uniform galaxy-wide sample shows essentially none. These are drawn directly
from bare-ELIGIBLE positions inside the disk, per region, so Max can react to
the aesthetic. Each is globally unique and injectively allocated from a
finite region-partitioned supply; none is a real star name.

### core

| name | position (x, y, z kpc) |
| --- | --- |
| `Yevifixopuminumiba` | -1.20, -1.20, -1.58 |
| `Vepiveyixaxezunoba` | 0.58, 1.34, -0.26 |
| `Wucevitogukevonoba` | 2.44, -0.17, -0.30 |
| `Moriterafaxixopiba` | -2.95, 0.89, 0.54 |
| `Pemutidunakedipoba` | -0.69, -0.86, 0.59 |
| `Layuhetekaguyupiba` | 1.26, 0.10, 0.56 |
| `Ragegolifotupopiba` | -0.75, -0.22, 0.48 |
| `Kezagedaluyonipaba` | 0.10, -1.49, 0.06 |
| `Zivosumijokeseneba` | -2.66, 0.70, -0.73 |
| `Febetubudaditeseba` | -0.37, -1.96, 2.35 |
| `Zilogodorumobeneba` | 0.11, 0.41, -0.87 |
| `Buwavecicakizereba` | 1.05, -0.61, 1.37 |
| `Vehihewehiguguneba` | 0.32, 1.97, -0.82 |
| `Cowatufisuretipaba` | 0.05, 0.37, 0.10 |
| `Xotegaselaguxupuba` | -2.68, -0.36, 0.95 |
| `Tizitilecakinipoba` | -1.79, 0.44, 0.67 |
| `Hoxiguwahagulenuba` | -0.21, 0.94, -0.17 |
| `Tinevakatikabeneba` | 2.51, -0.66, -0.87 |
| `Zipeweverokiboraba` | 2.40, 1.47, 0.98 |
| `Peletudururavaleba` | 1.06, 1.97, -2.76 |
| `Hoyetigefuxeyupaba` | 0.18, -0.99, 0.16 |
| `Ruzohimerayuburaba` | 1.44, 0.10, 0.98 |
| `Nikehoxelotubonuba` | 1.53, 1.52, -0.25 |
| `Dicahurejomuroneba` | 1.98, 1.99, -0.74 |
| `Wazovayayudepipeba` | 0.08, 0.90, 0.27 |
| `Latohemuxuyuwapiba` | -0.30, 1.53, 0.53 |
| `Yerehapuguyocinaba` | 2.42, -0.32, -1.06 |
| `Wucefucucumowinoba` | -0.99, -1.87, -0.29 |
| `Gututokejeketepeba` | 0.44, -0.90, 0.30 |
| `Coxagujehumofemoba` | 1.61, 0.39, -1.45 |
| `Wuhahibokanaperuba` | -0.44, 0.62, 1.91 |
| `Motatufetodejipaba` | -0.15, 0.59, 0.02 |
| `Warihadefunaruseba` | -0.86, -0.43, 2.34 |
| `Pemahivovigokenuba` | 2.67, -0.27, -0.18 |
| `Gawotugobarijanoba` | -0.97, 1.91, -0.40 |
| `Cobuwafinakiteraba` | 1.84, 0.91, 1.12 |
| `Ranugoyagumojanaba` | 1.11, -0.38, -1.01 |
| `Xodivoletukisisiba` | 0.71, -0.61, 2.55 |
| `Wurihanulutudopaba` | -0.13, 1.20, -0.02 |
| `Pejohagidumubiraba` | 0.96, -1.08, 0.98 |

### arm

| name | position (x, y, z kpc) |
| --- | --- |
| `Bekahuyusihejateba` | -1.81, 1.95, 3.29 |
| `Lecumebutevahasaba` | 10.77, 1.33, 2.05 |
| `Kixavepalijicufiba` | 8.33, 1.31, -7.81 |
| `Xuzivukericoxukeba` | 9.26, -1.70, -3.76 |
| `Havovipofefelezoba` | -5.63, 0.24, 7.82 |
| `Vimigufupotadehaba` | 5.95, 0.53, -6.17 |
| `Redazekurararamoba` | 12.54, -0.23, -1.36 |
| `Mutuxezapeduyevoba` | 2.71, 0.60, 4.86 |
| `Gesijedesebijowiba` | -1.71, 1.08, 5.55 |
| `Lemovozevopudokuba` | 5.58, 0.59, -3.30 |
| `Towudumujimudoruba` | -5.80, -1.87, 1.82 |
| `Zoladuxutelozafaba` | 3.33, -1.41, -8.06 |
| `Rejuvixejorozotiba` | -0.77, -0.70, 3.62 |
| `Vicusosupodetunuba` | -4.07, 0.40, -0.10 |
| `Gegorabitokisoroba` | -11.12, 0.58, 1.73 |
| `Kigucofotiyajajiba` | -4.06, -1.32, -4.70 |
| `Doxufeyujetiwulaba` | -1.74, 0.15, -2.95 |
| `Muvinidedecugijuba` | -9.64, 0.37, -4.30 |
| `Cahobirimifucifeba` | -6.35, 0.48, -8.02 |
| `Yimitulakukajuleba` | 1.70, 1.46, -2.85 |
| `Pigeresofiwuwikuba` | -3.83, -1.19, -3.16 |
| `Mufiluxolobebitiba` | 8.37, 1.11, 3.44 |
| `Hayeyidofusejezoba` | 7.21, 0.34, 7.80 |
| `Norenofuropomehuba` | -8.36, 0.60, -5.28 |
| `Zogidukeciyireluba` | -2.43, -1.64, -2.18 |
| `Wetesacasiculiliba` | -1.95, -0.72, -2.63 |
| `Gemijocofigogunuba` | 8.06, -1.79, -0.20 |
| `Catahirakalubagoba` | 10.94, -1.96, -6.60 |
| `Sayogumofegecaheba` | 4.88, 1.73, -5.98 |
| `Pipugijofinasisiba` | -2.65, -0.79, 2.55 |
| `Wepakolelinolazeba` | 1.68, 0.24, 7.41 |
| `Gejisuxicowavicaba` | 8.33, -1.19, -10.13 |
| `Getosokomawokohuba` | 1.76, 0.17, -5.29 |
| `Xaloviripicinihoba` | 9.49, -1.81, -5.47 |
| `Kinefajumutinekoba` | -3.31, 1.31, -3.43 |
| `Fisicuresulotidoba` | 0.14, -0.80, -8.50 |
| `Yihiyuporaluwagebe` | 2.22, 0.33, 13.63 |
| `Xavozodexeleyozoba` | 2.89, 1.85, 7.93 |
| `Xabodupejiyeyakeba` | -1.42, -1.20, -3.74 |
| `Sabefizakahaxusoba` | -6.57, -0.69, 2.80 |

### rim

| name | position (x, y, z kpc) |
| --- | --- |
| `Nawurolesohinewi` | 8.60, -0.20, -14.89 |
| `Jafelowubiporihube` | -3.25, 0.29, 15.23 |
| `Sevuyecuyekijaso` | 1.93, -1.53, -17.80 |
| `Bimibijocuxupaweba` | 14.26, -1.42, 5.39 |
| `Lipinugacupeyufube` | 8.02, -1.71, 13.26 |
| `Nutezezotulalexo` | -6.40, -0.57, -13.69 |
| `Vociginibujemicube` | -13.73, 1.40, 11.11 |
| `Heyoyedawigidumoba` | -15.02, -0.81, -1.45 |
| `Jateroliliwolahube` | 8.87, 1.37, 15.19 |
| `Lizenoditivayatiba` | 16.53, -1.01, 3.63 |
| `Wisozuxudiyefeheba` | -14.41, 1.61, -5.95 |
| `Nadidijebeyabigabe` | 9.22, 1.92, 13.27 |
| `Dutuxupujeferaxa` | -9.40, 1.75, -14.26 |
| `Xeyelepuvijiyegeba` | -14.39, 0.72, -6.82 |
| `Turexuwivisajixe` | -8.03, 0.15, -14.11 |
| `Vofopagofovaporaba` | 17.46, 1.41, 1.09 |
| `Liserewarikugowoba` | -13.06, -0.57, 5.73 |
| `Vojowozisipehafiba` | 14.41, -0.65, -7.78 |
| `Kotacoxukasezuxi` | 2.86, 1.14, -13.78 |
| `Ceyuyiyizogabokibe` | -0.46, -0.93, 16.75 |
| `Rirobofukugafahobe` | 3.65, 0.39, 14.93 |
| `Jadunicoyacalefube` | 6.77, -1.89, 13.14 |
| `Heticejosasopefebe` | 8.89, -0.50, 12.56 |
| `Dajijimikunizawu` | -10.59, -1.68, -14.40 |
| `Rikamabezicolijobe` | -3.74, 1.40, 16.01 |
| `Yonadorepemawahobe` | 9.59, 0.64, 15.07 |
| `Wilifowubicarobube` | -13.96, 0.29, 10.11 |
| `Yocazafuhetapigube` | -5.07, 1.16, 14.20 |
| `Fohazirapagigomeba` | -17.56, -0.90, -1.85 |
| `Yodabulujiduvutuba` | 14.02, 1.25, 4.00 |
| `Hejoretecewafebebe` | 13.04, 1.45, 9.41 |
| `Lipolenocepidagobe` | -2.46, -0.17, 13.90 |
| `Davabubelufajiwa` | 1.90, 1.13, -15.34 |
| `Nujoyutuluyabikebe` | 1.56, -1.89, 16.55 |
| `Duhipatiyibemovi` | 4.41, -0.46, -15.93 |
| `Cedojafacecidahibe` | -9.37, -1.41, 14.72 |
| `Tatuwocejuzuwufabe` | -7.65, 1.48, 12.41 |
| `Rizubogadezugofobe` | 6.11, 0.16, 12.90 |
| `Zasuyadadugajugobe` | -1.28, 1.23, 13.95 |
| `Volupavesehupicabe` | 10.75, -0.93, 10.31 |

### halo

| name | position (x, y, z kpc) |
| --- | --- |
| `Loyafinonomibupaba` | -0.16, -3.66, -0.04 |
| `Wojutarexujokamiba` | 3.50, -4.22, -1.62 |
| `Nexufadixolumikeba` | 3.42, -4.75, -3.84 |
| `Bovajetuboguhoruba` | 5.77, -2.66, 1.85 |
| `Pucozojupalekoxaba` | 2.35, 3.70, 6.17 |
| `Netohikasihanunoba` | -2.09, 4.83, -0.35 |
| `Yafesazejakohiwuba` | -7.33, -4.26, 5.95 |
| `Lorubuxikezomofeba` | -1.96, -2.49, -7.94 |
| `Purahadehefutoguba` | 10.02, -2.73, -6.25 |
| `Yudehosanohaduniba` | -1.63, 4.91, -0.63 |
| `Xituwakuzudiruvoba` | 3.00, -3.47, 4.79 |
| `Bokomusekujedecebe` | 2.50, 3.33, 10.42 |
| `Kutivokopixilepaba` | 0.27, 2.72, 0.04 |
| `Wokatehuwedalepeba` | 0.17, -2.09, 0.24 |
| `Yudufurufigitunuba` | 1.49, -4.49, -0.10 |
| `Losivugajekilomiba` | 0.73, 4.50, -1.60 |
| `Hiyiguredigowejuba` | 0.75, 4.06, -4.18 |
| `Romuhecamutuzomiba` | -0.43, 3.53, -1.50 |
| `Punorucoxucosamoba` | -0.07, -4.63, -1.35 |
| `Kafiwafijalacateba` | -4.18, 4.90, 3.24 |
| `Kukowicijafenowaba` | -4.35, 4.55, 5.18 |
| `Xinefurumihezazaba` | -5.58, -4.59, 7.30 |
| `Kaduviboxudetaneba` | 0.63, 2.11, -0.73 |
| `Fucutapapekakepaba` | -0.12, -2.40, 0.03 |
| `Kuceraracibunebiba` | 4.67, -2.78, -10.80 |
| `Zehojehehihunoxeba` | -5.65, 3.91, 6.41 |
| `Degorimubopesebeba` | 0.95, 2.49, -10.97 |
| `Rotewebatezefodabe` | -2.79, -3.52, 11.25 |
| `Zehagomehonejopoba` | -6.03, 4.92, 0.63 |
| `Vagoparojadayupaba` | -8.89, -3.26, 0.15 |
| `Fasojiresihobexaba` | -3.39, 2.85, 6.10 |
| `Cibajozubebatotuba` | 5.13, -3.35, 3.99 |
| `Yatawuyoporiboveba` | 6.17, -3.57, 4.26 |
| `Yavataxatidavipaba` | -0.06, -2.11, 0.11 |
| `Miwatazufaradapiba` | 1.56, -3.98, 0.38 |
| `Bojilibipobuguxoba` | 0.80, 4.17, 6.76 |
| `Woxoyulotusedozaba` | 6.70, 2.73, 7.15 |
| `Woriduxajoyelohaba` | -2.26, 2.37, -6.10 |
| `Vayodimisatanukuba` | -0.11, -3.72, -3.21 |
| `Yuxexapuzukoyaroba` | 2.21, 3.61, 1.78 |

## Sample blocks — for design review

200 name samples per region, in generation order, labeled by
call-site family and class, with the sampled galactic position (kpc,
galactocentric: x/z = galactic plane, y = height above plane). The family
column is shown only to prove path-independence — it never changes a name.

### core

| # | family | class | name | position (x, y, z kpc) |
| --- | --- | --- | --- | --- |
| 0 | star | survey | `KRV-AUOGXEKCBMOOT1O` | -0.39, 0.03, 0.54 |
| 1 | star | multipart | `Viyinu-0IIYMGHDJVKD` | -1.93, -1.60, 1.07 |
| 2 | star | survey | `QRN-AO07WJNFR9APCDF` | -0.29, 0.49, -0.02 |
| 3 | star | survey | `NBG-B0DYT331INS524B` | -1.58, -1.08, 1.02 |
| 4 | star | survey | `PVX-AJWC9Y971FDM2NW` | 2.14, -1.66, -0.36 |
| 5 | star | survey | `NBG-AQNZ1HGAB25XR6D` | 2.81, 1.01, 0.21 |
| 6 | star | multipart | `Cufito-0I0YR5OJNE9E` | 1.78, 0.77, 0.18 |
| 7 | nav | multipart | `Zejine-0HRBBPEBHODR` | 0.06, -0.25, -0.30 |
| 8 | nav | survey | `ODX-B05XV402LDFNJQI` | -2.29, 0.40, 1.00 |
| 9 | feat | multipart | `Kuxani-0IK2TWSTYOTO` | -2.71, -1.89, 1.13 |
| 10 | star | survey | `VLC-AJ9I4QD48RR50U7` | 0.21, 0.01, -0.41 |
| 11 | star | survey | `QRN-A0YYXHRUFLM7L4L` | -0.78, -1.56, -1.93 |
| 12 | star | survey | `VLC-B5QIGFUGVKUAVQ7` | -1.39, -0.36, 1.46 |
| 13 | star | multipart | `Fizeno-0IN8T737J8YA` | -0.13, 1.38, 1.29 |
| 14 | star | survey | `TRN-B0RWPAOK0VUPVQQ` | -1.16, -1.84, 1.05 |
| 15 | star | survey | `TRN-9WQYNU8GKD6WJUK` | 0.45, -0.21, -2.29 |
| 16 | star | multipart | `Huxewo-0HX9X18X369D` | -0.00, 1.84, -0.00 |
| 17 | nav | multipart | `Dugiho-0J2I0FUK8HLE` | 1.54, -1.31, 2.04 |
| 18 | nav | survey | `ODX-AVA35CKSR51YO4C` | -0.52, 0.16, 0.59 |
| 19 | feat | survey | `ZTA-A60JE6JNSLPMQ45` | -1.20, 1.66, -1.51 |
| 20 | star | multipart | `Gisoca-0I5QVQ4QYBL8` | -2.96, -1.40, 0.42 |
| 21 | star | multipart | `Vuvage-0HCG6MRFC7G0` | -0.11, 1.37, -1.03 |
| 22 | star | multipart | `Tetufu-0H8HJVJMGWCV` | -0.24, 0.67, -1.23 |
| 23 | star | multipart | `Moraca-0HQLWWBUYKOH` | 0.49, 0.90, -0.33 |
| 24 | star | multipart | `Yaweri-0HN0J90G4VYN` | 1.41, -1.27, -0.51 |
| 25 | star | multipart | `Gezayo-0HI44A41YBO2` | 2.08, 1.67, -0.75 |
| 26 | star | multipart | `Kazulo-0HSOZY8URHHR` | 0.24, -0.57, -0.23 |
| 27 | nav | survey | `TRN-AKNIVKS0GM9Y3JK` | -0.19, 1.83, -0.29 |
| 28 | nav | multipart | `Fevaxe-0HXQNRPXZNTA` | -0.28, -0.87, 0.02 |
| 29 | feat | multipart | `Vazibo-0HVQBG7TM5IM` | 0.02, -1.90, -0.08 |
| 30 | star | multipart | `Sucuhe-0HWU2XQDFRVZ` | -0.20, -0.52, -0.02 |
| 31 | star | multipart | `Batuhi-0HXRAWD7G1WV` | -0.02, -0.72, 0.02 |
| 32 | star | multipart | `Davuhe-0HHN011FNIRY` | 1.01, -1.96, -0.78 |
| 33 | star | multipart | `Lolafa-0I03AUXV1TBJ` | -2.33, 1.35, 0.14 |
| 34 | star | survey | `PVX-AOSAVSKBO6WPWKY` | 0.01, 1.01, 0.05 |
| 35 | star | multipart | `Lojuwe-0HCZB1BDKBF2` | 0.71, -0.89, -1.01 |
| 36 | star | survey | `ODX-ARHVJHE7F6EC8KE` | 0.11, -1.00, 0.28 |
| 37 | nav | multipart | `Basepo-0IJ2JL387PXS` | -1.63, 1.14, 1.08 |
| 38 | nav | multipart | `Foroci-0HTBPP3CBFIO` | 0.24, 0.03, -0.20 |
| 39 | feat | survey | `ODX-AO7A0CIQOGC7P46` | 0.04, -0.71, 0.00 |
| 40 | star | survey | `XND-A9I2X8W2AW7Q5QC` | 1.60, 0.62, -1.22 |
| 41 | star | survey | `VLC-9RBJC6PBSQIGCO3` | -0.27, -1.76, -2.74 |
| 42 | star | survey | `PVX-ALPABYEGWNQVP02` | 0.33, 1.98, -0.21 |
| 43 | star | multipart | `Dedine-0GIOIZDRRQLN` | -1.15, -0.83, -2.51 |
| 44 | star | multipart | `Biwufo-0GFQWL1MQRN0` | 0.22, -1.38, -2.66 |
| 45 | star | survey | `PVX-AOJNQZIBEGLV5GG` | -0.09, -0.79, 0.03 |
| 46 | star | multipart | `Tonose-0HC470SSMFGW` | 0.97, 0.75, -1.05 |
| 47 | nav | survey | `WGX-B5VV2J5YO1OE2ND` | 1.79, -1.19, 1.47 |
| 48 | nav | survey | `NBG-ALK9AJFP0BI9V7F` | 1.69, -1.52, -0.22 |
| 49 | feat | multipart | `Jinuyu-0I51MIE90M7J` | 0.10, -0.49, 0.38 |
| 50 | star | survey | `PVX-ACTOUJIHSA7Q42Y` | 0.54, -1.56, -0.95 |
| 51 | star | survey | `KRV-AQ4PO16EGHXN4YW` | -0.09, 0.33, 0.16 |
| 52 | star | multipart | `Ninedo-0JEIAWE0H5UC` | 0.85, 0.65, 2.64 |
| 53 | star | survey | `TRN-A61R2I2L0FIFNB4` | 1.60, 0.34, -1.51 |
| 54 | star | multipart | `Ratoku-0HC6MJMJ89KF` | 1.10, -0.66, -1.05 |
| 55 | star | survey | `VLC-A80DOR9ON1GQU5V` | -2.34, 1.04, -1.35 |
| 56 | star | multipart | `Momutu-0I4UAZX7X2MM` | -1.11, -0.52, 0.37 |
| 57 | nav | survey | `KRV-BG5K4ORSAAMTXRI` | -1.18, 1.31, 2.33 |
| 58 | nav | survey | `PVX-APYXH7QT9U2X3NO` | 1.51, 0.34, 0.15 |
| 59 | feat | survey | `WGX-BCLUI5RLIY4PE4P` | -0.43, -1.41, 2.03 |
| 60 | star | survey | `XND-B8L0F2WM6JWAC2A` | -0.38, -0.51, 1.70 |
| 61 | star | multipart | `Yezoxa-0GRBRZZS6HYI` | -1.30, -1.76, -2.08 |
| 62 | star | multipart | `Jinupi-0HJPYWHA4COD` | -0.28, -1.47, -0.67 |
| 63 | star | multipart | `Gofike-0HASHJPRI6WE` | -0.71, 0.18, -1.12 |
| 64 | star | survey | `KRV-AD06XH3YO5NKRYK` | -0.17, -0.16, -0.93 |
| 65 | star | survey | `WGX-AP6PHMKO6UK8XL7` | 1.60, 1.42, 0.08 |
| 66 | star | survey | `KRV-AZ7HKCNQN6CHFF6` | 1.04, -0.66, 0.92 |
| 67 | nav | multipart | `Mabovi-0ITVQ7GQA8FJ` | -0.50, -1.35, 1.62 |
| 68 | nav | multipart | `Recutu-0HQGC5Q4VW5R` | 0.02, 0.06, -0.34 |
| 69 | feat | survey | `VLC-AY55G4HLU2AJ2YN` | 1.27, 1.01, 0.83 |
| 70 | star | multipart | `Xarezu-0HD1FQOLQS8F` | 1.60, -0.65, -1.00 |
| 71 | star | survey | `ZTA-AVFUSK83F5074ED` | 0.22, 0.15, 0.60 |
| 72 | star | multipart | `Homuna-0J7KKRQY993L` | 0.06, -0.85, 2.29 |
| 73 | star | survey | `VLC-B62FK9W0C48TXLP` | -1.52, -0.61, 1.49 |
| 74 | star | multipart | `Bixeje-0IZG739KOF81` | 0.05, -0.63, 1.89 |
| 75 | star | survey | `XND-AHD8OR6T9RV56GE` | -0.10, 0.04, -0.57 |
| 76 | star | multipart | `Retipo-0IEUNAWVN229` | -0.34, 1.06, 0.87 |
| 77 | nav | survey | `WGX-AFSDWULT0X5YRCF` | -0.91, 0.74, -0.70 |
| 78 | nav | survey | `ZTA-A52PLE2VSS1OK9D` | 0.81, 0.08, -1.59 |
| 79 | feat | multipart | `Kogopi-0HGYVJ75B2Z6` | 2.09, 1.29, -0.81 |
| 80 | star | multipart | `Sokuni-0J0EC9OY5XPT` | 0.85, -1.26, 1.94 |
| 81 | star | multipart | `Vulexe-0HWRE6QCMO4W` | 2.00, -1.11, -0.03 |
| 82 | star | multipart | `Zahupa-0HX6Z6RGEGMM` | -0.22, -1.22, -0.00 |
| 83 | star | survey | `XND-BITIA93VCY2J7SG` | 0.60, 1.71, 2.55 |
| 84 | star | survey | `PVX-B9OO34RZL0E835W` | 0.14, -1.94, 1.79 |
| 85 | star | survey | `WGX-BAAEDUMUPFR3C57` | -0.55, -1.02, 1.84 |
| 86 | star | survey | `TRN-AIJ4E8I5IGK85HS` | 0.52, -0.64, -0.47 |
| 87 | nav | multipart | `Pusuni-0H8Y2ZE4N8A9` | 1.40, 1.33, -1.21 |
| 88 | nav | multipart | `Xikuvi-0J57GR07R4KZ` | -0.12, 1.71, 2.18 |
| 89 | feat | survey | `XND-A6POR2HZ6Q85FQ0` | 1.26, -1.03, -1.46 |
| 90 | star | survey | `ODX-AQ8ZYIKIF08LVJS` | 0.05, 1.91, 0.17 |
| 91 | star | multipart | `Yejowe-0I8VA6ZYNGB5` | 0.69, 0.55, 0.57 |
| 92 | star | multipart | `Homize-0J4F9Z4FARKG` | -0.40, -0.82, 2.14 |
| 93 | star | survey | `NBG-A9361RIXOX2J7EJ` | 0.44, -1.61, -1.26 |
| 94 | star | multipart | `Lozope-0GYSVF74IC3Y` | -1.42, 1.70, -1.71 |
| 95 | star | survey | `ZTA-B31C8K1170WX865` | 0.55, 0.85, 1.24 |
| 96 | star | multipart | `Gunecu-0HZSFQACYTKH` | 1.92, -0.95, 0.12 |
| 97 | nav | survey | `VLC-A8PVG442CAEE453` | -1.51, 0.01, -1.29 |
| 98 | nav | multipart | `Macuto-0J1WYFS5VMTQ` | -2.19, -1.10, 2.01 |
| 99 | feat | survey | `TRN-BFT68E9VCBH2HAQ` | -1.37, -1.55, 2.30 |
| 100 | star | survey | `KRV-AS64NRRFI6QN790` | 0.15, -1.81, 0.33 |
| 101 | star | survey | `QRN-9Z2SM589Q99D63R` | -1.36, 0.66, -2.09 |
| 102 | star | survey | `NBG-AUUUMX5XW72114Z` | -1.33, 0.62, 0.56 |
| 103 | star | survey | `WGX-AQQ6XTC2L379AHN` | 0.04, -1.52, 0.21 |
| 104 | star | multipart | `Gimoho-0HR8PUUB88LQ` | -0.97, -0.44, -0.30 |
| 105 | star | survey | `XND-AMVWI7GGE9Y4Q8A` | -0.91, -1.32, -0.11 |
| 106 | star | multipart | `Gokugo-0HP03NQ2I7E8` | 0.08, 0.56, -0.41 |
| 107 | nav | survey | `ODX-9VZO69WTQVZ899S` | 1.49, 1.95, -2.35 |
| 108 | nav | multipart | `Gatasa-0I2SQBWHH8WH` | 0.03, 1.36, 0.27 |
| 109 | feat | survey | `PVX-AH5P4EXSA3IIPD2` | 0.92, -1.58, -0.59 |
| 110 | star | multipart | `Tumaci-0HY5QWARTHQN` | -2.75, 1.78, 0.04 |
| 111 | star | survey | `NBG-B3PYDOP4T3XW3TH` | -0.25, -0.23, 1.29 |
| 112 | star | survey | `KRV-AKY08WPFFNWT470` | -1.49, 1.48, -0.27 |
| 113 | star | survey | `ZTA-AN9IQCG5SLAR3EL` | -0.29, 0.24, -0.08 |
| 114 | star | survey | `KRV-B4YTBR9KSBFBN7O` | 1.72, 0.87, 1.40 |
| 115 | star | survey | `VLC-AT4EUF0JRNWRLDD` | 2.01, 0.71, 0.41 |
| 116 | star | survey | `TRN-ALJH2GO6H6SEQHU` | -0.36, 0.59, -0.22 |
| 117 | nav | survey | `KRV-AOZ7114SL73BYFS` | 0.29, -1.68, 0.07 |
| 118 | nav | multipart | `Hiwefi-0HXVM4WZU1RI` | -0.12, -1.73, 0.03 |
| 119 | feat | survey | `XND-AOVXV5C4RR3ZZ1O` | 0.81, 1.31, 0.06 |
| 120 | star | survey | `ODX-ACOW7OJ2MVL5RO6` | -1.11, -0.85, -0.96 |
| 121 | star | multipart | `Segize-0I0CLHD0XII6` | -0.14, -1.10, 0.15 |
| 122 | star | multipart | `Yupedo-0GZJILQJ3DMZ` | -1.27, -1.92, -1.67 |
| 123 | star | survey | `ZTA-AK0CZDQUX7I5V0D` | -0.24, -0.07, -0.35 |
| 124 | star | survey | `KRV-A3SKOOA27J2IQ0G` | 0.16, 1.27, -1.70 |
| 125 | star | survey | `NBG-AT8FS8NA5GQWUFZ` | 0.97, 1.76, 0.42 |
| 126 | star | survey | `ODX-AJR00RT8Q2SQ8RE` | 0.28, 0.88, -0.37 |
| 127 | nav | survey | `TRN-B165SW09CX975WS` | -0.06, 1.55, 1.08 |
| 128 | nav | survey | `XND-A94NEK3PHEK7M1S` | 0.07, 0.49, -1.25 |
| 129 | feat | multipart | `Honifo-0J31I3J9LOER` | 0.35, 0.76, 2.07 |
| 130 | star | survey | `KRV-B7D7UYCO4UMXZ02` | -1.09, 1.40, 1.60 |
| 131 | star | multipart | `Wakahi-0IHDCGE1E8LU` | 1.32, -0.05, 1.00 |
| 132 | star | survey | `XND-AIZMIGTEFKYRR84` | -0.42, -1.05, -0.43 |
| 133 | star | survey | `NBG-BJHDSZB5IQO021P` | -1.30, 1.56, 2.61 |
| 134 | star | survey | `TRN-B53OO3T4CT6ZFVM` | 0.11, 1.38, 1.41 |
| 135 | star | survey | `TRN-BGJ3ZMKH2D36OMU` | 0.17, -0.38, 2.36 |
| 136 | star | survey | `ODX-BBQM0NOQ74QU89E` | -2.11, 0.67, 1.96 |
| 137 | nav | survey | `WGX-AIPIGM0FZATS5IF` | -1.88, -1.47, -0.46 |
| 138 | nav | multipart | `Nukeho-0I8ICEF7EXIM` | -2.27, -0.00, 0.56 |
| 139 | feat | survey | `ODX-BBD5D1VC2RZ45LU` | -2.12, -0.97, 1.93 |
| 140 | star | multipart | `Sojisa-0HEU3EFHB4JX` | -0.35, -1.08, -0.92 |
| 141 | star | survey | `XND-B0V5T00HQQXEILQ` | 1.40, -1.35, 1.06 |
| 142 | star | survey | `TRN-AFKSP4M8IAK9BUI` | 2.12, -1.19, -0.72 |
| 143 | star | survey | `TRN-A9VSEERG12MCSAE` | -2.22, -0.51, -1.19 |
| 144 | star | multipart | `Rujofi-0HMMXKKZFZU8` | 0.04, 0.66, -0.53 |
| 145 | star | survey | `XND-B7LNOZPQPGXYPCA` | -0.53, -0.13, 1.62 |
| 146 | star | multipart | `Felala-0I49KWXNRBTE` | 0.44, 1.62, 0.35 |
| 147 | nav | survey | `WGX-AUXF4F64YXQ5SFB` | 1.78, -1.45, 0.56 |
| 148 | nav | multipart | `Zuxeno-0HKURU9MSJ0Z` | 2.51, 1.64, -0.62 |
| 149 | feat | survey | `NBG-BGGM47ETB0ZGV2V` | -0.42, 0.19, 2.35 |
| 150 | star | survey | `ODX-A44ROQ9IODM94LQ` | -0.62, -0.99, -1.67 |
| 151 | star | survey | `VLC-ANBOI07WVXUC0DN` | 2.60, 1.76, -0.07 |
| 152 | star | survey | `VLC-ALCO4JCJMBACGHN` | -0.71, -1.22, -0.24 |
| 153 | star | multipart | `Zumeme-0J91YOZI38EO` | -0.79, -1.11, 2.37 |
| 154 | star | multipart | `Fexiwo-0GQ0N75FWXV0` | 0.00, -1.02, -2.15 |
| 155 | star | multipart | `Wanetu-0HH83B5PSHMA` | 1.62, 1.92, -0.80 |
| 156 | star | survey | `ZTA-B17SFHK1LHAEWL3` | 0.14, -1.29, 1.08 |
| 157 | nav | multipart | `Doguco-0GXNGFF23OXC` | 0.70, 1.15, -1.77 |
| 158 | nav | multipart | `Yigoba-0GTXLK5INUUO` | 0.15, 1.80, -1.95 |
| 159 | feat | survey | `TRN-AOXPTXUG742WV9S` | -0.08, 2.00, 0.06 |
| 160 | star | survey | `ZTA-AQJVSR9QNE2RY2F` | -0.24, -0.15, 0.20 |
| 161 | star | survey | `ZTA-AO6CC60OVFVXMLL` | -0.02, -1.52, -0.00 |
| 162 | star | survey | `PVX-AEZ2H7V9NZKP1RE` | 0.88, -1.67, -0.77 |
| 163 | star | multipart | `Kilixi-0HXJ707791U6` | -2.31, 1.17, 0.01 |
| 164 | star | survey | `ODX-AKWQ8HJWS23C1G0` | 1.56, -1.66, -0.27 |
| 165 | star | multipart | `Tikabo-0HQLU5HE3TN1` | -1.55, -1.08, -0.33 |
| 166 | star | multipart | `Boxize-0I2PEJ16X4CW` | 1.56, -0.91, 0.27 |
| 167 | nav | survey | `ODX-AV6GU261NXK18NQ` | 0.02, -1.34, 0.58 |
| 168 | nav | survey | `ZTA-AFPHJB7EQOP9NIZ` | -0.11, -1.96, -0.71 |
| 169 | feat | survey | `ZTA-BJ0HX02WL5WYYMB` | 0.52, 1.16, 2.57 |
| 170 | star | multipart | `Tokaxe-0GBX7VUYG1IL` | -0.63, 1.34, -2.85 |
| 171 | star | multipart | `Rikime-0IJITR5X6CMS` | 1.76, 1.60, 1.10 |
| 172 | star | survey | `PVX-AOTBSGUZ088ENP4` | 0.17, 0.85, 0.05 |
| 173 | star | multipart | `Kekavo-0GGGPNU7946K` | 1.00, -1.59, -2.62 |
| 174 | star | multipart | `Zuvizi-0HMKZED7H0UK` | -0.98, -1.56, -0.53 |
| 175 | star | survey | `VLC-AOVOB86O42O76PV` | 0.60, 1.98, 0.06 |
| 176 | star | survey | `NBG-B3DAXIO3QTS04WV` | 0.64, 0.16, 1.26 |
| 177 | nav | multipart | `Voyupe-0ILFK3SEB4J3` | -1.18, -0.44, 1.20 |
| 178 | nav | multipart | `Kahuzu-0HE1SZVDIMFH` | -0.93, -0.17, -0.95 |
| 179 | feat | survey | `TRN-AVF8VALXBOLEWZM` | -0.23, -0.68, 0.60 |
| 180 | star | survey | `QRN-AR90N7YEXUOS309` | 2.96, 0.64, 0.25 |
| 181 | star | multipart | `Tifoya-0HHQZDMENYSV` | -0.20, 0.92, -0.77 |
| 182 | star | multipart | `Mekutu-0IY1SPMT2V5F` | 0.39, 1.53, 1.82 |
| 183 | star | multipart | `Tujuye-0HX4D8IQIKZY` | -2.23, 1.20, -0.01 |
| 184 | star | multipart | `Kovoni-0IODY3M3ID2P` | 1.36, -1.17, 1.34 |
| 185 | star | multipart | `Payayi-0HW88X47M1M8` | 0.34, 0.70, -0.05 |
| 186 | star | survey | `XND-AQQRFK9CYW7M5W0` | -0.97, 0.15, 0.21 |
| 187 | nav | survey | `XND-A9XWS7WSPXX6M7C` | -0.48, 1.17, -1.19 |
| 188 | nav | multipart | `Jopaza-0J2F7L5ISEY9` | 1.20, -1.33, 2.04 |
| 189 | feat | multipart | `Semete-0J3RBCYED88I` | -1.32, 1.93, 2.11 |
| 190 | star | survey | `PVX-AYQ15KX6DEVT0T4` | -0.42, 1.63, 0.88 |
| 191 | star | multipart | `Wirivi-0HGIB73AHEBY` | 0.35, -0.75, -0.83 |
| 192 | star | survey | `WGX-A7WYI0MO4IK86UB` | 1.58, -0.44, -1.36 |
| 193 | star | survey | `VLC-AMU820OBL3UYVS3` | -2.67, -1.47, -0.11 |
| 194 | star | survey | `QRN-AP1168BB16O9AHV` | 0.60, -1.77, 0.07 |
| 195 | star | survey | `QRN-B3XVB6QA8SJCG2Z` | -1.71, 0.87, 1.31 |
| 196 | star | multipart | `Tadoco-0ICT47AU6E7M` | -0.19, 1.50, 0.77 |
| 197 | nav | multipart | `Difiva-0IEXWQY98FZG` | -2.16, -1.96, 0.88 |
| 198 | nav | survey | `ZTA-APFNYQS7RD7FI5Z` | -0.72, 0.94, 0.10 |
| 199 | feat | survey | `XND-B4ELESB5MY7GZQO` | -1.89, 1.09, 1.35 |

### arm

| # | family | class | name | position (x, y, z kpc) |
| --- | --- | --- | --- | --- |
| 0 | star | multipart | `Himeku-0EQLMCRTU7VQ` | -4.42, 0.50, -5.69 |
| 1 | star | survey | `NBG-DCDMI3B98ZVC19D` | 0.10, -0.45, 8.01 |
| 2 | star | multipart | `Cememe-0FRO9PHT3UZV` | 1.12, -1.81, -3.85 |
| 3 | star | multipart | `Vihavu-0EHCULVE5VHU` | 10.24, -1.30, -6.15 |
| 4 | star | multipart | `Yopone-0FQN3BBRFYEN` | 3.84, -0.42, -3.90 |
| 5 | star | multipart | `Pumiza-0JWE3383BGUZ` | 9.65, -1.27, 3.53 |
| 6 | star | multipart | `Vehano-0JXQQ5AVLR0Y` | -0.90, -0.16, 3.59 |
| 7 | nav | multipart | `Wicazi-0FEV3YS3YGYA` | 6.36, 1.04, -4.48 |
| 8 | nav | multipart | `Wuwoki-0HHFML1BGZZP` | 5.03, 1.13, -0.79 |
| 9 | feat | multipart | `Gebaga-0KGGBOFNDYKX` | -3.62, 0.30, 4.52 |
| 10 | star | multipart | `Babepo-0KUSN9RVHNXV` | -2.16, 0.51, 5.23 |
| 11 | star | survey | `NBG-EVI4PLVY42UQ4KB` | 0.85, -1.88, 12.60 |
| 12 | star | survey | `XND-9R2C5YMHPBCM0K4` | 10.27, -0.31, -2.76 |
| 13 | star | multipart | `Ruhocu-0GCJXSBJ8WQ1` | -4.97, 0.88, -2.81 |
| 14 | star | survey | `QRN-D2YLDLH7R0M4WYJ` | -5.70, 1.68, 7.23 |
| 15 | star | multipart | `Zomeju-0ODUN23GHTTK` | -3.79, 0.61, 11.53 |
| 16 | star | survey | `XND-C45TQI9X7KN16GI` | -4.13, -1.83, 4.33 |
| 17 | nav | multipart | `Muveje-0M62QD8D21AL` | -9.79, -0.47, 7.58 |
| 18 | nav | multipart | `Wuroyi-0KUTMG5TNI9N` | 5.58, 1.16, 5.23 |
| 19 | feat | multipart | `Jebudo-0E5X9SJ8WFDJ` | 12.11, 1.73, -6.71 |
| 20 | star | multipart | `Sejaba-0FDMCB4EP807` | -3.97, -0.48, -4.55 |
| 21 | star | survey | `KRV-9UZVYRKJL29AK0C` | 7.17, -1.72, -2.43 |
| 22 | star | multipart | `Yucovu-0N29W0S0AIRF` | 1.21, 1.41, 9.17 |
| 23 | star | multipart | `Yagivi-0G8O9LVOLYWY` | -11.70, 1.48, -3.01 |
| 24 | star | multipart | `Fehoku-0L9XGEJ7WW3E` | 4.17, 0.25, 5.98 |
| 25 | star | survey | `NBG-A0PUIDSVU9DBXJZ` | 5.72, -1.98, -1.96 |
| 26 | star | multipart | `Dozawe-0FM2W4RUSAZP` | -5.87, -0.18, -4.13 |
| 27 | nav | multipart | `Zasodo-0F5TMX867BGL` | -6.57, 0.64, -4.93 |
| 28 | nav | multipart | `Xikawo-0BO58NUB0EG2` | -0.03, -1.97, -11.17 |
| 29 | feat | survey | `KRV-9L2TBB2QQEWHK7W` | 8.81, -1.17, -3.26 |
| 30 | star | multipart | `Yefipi-0CZ147GLX4NA` | -2.04, 1.45, -8.84 |
| 31 | star | multipart | `Cuhiwa-0EDWJ57OGBAI` | 2.05, -0.93, -6.32 |
| 32 | star | survey | `TRN-D5Q020K7GII4HB6` | -10.34, 0.21, 7.46 |
| 33 | star | multipart | `Mitiko-0GO48FC3EPSO` | 9.00, 1.63, -2.24 |
| 34 | star | multipart | `Saxafu-0IZDDTKOXFWC` | 9.00, 1.31, 1.89 |
| 35 | star | multipart | `Gorexa-0FRHOSTP8DE6` | 3.53, -0.82, -3.86 |
| 36 | star | multipart | `Vafiho-0FSR16KE6D7Y` | 1.43, 0.65, -3.80 |
| 37 | nav | multipart | `Gelozi-0FLJDGH8670T` | 1.48, 0.60, -4.15 |
| 38 | nav | multipart | `Zujazi-0HBJTGDRE7J9` | -8.77, -0.23, -1.08 |
| 39 | feat | multipart | `Cutoca-0HBDHUO1W2JF` | 10.80, 1.35, -1.09 |
| 40 | star | multipart | `Jocaco-0IW97XD7N2DZ` | 3.80, 1.55, 1.73 |
| 41 | star | survey | `PVX-D5K98HVELAG0XTO` | 2.59, 0.51, 7.44 |
| 42 | star | multipart | `Punuti-0E2Z2QYIVDJF` | 0.59, 2.00, -6.86 |
| 43 | star | multipart | `Vemogu-0HGG00GDZ2B7` | 3.06, 1.02, -0.84 |
| 44 | star | multipart | `Mefoyi-0K4Y3T52GH8Y` | 0.03, -1.01, 3.95 |
| 45 | star | multipart | `Zijoha-0H45L08Q6K0B` | -5.10, 1.80, -1.44 |
| 46 | star | survey | `ODX-6JPPQYQXYL77BW0` | 5.16, -0.90, -12.37 |
| 47 | nav | multipart | `Mupife-0BVLD5ZF2NYC` | 0.94, -1.98, -10.80 |
| 48 | nav | survey | `WGX-BVC9UQ52TTDGWTF` | 1.69, 1.42, 3.59 |
| 49 | feat | multipart | `Punoke-0DBB5Q4SYVAC` | -1.76, -1.64, -8.23 |
| 50 | star | multipart | `Verino-0O97WJBQSTEM` | 1.95, 1.28, 11.30 |
| 51 | star | survey | `XND-C417KNVNF30TN0G` | -0.50, -1.48, 4.32 |
| 52 | star | multipart | `Tosaza-0BV4MOVISCT8` | -7.53, -0.75, -10.82 |
| 53 | star | multipart | `Likanu-0IHVQ2PEPYDH` | -13.29, 1.81, 1.02 |
| 54 | star | survey | `KRV-9TNYELK0JQAEL4K` | -8.26, -1.88, -2.54 |
| 55 | star | multipart | `Lulake-0LLFXR8Y0ZKK` | -0.22, -1.96, 6.55 |
| 56 | star | multipart | `Muhabi-0PPYVB3WMAAP` | 1.15, 1.95, 13.92 |
| 57 | nav | survey | `ODX-8I6GWQPYL01N7MC` | 7.29, 0.76, -6.50 |
| 58 | nav | multipart | `Joloro-0I54BIRGULTE` | 3.56, -1.32, 0.39 |
| 59 | feat | multipart | `Futixo-0K3KGFEAQ9P3` | 2.76, 1.25, 3.88 |
| 60 | star | survey | `ZTA-AKN79OBUIC87XMJ` | 4.31, 0.18, -0.30 |
| 61 | star | multipart | `Suwoli-0BKOB54A0AAK` | -6.74, -1.49, -11.34 |
| 62 | star | survey | `PVX-8WABVFS5PVGGFB6` | 5.49, -0.56, -5.32 |
| 63 | star | multipart | `Mosode-0IMC262PF8LM` | -7.25, 0.13, 1.24 |
| 64 | star | multipart | `Salivo-0EDHV5HQ6OZW` | 2.88, 0.24, -6.34 |
| 65 | star | survey | `PVX-9O7G2421J0RJ06Y` | -3.11, -1.95, -3.00 |
| 66 | star | multipart | `Hamuyi-0MZIEJAPG5OZ` | -4.25, -0.81, 9.04 |
| 67 | nav | multipart | `Bohopu-0NSLW48OHJTP` | 3.37, -0.26, 10.48 |
| 68 | nav | multipart | `Suheva-0OXV52TFF8JJ` | 5.19, -1.97, 12.52 |
| 69 | feat | survey | `NBG-709PUDWIKPXVCU5` | 4.78, 0.68, -10.99 |
| 70 | star | multipart | `Nopori-0DWNHGGO7SGE` | 5.77, 0.03, -7.17 |
| 71 | star | survey | `ZTA-CN8WUERL2FVS1SB` | 9.78, -1.33, 5.92 |
| 72 | star | multipart | `Loredu-0GU3V7A5JJFM` | -11.38, -0.53, -1.94 |
| 73 | star | multipart | `Meweko-0ILLU9UXRVSF` | -3.29, 1.47, 1.21 |
| 74 | star | survey | `ODX-9KXO4Z4MJ5QAKB4` | 6.78, 0.14, -3.27 |
| 75 | star | multipart | `Botujo-0I39EI8F1YT6` | 9.33, 0.71, 0.30 |
| 76 | star | survey | `TRN-9AMWJE3QBBWLNMI` | 1.47, 1.37, -4.13 |
| 77 | nav | multipart | `Yuconu-0IKFFSDP2EQI` | 9.87, -0.48, 1.15 |
| 78 | nav | multipart | `Geyefu-0BSQOQVLVFKV` | -7.84, 1.98, -10.94 |
| 79 | feat | multipart | `Yivoxi-0CQ8M6OLBMIU` | -1.40, 1.55, -9.28 |
| 80 | star | multipart | `Jovode-0OD5PYVBZ2PG` | -7.59, 0.21, 11.50 |
| 81 | star | multipart | `Favaye-0F7BSKMY90Z3` | 6.37, -1.55, -4.86 |
| 82 | star | multipart | `Yafuge-0C5BLW2GLPKB` | 4.71, 0.82, -10.31 |
| 83 | star | multipart | `Rohuba-0O736QDDK3YA` | 5.19, 1.61, 11.20 |
| 84 | star | multipart | `Xodule-0GQV3L9BTDRF` | -3.55, 1.07, -2.10 |
| 85 | star | multipart | `Pogapa-0P4A5TUXCHIX` | -4.16, 0.87, 12.84 |
| 86 | star | multipart | `Gaxicu-0M779LTYOPFZ` | -6.54, -1.99, 7.63 |
| 87 | nav | multipart | `Kijehu-0BMEFJGRCPMT` | 2.22, -1.67, -11.25 |
| 88 | nav | multipart | `Duzike-0F95FXLGCBWM` | -3.80, -1.07, -4.77 |
| 89 | feat | multipart | `Faloya-0FUGOUQE85JQ` | 11.68, -1.01, -3.71 |
| 90 | star | multipart | `Kujika-0DDGCB7M4I33` | 5.87, 1.61, -8.12 |
| 91 | star | multipart | `Muhiko-0N6VAY7VHCS1` | -6.62, -1.40, 9.40 |
| 92 | star | survey | `KRV-A5CWB1NV3J7SS2M` | 4.89, 1.27, -1.57 |
| 93 | star | multipart | `Nicupa-0KDPZUPD21FH` | 9.24, -0.07, 4.39 |
| 94 | star | survey | `ODX-9232HE260A9E42W` | -5.68, -0.54, -4.84 |
| 95 | star | multipart | `Wopipa-0L3DMDTIY46Z` | 5.58, 0.31, 5.66 |
| 96 | star | survey | `NBG-CS2YRP8DLUKG6G7` | -8.38, -1.26, 6.32 |
| 97 | nav | multipart | `Yosuza-0G9XBZ7IB5ZE` | -2.65, 0.50, -2.94 |
| 98 | nav | survey | `ODX-E8NMUFFMX0DVEJM` | 3.79, 0.46, 10.70 |
| 99 | feat | multipart | `Mogana-0OICKYNJ4QGO` | -4.01, 0.76, 11.76 |
| 100 | star | survey | `KRV-CE2SCWRM4NLJH24` | -1.23, -1.04, 5.15 |
| 101 | star | multipart | `Fewoha-0GKPACSTIR69` | 3.75, -0.08, -2.41 |
| 102 | star | multipart | `Wutuda-0G0GUV97VK4R` | -2.38, 0.90, -3.41 |
| 103 | star | multipart | `Vegara-0AX91GDX3PJ4` | -2.93, 0.03, -12.50 |
| 104 | star | multipart | `Fozuhu-0LMUFTMEEO9M` | 4.97, -1.30, 6.62 |
| 105 | star | multipart | `Pikace-0FJWQNSK68X7` | -1.24, 0.54, -4.23 |
| 106 | star | multipart | `Wukiro-0JVMFV53R517` | 10.14, -1.99, 3.49 |
| 107 | nav | multipart | `Fozohe-0HP7NWGPA5HX` | 4.16, 1.51, -0.40 |
| 108 | nav | survey | `VLC-AU8RYWN4L6EL057` | 9.60, 1.05, 0.50 |
| 109 | feat | survey | `NBG-C1ZU8VT34OUKTDV` | -2.61, 1.96, 4.15 |
| 110 | star | multipart | `Yukigu-0EFDI4A7M961` | 0.95, -1.46, -6.24 |
| 111 | star | survey | `PVX-COV39J3PTIEFFR6` | 4.35, -0.11, 6.05 |
| 112 | star | multipart | `Rezugi-0BKFVXISH4KQ` | 6.78, -1.20, -11.35 |
| 113 | star | survey | `VLC-8J82ZUK98YQM1O1` | 10.72, -0.22, -6.41 |
| 114 | star | survey | `XND-AKLT0EMGVGPXR7G` | -4.82, 1.18, -0.30 |
| 115 | star | multipart | `Pubuza-0OHV9E8DDI4E` | 3.10, 0.07, 11.73 |
| 116 | star | survey | `WGX-A83CW6ADURGFPOD` | 9.14, -0.20, -1.34 |
| 117 | nav | multipart | `Huzexo-0J6WGWDKQMTP` | -3.02, -1.35, 2.26 |
| 118 | nav | multipart | `Wapesu-0NJ3T73YTJLD` | -6.96, -1.36, 10.01 |
| 119 | feat | multipart | `Mikadu-0JS0XR2XGMEV` | 3.24, 0.59, 3.31 |
| 120 | star | multipart | `Cuzogi-0K15L5Q1WPMC` | 0.14, 0.33, 3.76 |
| 121 | star | survey | `XND-BXRH8YTIIKWISOA` | 13.35, -0.07, 3.80 |
| 122 | star | survey | `KRV-9HEPNF5UMJ0UQP4` | 3.89, 1.44, -3.56 |
| 123 | star | survey | `TRN-DJGC67E41H6VQ74` | 10.71, 1.86, 8.60 |
| 124 | star | multipart | `Rumuku-0KT65Q5RGKXC` | -3.93, -0.83, 5.15 |
| 125 | star | survey | `PVX-CTJMP076A7KU6W0` | -7.39, 1.55, 6.44 |
| 126 | star | multipart | `Poteka-0KA2XT5DVSL0` | 1.06, -0.91, 4.20 |
| 127 | nav | multipart | `Zuvumi-0FQBD42WJE2W` | -3.05, -0.56, -3.92 |
| 128 | nav | survey | `WGX-7UG5BCNFCI8124P` | 3.46, -0.74, -8.47 |
| 129 | feat | survey | `WGX-9IU66XSD19N1N6X` | 11.15, -0.70, -3.44 |
| 130 | star | survey | `TRN-CIFJ4Q7HDZM9XH6` | -10.20, -0.60, 5.52 |
| 131 | star | survey | `ZTA-9GDBELPGOZ5Z3SX` | 9.92, 0.85, -3.65 |
| 132 | star | multipart | `Repupi-0IVJDFPLXUZ1` | -3.96, -0.16, 1.70 |
| 133 | star | survey | `ODX-7IEI5T9Q05DCJY2` | 3.45, -0.42, -9.48 |
| 134 | star | survey | `TRN-A4IMQGISWSSDJPG` | 5.71, -0.28, -1.64 |
| 135 | star | survey | `NBG-ACOYILSNBG7MED7` | 7.14, 0.39, -0.96 |
| 136 | star | multipart | `Rudoki-0O50YLEUTB2A` | 6.03, 1.25, 11.09 |
| 137 | nav | survey | `TRN-88ZZAGNM2OSXXAG` | -7.33, 0.34, -7.26 |
| 138 | nav | multipart | `Rewake-0HHLOTYM57OA` | 10.54, 0.61, -0.78 |
| 139 | feat | multipart | `Vebupu-0CTUNOW1FZPQ` | 7.21, 0.48, -9.10 |
| 140 | star | multipart | `Hacahi-0KUURBK7AT2N` | -4.69, -1.27, 5.23 |
| 141 | star | survey | `XND-E8G91DRKF4UDYBC` | 5.37, 1.02, 10.68 |
| 142 | star | multipart | `Zufowi-0HISYPAT4RDD` | 2.94, -0.40, -0.72 |
| 143 | star | multipart | `Falari-0HM6DYT424VC` | -5.09, -1.73, -0.55 |
| 144 | star | survey | `WGX-AK1FPM4OXHCXI4L` | 9.48, 0.94, -0.35 |
| 145 | star | multipart | `Texito-0EBJMXOI863M` | -5.04, -1.79, -6.43 |
| 146 | star | multipart | `Wiguba-0L7V6P4854S9` | 3.49, -0.36, 5.88 |
| 147 | nav | multipart | `Dikula-0H11GAA5XDCJ` | 6.03, -1.03, -1.60 |
| 148 | nav | multipart | `Mezefu-0FTXU47HNXYW` | 13.45, -1.52, -3.74 |
| 149 | feat | survey | `ZTA-AEF1S770J6B0DHP` | -3.80, 0.97, -0.81 |
| 150 | star | survey | `ODX-C89SCO8K26NPDN8` | -5.08, 1.59, 4.67 |
| 151 | star | multipart | `Nijiko-0IHXM4KKDPOZ` | 3.18, -0.82, 1.02 |
| 152 | star | multipart | `Zuduzi-0LFWGMKK1PGP` | -11.61, -0.74, 6.28 |
| 153 | star | survey | `PVX-9W02NPG5QV9I9M8` | 11.27, -1.98, -2.35 |
| 154 | star | multipart | `Buyori-0F9C24H3JN86` | 9.76, 1.63, -4.76 |
| 155 | star | survey | `KRV-9KVKLEX3Q4S1G3A` | 3.33, -1.53, -3.27 |
| 156 | star | multipart | `Kasuda-0FJ2UU4LNUYV` | -3.16, -1.46, -4.28 |
| 157 | nav | multipart | `Supeme-0LB5R95K33PS` | -4.67, -0.91, 6.04 |
| 158 | nav | multipart | `Galenu-0F1Q5GIUCHQN` | 4.17, 0.51, -5.14 |
| 159 | feat | survey | `ODX-9J33VHDASOP2ZO8` | 8.98, -1.49, -3.42 |
| 160 | star | multipart | `Lisike-0OJ0ATR8DCMX` | -4.38, 1.96, 11.79 |
| 161 | star | survey | `QRN-EB7OFK0GY1GOP77` | -2.74, -1.16, 10.91 |
| 162 | star | multipart | `Repuli-0ITWNRK59UPJ` | 5.16, 0.65, 1.62 |
| 163 | star | multipart | `Fuhiwa-0OPIUEHVA9P3` | -2.66, -1.65, 12.11 |
| 164 | star | multipart | `Kozesi-0IN8SLF4QQUY` | 9.01, 0.38, 1.29 |
| 165 | star | multipart | `Pehivi-0E2YMS042YAT` | -1.84, -1.53, -6.86 |
| 166 | star | survey | `XND-BUHXVVJ5U6RF1S8` | -8.33, -0.12, 3.52 |
| 167 | nav | multipart | `Kivafe-0KKD0U70U7FG` | 6.59, 0.86, 4.71 |
| 168 | nav | multipart | `Poyina-0HARZBZ2X5B0` | 12.66, 0.97, -1.12 |
| 169 | feat | survey | `ODX-8RIJXMAFE7M1GL8` | 5.57, 1.49, -5.72 |
| 170 | star | multipart | `Zinojo-0K332UI2GRSW` | 12.93, -0.45, 3.86 |
| 171 | star | multipart | `Hiwigi-0EK2UMF4CYPY` | -5.44, 1.68, -6.01 |
| 172 | star | survey | `XND-8MYVHM7AQY5TEM6` | -8.12, 0.77, -6.10 |
| 173 | star | survey | `NBG-B30ZZ5QZLMZBDRL` | 9.12, 0.97, 1.24 |
| 174 | star | multipart | `Lebijo-0JR491S5Q095` | -8.60, -1.34, 3.26 |
| 175 | star | multipart | `Texevi-0FB5D784MZ1Y` | 9.80, 1.64, -4.67 |
| 176 | star | multipart | `Mifaso-0FN7NYZM07YU` | 9.75, 1.00, -4.07 |
| 177 | nav | survey | `NBG-6T6B7SN8IDDJ10N` | -0.19, -1.36, -11.58 |
| 178 | nav | multipart | `Xaperi-0IHKJTABQ37X` | -3.95, 0.57, 1.01 |
| 179 | feat | multipart | `Nukuhu-0J95F2I0V1V3` | -4.19, 1.11, 2.37 |
| 180 | star | multipart | `Yojese-0FO9DC8VWM4P` | -3.33, 1.01, -4.02 |
| 181 | star | multipart | `Bofiho-0DN2BA89DQ18` | 3.44, 0.49, -7.65 |
| 182 | star | survey | `NBG-DFJT6MKY1MCI0FT` | -0.46, -1.91, 8.28 |
| 183 | star | multipart | `Henawa-0GF3DNBI0AX1` | -6.79, -0.71, -2.69 |
| 184 | star | survey | `WGX-DEILQO2ZNZRQNU7` | -8.68, 1.72, 8.19 |
| 185 | star | survey | `KRV-B64R5Z1CCW175HE` | -8.05, -0.14, 1.49 |
| 186 | star | multipart | `Gilipa-0JOA26SZTQY2` | -7.30, -1.27, 3.12 |
| 187 | nav | survey | `VLC-9HP5HAG0V3T587F` | -11.47, 0.66, -3.54 |
| 188 | nav | multipart | `Tikela-0M7UUGB2XYHO` | 5.07, -0.33, 7.66 |
| 189 | feat | survey | `WGX-AFHZOMETXCZVP9D` | 8.59, -1.58, -0.72 |
| 190 | star | multipart | `Lezoza-0GHXQJM37KGI` | 6.79, -1.33, -2.55 |
| 191 | star | multipart | `Bexemi-0FMIAV22O7XM` | -2.97, 1.55, -4.11 |
| 192 | star | multipart | `Lesimo-0IWZLTXCCYBA` | 6.19, -1.47, 1.77 |
| 193 | star | multipart | `Vahuke-0LMLO0MFJ00Q` | 1.98, 1.78, 6.61 |
| 194 | star | multipart | `Nemadi-0E73K4CPCOHT` | -9.61, 1.39, -6.65 |
| 195 | star | multipart | `Rurunu-0J3GDPY7HYST` | -3.09, -1.45, 2.09 |
| 196 | star | multipart | `Hikoyi-0G04PL4M2AQY` | -1.74, 0.15, -3.43 |
| 197 | nav | multipart | `Goloyi-0LHNSN6NN2DA` | 9.26, -0.65, 6.37 |
| 198 | nav | multipart | `Zubuzi-0IJ339JYM209` | -8.76, 1.60, 1.08 |
| 199 | feat | survey | `NBG-C4P9TYGUFEYI54B` | 3.89, -0.43, 4.37 |

### rim

| # | family | class | name | position (x, y, z kpc) |
| --- | --- | --- | --- | --- |
| 0 | star | multipart | `Vunude-09BJVKSF5TVI` | -1.49, -1.03, -15.36 |
| 1 | star | multipart | `Famisu-08F0QPHZ9RFJ` | 0.62, 0.05, -16.97 |
| 2 | star | multipart | `Sakume-0QKZ34UUVHPH` | 7.45, -1.45, 15.46 |
| 3 | star | multipart | `Zubovu-09ABKINKHIG9` | 8.66, 0.55, -15.42 |
| 4 | star | multipart | `Vawido-0RSO3DQQW138` | 1.04, 1.47, 17.62 |
| 5 | star | multipart | `Ciyasi-0C63H8O0ZKGO` | -11.71, -1.33, -10.27 |
| 6 | star | multipart | `Joyija-0E4I14CE0WBC` | 15.51, -0.41, -6.78 |
| 7 | nav | multipart | `Vozeta-0C4W6GE8VDSG` | 11.49, -0.45, -10.33 |
| 8 | nav | multipart | `Wazifa-0ANL15CJDXHR` | 11.95, 0.19, -12.98 |
| 9 | feat | multipart | `Tikova-0K0WRMKREEVA` | 17.39, 1.61, 3.75 |
| 10 | star | survey | `KRV-6TN3U505RM90HEE` | 10.30, -1.18, -11.54 |
| 11 | star | multipart | `Bejeju-0PBWGSCGN8PY` | 10.64, -1.52, 13.22 |
| 12 | star | survey | `TRN-CKYPAY76KY2YX02` | 14.20, 0.04, 5.73 |
| 13 | star | multipart | `Ganeze-0PM7A2YLAA1M` | -3.98, 1.16, 13.73 |
| 14 | star | survey | `PVX-FKUVX5V112QDP20` | 6.91, 0.52, 14.71 |
| 15 | star | multipart | `Cidaja-0AD4D9H9AGL7` | -5.41, -1.79, -13.50 |
| 16 | star | multipart | `Zugesa-0QTJ1SIQZLFG` | -4.55, 1.32, 15.88 |
| 17 | nav | multipart | `Noveyu-0MOJ2090N7JB` | 14.32, 1.19, 8.49 |
| 18 | nav | multipart | `Morani-0KGZ4VFX31FQ` | -14.55, 0.53, 4.55 |
| 19 | feat | multipart | `Xayowo-0Q60N4FLNEIU` | 9.07, -0.95, 14.71 |
| 20 | star | multipart | `Niyape-0PIHFDA53VKI` | -10.78, -0.20, 13.55 |
| 21 | star | multipart | `Folaho-0CNTQG0PDDI0` | -13.08, -1.24, -9.40 |
| 22 | star | multipart | `Pibati-0M8TZJGD2RJC` | -14.30, -0.69, 7.71 |
| 23 | star | multipart | `Yufabu-08UCR66QROQL` | -2.19, -0.55, -16.21 |
| 24 | star | multipart | `Wazaba-0AJVEM8AKJZ3` | -5.34, 1.52, -13.16 |
| 25 | star | multipart | `Wayafo-0Q6SSVKAU9AF` | 8.89, -0.45, 14.75 |
| 26 | star | multipart | `Simela-0QILVZ4RDX14` | -5.27, -1.66, 15.34 |
| 27 | nav | multipart | `Jumeso-0EV8DRJL0AZD` | 14.89, 0.25, -5.46 |
| 28 | nav | multipart | `Sayifa-0PH8H0TS8VE0` | 10.40, 0.27, 13.49 |
| 29 | feat | multipart | `Haziza-0A7KNVJKJB8R` | 8.67, 1.01, -13.77 |
| 30 | star | multipart | `Sonupe-0BF9TZYX6AUM` | 11.27, -1.10, -11.61 |
| 31 | star | survey | `ODX-E37QF6ECSB3HK9G` | -13.27, -0.61, 10.25 |
| 32 | star | multipart | `Zodozu-0995LUEB4YS9` | -5.68, -0.90, -15.48 |
| 33 | star | multipart | `Nekowi-0JJ5NVCN7VPG` | -14.43, 0.38, 2.87 |
| 34 | star | multipart | `Vituda-0ARDTPE8B39O` | 8.27, 0.63, -12.79 |
| 35 | star | multipart | `Suyiwe-0N1IO17UUTL2` | 12.51, 1.18, 9.14 |
| 36 | star | multipart | `Bivabu-0RMJ3YPX4V7F` | -4.53, -1.74, 17.32 |
| 37 | nav | multipart | `Fosagi-0L1V18ENDAKM` | 17.06, -0.42, 5.58 |
| 38 | nav | survey | `PVX-6WT6MNEIOAU42NW` | 9.72, -1.87, -11.28 |
| 39 | feat | multipart | `Jetoca-0BUWL6965TM6` | 10.14, -1.25, -10.83 |
| 40 | star | multipart | `Rukepu-0QXNQPQXC8D7` | -2.86, -1.64, 16.09 |
| 41 | star | multipart | `Vofuwo-0NVPN45N2ETF` | 10.18, -0.98, 10.63 |
| 42 | star | multipart | `Tosafu-0N5CZ8IIXWBO` | 10.74, 0.13, 9.33 |
| 43 | star | multipart | `Lakitu-09V4CQJ7KE8T` | -5.21, 1.35, -14.39 |
| 44 | star | multipart | `Xibetu-0LFVM5L1QUYR` | 13.15, 0.31, 6.28 |
| 45 | star | survey | `QRN-D3PKU0UK3TXMPGH` | -14.74, 0.05, 7.29 |
| 46 | star | multipart | `Zesuzi-08WSWWPHLMN0` | -4.60, 1.62, -16.09 |
| 47 | nav | survey | `PVX-CVZ8P74NRFOPPUE` | 15.45, -1.66, 6.65 |
| 48 | nav | multipart | `Bujara-0GK3QKXUEMRF` | -17.28, -0.68, -2.44 |
| 49 | feat | multipart | `Micuha-0PFVLD9VRG6T` | -9.38, 1.21, 13.42 |
| 50 | star | survey | `NBG-8W1BPT8WP2Q7AR7` | -14.69, -0.80, -5.34 |
| 51 | star | multipart | `Hetufo-0R8D3QPV9YE4` | -4.02, -0.41, 16.62 |
| 52 | star | multipart | `Caroro-0JLSWGWM8Q9V` | 14.78, 1.85, 3.00 |
| 53 | star | multipart | `Lokuna-0B6K6PNA4ZND` | -10.13, -0.33, -12.04 |
| 54 | star | survey | `XND-F9B5E2XJC2AP4LU` | -2.81, -0.91, 13.75 |
| 55 | star | survey | `PVX-DG12W0YAVHN1LEK` | -12.84, -1.14, 8.32 |
| 56 | star | survey | `XND-B24KEKM09KHOELE` | -17.68, 1.48, 1.16 |
| 57 | nav | multipart | `Sayoga-0I0FMESC9MYP` | 17.76, -0.70, 0.16 |
| 58 | nav | survey | `ODX-GCD0ZQA51CTAD2C` | -5.50, -0.98, 17.01 |
| 59 | feat | multipart | `Kavuxa-0AJM5FH2OPFF` | -8.17, 1.20, -13.17 |
| 60 | star | multipart | `Vewobi-0CA7ALFGMBG8` | -11.91, -1.99, -10.07 |
| 61 | star | multipart | `Misitu-0H6C0JD4I38E` | -14.24, -1.67, -1.34 |
| 62 | star | multipart | `Tuzivo-0LW2PVJ25RL3` | -14.22, -1.07, 7.08 |
| 63 | star | multipart | `Pudobe-0D8APEJHX7G2` | 12.08, -1.69, -8.38 |
| 64 | star | multipart | `Milovi-0MNK7BI1IN6Y` | -13.31, -0.36, 8.44 |
| 65 | star | multipart | `Sujegu-0JJ64TXO9VUS` | 17.67, -0.29, 2.87 |
| 66 | star | multipart | `Wusiza-0AAI2PX07ZD1` | 4.07, -0.54, -13.63 |
| 67 | nav | multipart | `Lepaho-0L66N0CSI4IR` | 14.84, -1.35, 5.80 |
| 68 | nav | multipart | `Duvaso-083T0YBIO09N` | -3.78, 1.00, -17.53 |
| 69 | feat | multipart | `Cigumo-0OM04ZI10J74` | -12.90, 1.44, 11.94 |
| 70 | star | survey | `QRN-DG1EHCGAS7VFNXZ` | -14.21, -0.73, 8.32 |
| 71 | star | multipart | `Lelodi-08RFKQOP6CKD` | -0.87, -1.65, -16.36 |
| 72 | star | survey | `ODX-FHKAUU61WQ2AVVU` | -4.02, 1.16, 14.44 |
| 73 | star | multipart | `Zeruka-0N8JV9MII5K9` | 14.09, 1.78, 9.48 |
| 74 | star | multipart | `Webipe-0RBW2A85XEXQ` | -4.17, 1.94, 16.79 |
| 75 | star | survey | `KRV-FKVCLM0SZOJXDEC` | 1.25, -1.35, 14.72 |
| 76 | star | multipart | `Nosesi-0KL43B6HST37` | 15.79, -0.87, 4.75 |
| 77 | nav | multipart | `Gikudu-0OM3NF7PAEX1` | 9.88, -0.68, 11.94 |
| 78 | nav | multipart | `Dumeli-0E7T80T8YD7A` | 13.51, -0.47, -6.62 |
| 79 | feat | multipart | `Mucica-0F5GFDPVA997` | 15.89, 0.11, -4.95 |
| 80 | star | multipart | `Natiwo-0NDQRWLLOHV1` | -11.47, -0.43, 9.74 |
| 81 | star | multipart | `Nepego-0JOEB2PWZ4N7` | 17.01, -0.91, 3.13 |
| 82 | star | survey | `KRV-7L0FB5DDG197W4A` | -14.36, -0.08, -9.26 |
| 83 | star | multipart | `Cefoha-0CQXTC142BCG` | 10.97, -1.47, -9.24 |
| 84 | star | multipart | `Tugoco-0PZFD1JOUD1A` | 1.35, -1.66, 14.39 |
| 85 | star | survey | `XND-F51FVP13VTOU65G` | 4.63, 1.65, 13.40 |
| 86 | star | multipart | `Recuyo-0INXFEXK7UDD` | -17.33, 1.99, 1.32 |
| 87 | nav | multipart | `Rawesi-0AEESUIB0BIV` | -11.60, 0.71, -13.43 |
| 88 | nav | multipart | `Horeku-0G30J9WCO0HO` | 16.73, -1.05, -3.29 |
| 89 | feat | multipart | `Gorira-0AM6CMJMG7DL` | -7.43, -1.92, -13.05 |
| 90 | star | multipart | `Zosehe-0N86G58T4T45` | 11.54, 0.26, 9.47 |
| 91 | star | multipart | `Zesojo-0PWW8NJAQS8S` | -0.50, -1.42, 14.26 |
| 92 | star | multipart | `Losahu-0QH39IS9C6EX` | -7.24, 1.28, 15.26 |
| 93 | star | survey | `WGX-8O7UWYC98YUFOU7` | 14.07, -1.43, -5.99 |
| 94 | star | multipart | `Yemose-0FGDCFU9PBP8` | 16.89, 0.18, -4.41 |
| 95 | star | survey | `ODX-DI13QGP3FUH2THG` | -12.36, 0.43, 8.48 |
| 96 | star | multipart | `Zomaxi-0GH0D927SJB2` | -13.85, -0.68, -2.59 |
| 97 | nav | survey | `ZTA-4WKYD5ZDZEMM3ZV` | 1.53, -1.22, -17.29 |
| 98 | nav | multipart | `Dezixi-0BLHDYHOSE49` | -12.60, 1.78, -11.30 |
| 99 | feat | multipart | `Pakelu-0DX0SJ0HN38C` | -13.95, 1.54, -7.15 |
| 100 | star | survey | `ODX-ECRSD9G8B8NTH1A` | 8.90, 1.66, 11.04 |
| 101 | star | multipart | `Woyixo-0C91OT1X2OT2` | -13.16, -1.82, -10.13 |
| 102 | star | multipart | `Sasozu-0OSNR7S15YWX` | 7.19, -1.51, 12.27 |
| 103 | star | multipart | `Yoxesa-0OJL139YUR39` | 11.82, -1.98, 11.82 |
| 104 | star | multipart | `Wawomi-0MEJMI08TAW3` | 12.05, -0.57, 8.00 |
| 105 | star | multipart | `Wizewa-095ONHMHZIAN` | -2.07, 1.53, -15.65 |
| 106 | star | multipart | `Soxumu-09D0CIOS062G` | -6.89, -1.33, -15.29 |
| 107 | nav | survey | `TRN-C9GAY4WUXI4H45K` | -14.82, 0.94, 4.77 |
| 108 | nav | multipart | `Fizafa-0G22HD2GBCT9` | -14.81, -0.70, -3.33 |
| 109 | feat | multipart | `Rodoxa-0IX4Z3ERNTHA` | -16.95, -1.98, 1.78 |
| 110 | star | multipart | `Mehedu-0DDALTLZXIRC` | 15.94, 0.34, -8.13 |
| 111 | star | multipart | `Jidupe-0C4K8S3T2W2J` | -10.72, 0.64, -10.35 |
| 112 | star | multipart | `Ragace-0IFZMK8SCC0V` | 14.71, -0.57, 0.93 |
| 113 | star | multipart | `Bejeba-0GEJJX00ZPRW` | -15.69, -1.60, -2.72 |
| 114 | star | multipart | `Yevuxu-0RTE67ERZ4F7` | 2.98, -0.74, 17.66 |
| 115 | star | multipart | `Netigu-0NTF9VP83NDX` | 11.94, -1.21, 10.52 |
| 116 | star | survey | `XND-FHU4OOFRAUYW14K` | 10.30, 1.82, 14.46 |
| 117 | nav | multipart | `Nehise-0DTD5E6L8IM2` | -14.06, 0.05, -7.34 |
| 118 | nav | multipart | `Rizuye-0HYE1EHWR9DR` | -15.95, -0.14, 0.05 |
| 119 | feat | multipart | `Temudu-0BPVGJDSGFAP` | 12.23, -0.01, -11.08 |
| 120 | star | multipart | `Gararu-0RC1M5N6M5ND` | -5.22, -1.93, 16.80 |
| 121 | star | multipart | `Wimebo-0M45TGGKU3JG` | -13.12, 1.67, 7.48 |
| 122 | star | multipart | `Zoyuta-0LRHJ2OA63MU` | 14.62, 1.23, 6.85 |
| 123 | star | multipart | `Tepune-0PSBICB5A29W` | 6.98, -0.50, 14.04 |
| 124 | star | multipart | `Yoyigu-0A411SFFGXZG` | 8.52, 1.68, -13.95 |
| 125 | star | multipart | `Lenodu-0QCURHTQ8QQN` | -0.92, 1.02, 15.05 |
| 126 | star | survey | `TRN-5P8WQHB4841NN3I` | -3.11, 1.73, -14.90 |
| 127 | nav | survey | `TRN-6I9HWC8522A8E8W` | -6.65, -1.24, -12.49 |
| 128 | nav | multipart | `Joyaxi-0G6LUTXEN2N0` | 15.56, 0.42, -3.11 |
| 129 | feat | survey | `PVX-5EZYI0E915K92ZY` | 5.85, -1.57, -15.76 |
| 130 | star | multipart | `Zazuka-0G7WQO327KV0` | -17.02, 0.42, -3.04 |
| 131 | star | survey | `VLC-874T4UA6HGUCVAD` | 12.24, -1.06, -7.42 |
| 132 | star | multipart | `Moseco-0NMQBRPOYG5N` | -13.67, -1.43, 10.19 |
| 133 | star | multipart | `Zupevo-0HNMLLUVHNNJ` | 15.28, 0.99, -0.48 |
| 134 | star | multipart | `Vudacu-0NAO57GL5IEH` | 15.09, 0.42, 9.59 |
| 135 | star | multipart | `Tapufe-09Q8P7ENU941` | -0.86, 0.66, -14.63 |
| 136 | star | multipart | `Valaka-0LZTMO12DJAD` | 13.13, 0.96, 7.27 |
| 137 | nav | survey | `VLC-67BZT4STL372DRF` | 7.89, -0.55, -13.40 |
| 138 | nav | multipart | `Dozije-0PCMKFCHUQG7` | 8.10, 1.96, 13.26 |
| 139 | feat | multipart | `Paxabo-0BXFM36QDHDO` | -9.57, 0.31, -10.70 |
| 140 | star | multipart | `Riripi-0QESQ0GPGTZX` | -0.46, -1.12, 15.15 |
| 141 | star | multipart | `Sedove-0FGNQW73LNXA` | -13.91, 1.06, -4.40 |
| 142 | star | multipart | `Kuvevo-0ABDYMBBT1ZQ` | -9.70, -1.93, -13.58 |
| 143 | star | multipart | `Heluri-0N787ZL2G1ZD` | 14.52, 1.68, 9.42 |
| 144 | star | multipart | `Zupuyo-0AKHZAIK4JS9` | 6.32, 0.79, -13.13 |
| 145 | star | multipart | `Wazazu-0ND7KF07OBWU` | -11.87, 1.10, 9.72 |
| 146 | star | survey | `ZTA-A0UAQUV1P6I77NJ` | -14.35, 0.36, -1.94 |
| 147 | nav | multipart | `Giyubo-0N6PAXCBQJ00` | -11.11, 1.75, 9.39 |
| 148 | nav | multipart | `Yoxizi-0ML63XOOT65M` | -11.57, -1.83, 8.32 |
| 149 | feat | survey | `VLC-FTBHB2WFTSVCXA7` | -6.93, -1.72, 15.42 |
| 150 | star | multipart | `Tifuye-0DRHMSFS73VB` | 16.14, -0.74, -7.43 |
| 151 | star | survey | `KRV-CGO0BXV2QPMFEU8` | -13.73, 0.34, 5.37 |
| 152 | star | multipart | `Neheri-0CCTX4WEIE52` | -14.35, -1.09, -9.94 |
| 153 | star | multipart | `Goreji-09SUIUA0DGZV` | 9.38, 0.44, -14.50 |
| 154 | star | multipart | `Dabumi-09D3HU6GJ4OO` | -7.48, -0.77, -15.28 |
| 155 | star | multipart | `Xikapa-09GCFGNC61ZC` | 8.24, -0.56, -15.12 |
| 156 | star | multipart | `Zunado-0QR3Y2XZTNEM` | -1.61, -0.01, 15.76 |
| 157 | nav | multipart | `Guzegu-0EPG0927EYKA` | -15.13, -0.87, -5.74 |
| 158 | nav | multipart | `Sinuso-0OTR20293QTQ` | -12.29, -1.34, 12.32 |
| 159 | feat | multipart | `Kimoge-0F26MJXMQVBW` | 15.88, 1.45, -5.11 |
| 160 | star | multipart | `Wehiha-0AQDV18UN3CH` | 12.21, 1.88, -12.84 |
| 161 | star | multipart | `Xiwihi-0RJ0AG0DFL50` | 1.86, 1.27, 17.14 |
| 162 | star | multipart | `Dowanu-0RGFVWFBSVWL` | 4.84, -0.31, 17.02 |
| 163 | star | multipart | `Xenebo-0DA688QZDLKP` | -13.64, -1.04, -8.29 |
| 164 | star | multipart | `Litaso-0H81FPW9C8XT` | 17.61, 1.33, -1.25 |
| 165 | star | multipart | `Cezufa-0K13FVNAXPK4` | 16.67, -0.27, 3.76 |
| 166 | star | multipart | `Makaro-09CG5GJW4IRP` | 6.80, -1.85, -15.32 |
| 167 | nav | survey | `WGX-5AKTNG2BZQMNV15` | 2.71, -1.60, -16.13 |
| 168 | nav | survey | `QRN-5LJUA16D76XS7T1` | 5.04, 0.66, -15.21 |
| 169 | feat | multipart | `Yigamu-0LW0CACA93AC` | 12.54, 0.87, 7.08 |
| 170 | star | multipart | `Hekeye-094UMGQZ9507` | -8.44, 0.10, -15.69 |
| 171 | star | multipart | `Hesepi-0HOYC4JCZJ6N` | 15.72, 0.27, -0.41 |
| 172 | star | multipart | `Dimase-0AP9BL2MQCGT` | -7.28, 1.84, -12.90 |
| 173 | star | multipart | `Ligave-0R45U8YQ9I9Y` | 6.45, -0.10, 16.41 |
| 174 | star | multipart | `Dicime-0J96CF01UOWY` | -16.72, 0.81, 2.37 |
| 175 | star | multipart | `Pekafi-0QACY772DL22` | -5.70, 0.94, 14.93 |
| 176 | star | multipart | `Zabobi-0AHI2Q7PARJ3` | -5.01, 1.31, -13.28 |
| 177 | nav | survey | `QRN-FKZ3PZ8YTPAAN27` | -0.93, -0.33, 14.72 |
| 178 | nav | multipart | `Kihafu-0GKGJ1JWF99A` | -14.15, -1.24, -2.42 |
| 179 | feat | multipart | `Savedi-0PV22KYQ8A1I` | -7.07, -0.98, 14.17 |
| 180 | star | multipart | `Tivipe-0JO86YZ59YO3` | 17.48, -1.04, 3.12 |
| 181 | star | multipart | `Zaduco-08258CA6ENWE` | -0.87, 0.57, -17.61 |
| 182 | star | multipart | `Vuwuju-0PF4JU295U1Z` | 10.32, -0.35, 13.38 |
| 183 | star | multipart | `Guluha-0GPQY4CG5QCA` | 14.41, -2.00, -2.16 |
| 184 | star | multipart | `Kezito-09BRUTLY2S2K` | -5.15, 1.24, -15.35 |
| 185 | star | multipart | `Zofiwo-0E26S01IBDCO` | -14.83, -1.44, -6.90 |
| 186 | star | multipart | `Muduke-0DMTV1XWY2YG` | 15.17, 0.86, -7.66 |
| 187 | nav | multipart | `Guzuda-0QJNGCRBIY05` | 5.02, 0.70, 15.39 |
| 188 | nav | multipart | `Vetewe-0PGPWNUZR9GM` | 8.03, 1.33, 13.46 |
| 189 | feat | multipart | `Zicuxe-0EPE95XN0N6I` | 15.55, 1.05, -5.75 |
| 190 | star | survey | `TRN-5MBBM21VJEGYP96` | -2.58, -1.88, -15.15 |
| 191 | star | multipart | `Goruke-0QU8WLC3EIIO` | 1.86, -1.41, 15.92 |
| 192 | star | multipart | `Yuvudo-08H0R156SWNY` | -1.59, 0.61, -16.87 |
| 193 | star | multipart | `Subaha-0HWHDEGUALB1` | 14.13, -0.84, -0.04 |
| 194 | star | multipart | `Texaxu-0O07L8AID5RH` | -13.86, 0.90, 10.86 |
| 195 | star | multipart | `Nobubu-0KQOOSJC9IZP` | 17.25, -1.23, 5.03 |
| 196 | star | multipart | `Fozoco-0BFJ77LB30WB` | 8.26, -1.58, -11.59 |
| 197 | nav | multipart | `Vugive-0EHAKMK307VE` | 14.97, 1.95, -6.15 |
| 198 | nav | survey | `ZTA-EF5C79TRE4S3BN7` | 10.65, 1.69, 11.24 |
| 199 | feat | multipart | `Mikuko-08J0FO6V498A` | -4.53, -0.31, -16.78 |

### halo

| # | family | class | name | position (x, y, z kpc) |
| --- | --- | --- | --- | --- |
| 0 | star | survey | `QRN-CJNUKAAUAHR8LIV` | 5.25, -4.30, 5.62 |
| 1 | star | multipart | `Lefisi-0IBBHQ92CHXY` | 9.57, -3.59, 0.70 |
| 2 | star | multipart | `Mesuvo-0ESZENJDLC2O` | -7.03, -2.61, -5.57 |
| 3 | star | multipart | `Gawoje-0I7B6CH851KJ` | 0.71, 2.11, 0.50 |
| 4 | star | multipart | `Vusovi-0LVMIJYY8BED` | 1.44, -2.73, 7.06 |
| 5 | star | survey | `XND-B962W5L7ZJ08HAK` | 8.64, -2.61, 1.75 |
| 6 | star | multipart | `Gewohi-0HEDC3B5R5WY` | -0.16, 3.38, -0.94 |
| 7 | nav | multipart | `Junane-0ENDZQQLJ9XO` | 6.60, -4.24, -5.85 |
| 8 | nav | multipart | `Jecaji-0GY9E1QIRXYF` | -2.35, -4.59, -1.74 |
| 9 | feat | multipart | `Katifa-0JIP8BJZ9TD8` | -9.72, 3.03, 2.85 |
| 10 | star | multipart | `Citeke-0GQ4IVW34EDM` | -1.10, -2.39, -2.14 |
| 11 | star | multipart | `Jebefi-0LZR6688HYQA` | -1.88, -3.21, 7.26 |
| 12 | star | multipart | `Hopilu-0LJJSODGI6FW` | 9.06, -3.07, 6.46 |
| 13 | star | multipart | `Ludipe-0ICLXA990PVZ` | 2.73, -3.92, 0.76 |
| 14 | star | multipart | `Litobo-0FD3SE9GHHF4` | 0.21, 4.40, -4.57 |
| 15 | star | multipart | `Xuzuse-0EUB20JBJ3SI` | 6.07, 2.11, -5.50 |
| 16 | star | survey | `KRV-9KP9FR5LSFCWOOS` | -11.11, -2.58, -3.29 |
| 17 | nav | survey | `KRV-DDU64A34JN0AGTO` | -1.42, 4.95, 8.13 |
| 18 | nav | multipart | `Fafafa-0J3Q1NANL1ED` | 5.65, -2.61, 2.10 |
| 19 | feat | multipart | `Fofivo-0HW5TKPH5HUZ` | -0.51, -3.65, -0.06 |
| 20 | star | multipart | `Seyayu-0H2U79NVSEDS` | -1.07, 3.58, -1.51 |
| 21 | star | survey | `PVX-C782A6EF6J9MJME` | 2.70, 3.13, 4.58 |
| 22 | star | survey | `WGX-ANX9CKMO6VKGY2R` | 0.05, -2.95, -0.02 |
| 23 | star | multipart | `Tuvalo-0ECIFCHF5MZW` | 6.24, -3.41, -6.39 |
| 24 | star | survey | `NBG-AWBAR1YD4XNHLTF` | -0.07, 4.81, 0.68 |
| 25 | star | multipart | `Forado-0IY68U6BQITW` | -0.12, 2.42, 1.83 |
| 26 | star | multipart | `Waduwa-0HVS03TRTCNN` | 8.36, -4.48, -0.08 |
| 27 | nav | survey | `ODX-9LOX5BITY02XPAM` | -0.68, -2.36, -3.21 |
| 28 | nav | multipart | `Mehuku-0NEPNQMVJTSH` | -5.74, -2.66, 9.79 |
| 29 | feat | multipart | `Gofeku-0K3V7MPO3KK3` | 3.14, -3.64, 3.90 |
| 30 | star | multipart | `Misiza-0F2KEJ1GS5HE` | -5.30, -2.70, -5.09 |
| 31 | star | multipart | `Roxoca-0L9H70SAICGN` | -2.14, 3.24, 5.96 |
| 32 | star | multipart | `Coxosi-0IZNIJ0GRAA9` | -2.91, 2.68, 1.90 |
| 33 | star | multipart | `Vidisa-0I0RYUU8CQD0` | -0.16, 4.64, 0.17 |
| 34 | star | multipart | `Jeyegi-0IJT6IF42QXB` | -6.18, 4.29, 1.12 |
| 35 | star | multipart | `Salisu-0E8CNVENYBZ2` | -6.41, -4.30, -6.59 |
| 36 | star | multipart | `Vifari-0H1OZB020TQQ` | 0.07, 4.12, -1.57 |
| 37 | nav | survey | `ODX-DE0RNDVHRAZ9JE4` | -5.47, -4.01, 8.15 |
| 38 | nav | survey | `QRN-7287VFKIGYUCU2T` | -2.44, 3.40, -10.82 |
| 39 | feat | survey | `WGX-DUIHC7RQURNM35J` | 7.01, -4.26, 9.52 |
| 40 | star | multipart | `Bocoxi-0EORVZJKL73D` | 2.16, -2.52, -5.78 |
| 41 | star | multipart | `Jugacu-0NQ1ZUHI5CE3` | -3.67, 4.41, 10.35 |
| 42 | star | multipart | `Wutohe-0JMGO07CGPO2` | -3.19, 2.43, 3.03 |
| 43 | star | multipart | `Gocifa-0HVBB4KLQHLG` | -0.17, 4.42, -0.10 |
| 44 | star | multipart | `Javera-0K7NU4NFPE3H` | 7.10, 2.42, 4.08 |
| 45 | star | multipart | `Dizaxe-0G1HKYAB9VLF` | 9.57, -2.34, -3.36 |
| 46 | star | survey | `PVX-9YM0FYBY1FADJ9E` | 4.51, -4.82, -2.13 |
| 47 | nav | multipart | `Fasufu-0HPS6IHRJOBD` | 6.07, 3.50, -0.37 |
| 48 | nav | multipart | `Wevumo-0JMWEDUUZUNA` | -8.41, -4.15, 3.06 |
| 49 | feat | multipart | `Vanabi-0O5VYBJY7J3T` | 0.90, -3.01, 11.14 |
| 50 | star | multipart | `Tekufa-0LUFDS07WRFB` | 4.91, -4.76, 7.00 |
| 51 | star | multipart | `Lacove-0JZ50L28RBTI` | -1.19, 4.29, 3.66 |
| 52 | star | multipart | `Memewu-0HIYBKKPG8CN` | -3.25, -4.19, -0.71 |
| 53 | star | multipart | `Sopobe-0HFRRA0DYRHQ` | 0.98, -2.10, -0.87 |
| 54 | star | survey | `TRN-D3A65UQ0HRKG76W` | -8.15, 4.95, 7.25 |
| 55 | star | multipart | `Busace-0HONRQIHKLT8` | 0.42, -3.93, -0.43 |
| 56 | star | multipart | `Tihepo-0FVAAYAUCJ4Z` | -6.14, -2.61, -3.67 |
| 57 | nav | survey | `NBG-ACXXJXMFYMU7MM1` | -0.69, 2.55, -0.94 |
| 58 | nav | multipart | `Zetoga-0JMMT4GHW43R` | -8.20, -3.64, 3.04 |
| 59 | feat | survey | `VLC-AQ69RF3G9SETRCB` | 0.61, 2.79, 0.17 |
| 60 | star | survey | `QRN-ATTXKLFIO4O7MCX` | 11.49, 4.93, 0.47 |
| 61 | star | survey | `ODX-B3ZJC6A9OJ22LB2` | 7.24, -3.36, 1.32 |
| 62 | star | multipart | `Zaluna-0IKSGCKF58IY` | -2.70, -3.96, 1.17 |
| 63 | star | multipart | `Gomaxe-0J1JUX5256J4` | 1.26, -2.39, 2.00 |
| 64 | star | survey | `NBG-CIY62DQLR9KD8RT` | 1.52, -3.40, 5.56 |
| 65 | star | survey | `PVX-A36THEH4OV1GRME` | 1.38, -3.38, -1.75 |
| 66 | star | multipart | `Wonawa-0GMATN1TWTTG` | 3.32, 3.81, -2.33 |
| 67 | nav | multipart | `Dazepe-0I2S9WWFWVNW` | 0.20, -3.91, 0.27 |
| 68 | nav | multipart | `Noremi-0J69KWV19PRR` | 0.67, 4.58, 2.23 |
| 69 | feat | survey | `TRN-AIJGINWC5B5IP4W` | -11.36, 3.37, -0.47 |
| 70 | star | multipart | `Somiba-0JD344UM0CZ6` | 1.94, -2.50, 2.57 |
| 71 | star | survey | `XND-9OJ7925UU2AQR48` | 4.75, -3.91, -2.97 |
| 72 | star | multipart | `Nacume-0FAC1LWLVUA8` | 0.88, 4.29, -4.71 |
| 73 | star | multipart | `Jovika-0HQIGHUJBIP9` | -0.11, -2.20, -0.34 |
| 74 | star | multipart | `Sivuya-0I6YLO8SIZFC` | 5.51, 2.97, 0.48 |
| 75 | star | multipart | `Zucofu-0MYA0MI26UKX` | -4.83, -2.96, 8.97 |
| 76 | star | multipart | `Hocubo-0HTLDRZROUPA` | 2.40, -4.18, -0.18 |
| 77 | nav | multipart | `Codewe-0F8Q1FQ5JO4N` | 1.21, -4.61, -4.79 |
| 78 | nav | multipart | `Bamuto-0HNXS7IE2X3N` | 1.85, 2.34, -0.46 |
| 79 | feat | multipart | `Dukoma-0I9JG7DI90IC` | 7.69, -3.85, 0.61 |
| 80 | star | multipart | `Leniti-0I87SXJNKGVD` | -10.05, 3.23, 0.54 |
| 81 | star | multipart | `Leduki-0MQFRD22PFV7` | -2.14, -3.08, 8.59 |
| 82 | star | multipart | `Pabote-0GDILPENTMPI` | 6.55, 2.92, -2.77 |
| 83 | star | multipart | `Fapulu-0HWD6LYTKIFP` | 1.70, 3.79, -0.05 |
| 84 | star | multipart | `Gipovi-0GYANX6SHS2C` | 1.55, 4.96, -1.74 |
| 85 | star | multipart | `Poxaku-0EZPKGL5VO6L` | 5.66, -3.03, -5.24 |
| 86 | star | multipart | `Gudaco-0F763YZXRQ33` | -0.75, 4.69, -4.87 |
| 87 | nav | multipart | `Hapawi-0GWNXIF34MU6` | -11.80, -3.56, -1.82 |
| 88 | nav | multipart | `Fevini-0GSBJB0939AM` | -2.55, 3.11, -2.03 |
| 89 | feat | multipart | `Gesuri-0FJTDYUHZGHA` | 7.60, -4.74, -4.24 |
| 90 | star | multipart | `Dopuve-0FKOA8Y8RVJ9` | -2.25, -3.79, -4.20 |
| 91 | star | multipart | `Vicave-0IUZZOD1EY3W` | -7.86, 2.94, 1.67 |
| 92 | star | multipart | `Camoxu-0GX1EA75VKCZ` | 3.43, 2.26, -1.80 |
| 93 | star | multipart | `Wakovu-0HTPWQC19QJ6` | -0.13, 3.10, -0.18 |
| 94 | star | survey | `NBG-A6UHCS1ZNBGF3AD` | -1.97, -3.49, -1.44 |
| 95 | star | multipart | `Kezame-0NEZBJAV07KL` | -1.36, -2.97, 9.80 |
| 96 | star | multipart | `Podade-0K1OHT1FI3JR` | -1.24, 4.56, 3.79 |
| 97 | nav | multipart | `Bewebi-0IM5TT21RRSM` | 2.01, 2.79, 1.23 |
| 98 | nav | survey | `VLC-AX9BD4AN8E6LWGR` | -1.49, 2.30, 0.76 |
| 99 | feat | multipart | `Totoxe-0KWB289RMHZR` | -0.80, 3.37, 5.31 |
| 100 | star | multipart | `Vuvino-0DM6KFGYJEA0` | -3.61, 3.84, -7.69 |
| 101 | star | multipart | `Rixomu-0K12HXLHDPVK` | 9.67, 3.07, 3.76 |
| 102 | star | multipart | `Pahuru-0HJ4UPIR1P68` | -2.08, 3.42, -0.70 |
| 103 | star | survey | `TRN-COLCWOANWM3J6CG` | 8.91, 3.31, 6.03 |
| 104 | star | multipart | `Henudi-0EK8DV7B7N2F` | 1.16, -4.03, -6.00 |
| 105 | star | multipart | `Venofu-0GXXOTD8EGA0` | -3.57, -2.48, -1.75 |
| 106 | star | multipart | `Tixoki-0HHW6RAMJ7A8` | -11.10, -3.76, -0.76 |
| 107 | nav | survey | `ZTA-9JBCTY4KFS932FN` | -4.44, -2.22, -3.40 |
| 108 | nav | survey | `KRV-CUREK06Y6STFW6U` | 2.34, 4.21, 6.54 |
| 109 | feat | survey | `ODX-AFF3FKNFZ813OYK` | -2.73, -3.78, -0.73 |
| 110 | star | multipart | `Sibije-0HXY52Z47CQ4` | -0.01, -3.71, 0.03 |
| 111 | star | survey | `QRN-DUQZMXN91W1QAB9` | -5.36, 4.32, 9.54 |
| 112 | star | multipart | `Giduni-0H2S6IC2PM4Y` | 1.62, 2.41, -1.51 |
| 113 | star | multipart | `Cokuni-0L1WOK8ZHS6Y` | 0.60, 4.34, 5.58 |
| 114 | star | multipart | `Nidama-0JZRD7LLM5XP` | -10.86, 4.61, 3.69 |
| 115 | star | multipart | `Fovomu-0JUDFLZJTYBT` | -7.77, -2.16, 3.43 |
| 116 | star | multipart | `Lumuso-0IC8760LIR72` | -4.54, 2.49, 0.74 |
| 117 | nav | multipart | `Kowoni-0G4YK81LW9Q7` | -10.43, -2.85, -3.19 |
| 118 | nav | multipart | `Mabico-0H5GI2NTGT77` | 1.21, 3.25, -1.38 |
| 119 | feat | multipart | `Rumino-0HXINFDAG5F0` | 0.22, -3.70, 0.01 |
| 120 | star | survey | `TRN-9LSOBC2ZO3DPDG2` | 1.38, -3.18, -3.20 |
| 121 | star | multipart | `Zakoxu-0KGKOLCAXEJ6` | -5.82, 4.19, 4.53 |
| 122 | star | multipart | `Tejedi-0H34MJ6VCD7X` | -6.01, 4.63, -1.50 |
| 123 | star | multipart | `Naregi-0G6BWU7UHMIZ` | 1.58, -3.24, -3.12 |
| 124 | star | survey | `KRV-BH8YWUW104OTLEW` | -11.39, -2.18, 2.42 |
| 125 | star | multipart | `Rahoju-0LSK2AGVBX3N` | -8.18, 4.62, 6.91 |
| 126 | star | multipart | `Xogido-0I5QS64EFODQ` | 1.01, -3.29, 0.42 |
| 127 | nav | multipart | `Lumahe-0H603HL2RR0U` | 2.57, -2.95, -1.35 |
| 128 | nav | multipart | `Hasiju-0HBV7QIBOG3Y` | 2.80, -3.39, -1.06 |
| 129 | feat | multipart | `Jifiju-0DXP84U7GAFH` | 1.82, 2.64, -7.12 |
| 130 | star | multipart | `Cakiko-0IKUSK4I0NCQ` | 7.15, 2.06, 1.17 |
| 131 | star | survey | `PVX-E8SCZPV5G84FTGE` | 0.18, 2.78, 10.71 |
| 132 | star | survey | `ZTA-COSCIBM9L34JMVR` | -1.06, 3.85, 6.05 |
| 133 | star | multipart | `Titace-0HORL7CGJ3E3` | -1.38, -3.13, -0.42 |
| 134 | star | multipart | `Dotoko-0H5NKM9GDKGE` | 2.07, -2.31, -1.37 |
| 135 | star | multipart | `Runico-0N4Z37JSD453` | -5.53, 3.31, 9.31 |
| 136 | star | survey | `KRV-AMKE89BSDNHQWUQ` | 0.05, 2.51, -0.14 |
| 137 | nav | multipart | `Xuleku-0IXL035IFAIR` | -9.56, -4.84, 1.80 |
| 138 | nav | multipart | `Leruze-0HPIQE6N10NE` | -0.04, -4.66, -0.39 |
| 139 | feat | survey | `ODX-9RV4ZP4PLCY872C` | -1.54, 4.68, -2.69 |
| 140 | star | multipart | `Xuxaga-0J1YXU2979QL` | -0.66, -4.15, 2.02 |
| 141 | star | survey | `WGX-C291G5RWNKF8W7P` | 0.43, -3.37, 4.17 |
| 142 | star | multipart | `Kiniba-0BIFIBUPIGRK` | -0.12, -4.43, -11.45 |
| 143 | star | survey | `WGX-BCFIIT4904R4837` | 3.70, -2.65, 2.02 |
| 144 | star | multipart | `Lucofe-0JC8DOKS9Y34` | 0.26, -2.63, 2.53 |
| 145 | star | multipart | `Wolawi-0HRLF7LTTJ69` | -0.68, 2.78, -0.28 |
| 146 | star | multipart | `Lenebu-0GFAQGSKF4O9` | -2.20, -2.07, -2.68 |
| 147 | nav | multipart | `Yomiti-0IE66P99QVPO` | -1.40, -2.71, 0.84 |
| 148 | nav | multipart | `Faxoda-0GBUVVUWTRQJ` | 1.62, -3.66, -2.85 |
| 149 | feat | multipart | `Mupoci-0I6MJLUP6SOJ` | -0.05, 2.66, 0.46 |
| 150 | star | multipart | `Payule-0CCW3O9OXLAI` | 0.34, 4.02, -9.94 |
| 151 | star | multipart | `Libeli-0FNED0EDSP7Q` | -8.53, 3.01, -4.06 |
| 152 | star | multipart | `Fagavo-0KVJXGFFD8MV` | -0.41, 2.92, 5.27 |
| 153 | star | multipart | `Zagoju-0ICIUNX0794L` | 0.75, 3.84, 0.76 |
| 154 | star | survey | `WGX-A4CO8A5NUPF0AZN` | -7.17, 3.28, -1.65 |
| 155 | star | multipart | `Wukuve-0FJW3Y39A7F2` | 6.35, -3.35, -4.24 |
| 156 | star | multipart | `Wuyowi-0I9B3BI0OSMH` | -2.79, -3.98, 0.60 |
| 157 | nav | survey | `VLC-BDKONYQJJ7ZE9D5` | 1.44, -3.16, 2.11 |
| 158 | nav | multipart | `Jaxuyo-0HIZJQM440UJ` | 0.13, -3.43, -0.71 |
| 159 | feat | survey | `NBG-71LGZOURQFBNMT3` | 2.38, -3.77, -10.88 |
| 160 | star | multipart | `Kocevu-0L0SWNQ99JY2` | 0.65, 4.61, 5.53 |
| 161 | star | multipart | `Nikeva-0I04IH0LRS0B` | 0.49, -4.87, 0.14 |
| 162 | star | multipart | `Lokufi-0H7VFRTCC1GC` | 9.88, 3.56, -1.26 |
| 163 | star | multipart | `Tiyuve-0NACUU7RAN3N` | -1.08, -4.73, 9.57 |
| 164 | star | multipart | `Fahocu-0HLWHQEXV53O` | 0.52, 4.14, -0.56 |
| 165 | star | survey | `ZTA-95GRQGKZY2LHE5L` | -4.13, 2.13, -4.56 |
| 166 | star | multipart | `Sosigi-0JI6U3NPO5QU` | 0.23, 3.17, 2.82 |
| 167 | nav | multipart | `Hejene-0I3HWUNAXQNN` | 5.65, -2.44, 0.31 |
| 168 | nav | multipart | `Diwizi-0JRF1GHAFI6Q` | 2.35, -2.70, 3.28 |
| 169 | feat | survey | `ZTA-AASGWGJ0H1HI3EH` | -3.45, -4.72, -1.12 |
| 170 | star | multipart | `Nocila-0HFWMRWMRSSY` | -0.31, 3.58, -0.86 |
| 171 | star | survey | `XND-7L7O61IYS32Y20U` | -2.88, -2.08, -9.24 |
| 172 | star | multipart | `Dixahe-0HTCW8OLS8EM` | 1.63, -3.17, -0.20 |
| 173 | star | multipart | `Dotozu-0GB644SJGAUI` | -5.89, 3.72, -2.88 |
| 174 | star | multipart | `Wagavu-0L3HLZSTCOUZ` | 3.30, 2.83, 5.66 |
| 175 | star | multipart | `Kogedu-0KRTI4INUEJK` | 6.42, 4.64, 5.08 |
| 176 | star | multipart | `Vutupa-0HJC9SQ2SZL8` | -0.61, -2.14, -0.69 |
| 177 | nav | multipart | `Ricabe-0I1Z02LDHOD4` | 9.84, -2.06, 0.23 |
| 178 | nav | survey | `NBG-BQPICZ5JFV6LFBZ` | 0.48, 3.50, 3.21 |
| 179 | feat | multipart | `Xicari-0FMER9Y8P3JN` | 3.94, 3.79, -4.11 |
| 180 | star | multipart | `Numara-0HUOS1E5T8DH` | -5.72, -4.55, -0.13 |
| 181 | star | survey | `QRN-BJ3C8HUV4BDIGTJ` | 9.18, -2.14, 2.57 |
| 182 | star | multipart | `Luhohu-0K2LEJSOVYQ8` | 0.86, -4.40, 3.83 |
| 183 | star | multipart | `Watajo-0FSKUR7NN3KC` | -4.61, 4.75, -3.80 |
| 184 | star | multipart | `Vepali-0MO1MYJHYHBT` | 5.78, -4.82, 8.47 |
| 185 | star | multipart | `Xasago-0KL0U8E7L5RP` | -4.42, 4.91, 4.75 |
| 186 | star | survey | `QRN-BXK5ON6AA59ISLN` | -0.63, 3.98, 3.78 |
| 187 | nav | survey | `TRN-C3P5OXN6KF2T1E6` | 0.95, 2.89, 4.29 |
| 188 | nav | multipart | `Cipiku-0JKMJOHM0RVZ` | -0.31, -3.24, 2.94 |
| 189 | feat | multipart | `Fevewa-0JQ1476JJTJP` | 0.25, 2.34, 3.21 |
| 190 | star | multipart | `Huleya-0I310MPCT6J7` | -0.21, 3.88, 0.28 |
| 191 | star | multipart | `Homabi-0BHM8M8IUXS4` | 2.53, -3.02, -11.49 |
| 192 | star | multipart | `Hosofo-0HHNROE8PFWS` | 0.66, -3.70, -0.78 |
| 193 | star | multipart | `Sihana-0M8N4R9W9733` | 3.19, 4.61, 7.70 |
| 194 | star | multipart | `Zubara-0FPJSW3NP9OM` | -1.01, -4.43, -3.95 |
| 195 | star | multipart | `Xeteyu-0DXKNPVY83J9` | -0.82, -2.05, -7.13 |
| 196 | star | survey | `TRN-A4EAA2K574KBZRO` | -2.45, -4.36, -1.65 |
| 197 | nav | multipart | `Zobafi-0HKDER56679O` | 0.42, -3.61, -0.64 |
| 198 | nav | multipart | `Lewivo-0IAHZJSQCNJI` | 0.52, -2.39, 0.65 |
| 199 | feat | multipart | `Ganima-0EE4NGE8GVRB` | 1.88, -4.12, -6.31 |

