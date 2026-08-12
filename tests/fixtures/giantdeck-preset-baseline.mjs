// tests/fixtures/giantdeck-preset-baseline.mjs — GENERATED, DO NOT HAND-EDIT.
//
// The gas-deck law AS THE LAB RAN IT BEFORE the giantDeck pack existed. PLAN §4 Step 5's first gate
// is "pack+writer output equals a fixture captured from the lab BEFORE the change, max delta exactly 0".
//
// ⭐ HOW IT WAS CAPTURED, so the number below is re-derivable rather than asserted. The capture script
// does NOT re-type the lab's law. It slices the two live regions out of a PINNED git blob of
// planet-lod-lab.html — the F24/F25 derivation block (`const _gas = …` through
// `state.jetFestoon = 0.45 * _vigor;`) and the whole body of `function rebakeE5Bands(){` — and runs
// them with `new Function` against the real modules. So this is the lab's own output.
//
//   node scratchpad/capture-giantdeck-baseline.mjs 4e864bc > tests/fixtures/giantdeck-preset-baseline.mjs
//
// captured from: planet-lod-lab.html @ 4e864bc604f6b521b1238e06add086c3ad2d16d2
//
// ⚠ ROWS ARE KEYED BY CONDITION, NOT BY PRESET NAME. Every row records the exact (preset, macroSeed,
// radiusEarth, rotationHours) it was produced from, and the test rebuilds the SAME condition vector
// from them before calling the pack. PLAN §4 Step 5: "Measure on the same CONDITION object, not the
// same preset name — the two routes differ by 3-6x on T_eq for the same nominal body, and a
// preset-to-preset comparison produces a false red that looks exactly like a broken extraction."
//
// ⚠ `aStorm` IS ABSENT ON PURPOSE, not forgotten. Its producer is the storm slice, which PLAN §7
// fences out of pack #1; the capture stubs `bakeStormEAttributes` to a zero array so nothing here
// can be read as a claim about it.
//
// Attribute rows carry an FNV-1a hash over the IEEE-754 bit pattern of EVERY element (any bit moves
// it) plus 8 full-precision samples at fixed indices, so a failure reports a NUMBER and not just
// "the hash differs". The mesh is the deterministic Fibonacci sphere below — the same one the test
// builds — at object-space radius 1.0, which is the lab's own `const R = 1.0;`.
export const MESH_N = 512;
export const MESH_RADIUS = 1.0;
export const SAMPLE_IDX = [0,1,7,63,127,255,383,511];
export const CAPTURED_FROM = '4e864bc604f6b521b1238e06add086c3ad2d16d2';

// The exact mesh the capture baked over. Kept as CODE, not as 1536 floats: a Float32Array written out
// as decimal literals does not round-trip, and a fixture that is 0.5 ULP off its own mesh turns a
// byte-identity gate into a tolerance gate without anyone deciding to.
export function fibonacciSphere(n, radius = 1.0) {
  const a = new Float32Array(n * 3);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    a[i * 3] = Math.cos(th) * r * radius;
    a[i * 3 + 1] = y * radius;
    a[i * 3 + 2] = Math.sin(th) * r * radius;
  }
  return a;
}

export const BASELINE = [
  {
    "preset": "Gas giant (Jovian)",
    "macroSeed": 1,
    "radiusEarth": 11.2,
    "rotationHours": 9.9,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.9882785185185186,
      "bandWarp": 0.5445214814814815,
      "bandTint": [
        0.78,
        0.62,
        0.44
      ],
      "jetStrength": 1,
      "jetSpeed": 0.8080808080808081,
      "jetShearTurb": 0.2968148148148148,
      "jetFestoon": 0.4442666666666667,
      "bandRough": 0.7563578356057405,
      "e5BandCount": 11,
      "e5EqSign": 1,
      "e5PeakU": 1.3599806201989584
    },
    "uniforms": {
      "uBandM": 13,
      "uBandPhaseJet": 5.128836847429935,
      "uBandSEq": 0.9920202697020117,
      "uBandAMid": 0.5376698451116682,
      "uBandS2": -0.6220261950589634,
      "uBandDeflectScale": 0.3932524992791899
    },
    "attributes": {
      "aBand": {
        "hash": 1742005727,
        "sample": [
          0.54296875,
          0.42801332473754883,
          0.4441830813884735,
          0.41518688201904297,
          0.41303756833076477,
          0.734053909778595,
          0.3255269229412079,
          0.45703125
        ]
      },
      "aShear": {
        "hash": 3337208294,
        "sample": [
          0.46203574538230896,
          0.38625532388687134,
          0.464167058467865,
          0.6972362995147705,
          0.7038805484771729,
          0.005509185139089823,
          0.021455856040120125,
          0.46203574538230896
        ]
      },
      "aMush": {
        "hash": 3881294767,
        "sample": [
          0.4181087613105774,
          0.23574207723140717,
          0.1664394736289978,
          0.7990102767944336,
          0.16680996119976044,
          0.8413747549057007,
          0.24435226619243622,
          0.5818912386894226
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Jovian)",
    "macroSeed": 7,
    "radiusEarth": 11.2,
    "rotationHours": 9.9,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.9882785185185186,
      "bandWarp": 0.5445214814814815,
      "bandTint": [
        0.78,
        0.62,
        0.44
      ],
      "jetStrength": 1,
      "jetSpeed": 0.8080808080808081,
      "jetShearTurb": 0.2968148148148148,
      "jetFestoon": 0.4442666666666667,
      "bandRough": 1.173453753441572,
      "e5BandCount": 11,
      "e5EqSign": 1,
      "e5PeakU": 1.4530376170406787
    },
    "uniforms": {
      "uBandM": 13,
      "uBandPhaseJet": 3.1102384029194,
      "uBandSEq": 0.9919288811818993,
      "uBandAMid": 0.4618172793649137,
      "uBandS2": -0.6193648234952722,
      "uBandDeflectScale": 0.4250867024329375
    },
    "attributes": {
      "aBand": {
        "hash": 1929101400,
        "sample": [
          0.4010074734687805,
          0.4620145857334137,
          0.6067330837249756,
          0.6620170474052429,
          0.4309180974960327,
          0.7529855966567993,
          0.6229956746101379,
          0.5989925265312195
        ]
      },
      "aShear": {
        "hash": 2803483497,
        "sample": [
          0.015154820866882801,
          0.44881367683410645,
          0.05611675977706909,
          0.10684173554182053,
          0.8808706998825073,
          0.0030548344366252422,
          0.7071655988693237,
          0.015154818072915077
        ]
      },
      "aMush": {
        "hash": 234084942,
        "sample": [
          0.7645540833473206,
          0.8484452366828918,
          0.7096556425094604,
          0.36260324716567993,
          0.8333560824394226,
          0.26724448800086975,
          0.5688905715942383,
          0.23544591665267944
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Jovian)",
    "macroSeed": 4242,
    "radiusEarth": 11.2,
    "rotationHours": 9.9,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.9882785185185186,
      "bandWarp": 0.5445214814814815,
      "bandTint": [
        0.78,
        0.62,
        0.44
      ],
      "jetStrength": 1,
      "jetSpeed": 0.8080808080808081,
      "jetShearTurb": 0.2968148148148148,
      "jetFestoon": 0.4442666666666667,
      "bandRough": 0.755275335535407,
      "e5BandCount": 9,
      "e5EqSign": 1,
      "e5PeakU": 1.452992079262069
    },
    "uniforms": {
      "uBandM": 13,
      "uBandPhaseJet": 1.8843355565623332,
      "uBandSEq": 0.9920202697020117,
      "uBandAMid": 0.4863055681809783,
      "uBandS2": -0.623524049460406,
      "uBandDeflectScale": 0.4140461495949918
    },
    "attributes": {
      "aBand": {
        "hash": 145039242,
        "sample": [
          0.46887531876564026,
          0.5758172273635864,
          0.5429773926734924,
          0.566705048084259,
          0.6472678184509277,
          0.7464450001716614,
          0.7139098048210144,
          0.5311247110366821
        ]
      },
      "aShear": {
        "hash": 997324812,
        "sample": [
          0.46895575523376465,
          0.34140416979789734,
          0.4795617461204529,
          0.7171364426612854,
          0.7863431572914124,
          0.00012311110913287848,
          0.23659448325634003,
          0.46895575523376465
        ]
      },
      "aMush": {
        "hash": 2327836674,
        "sample": [
          0.4837256669998169,
          0.28374314308166504,
          0.15243631601333618,
          0.8279426693916321,
          0.1929861307144165,
          0.8498115539550781,
          0.20387180149555206,
          0.5162743330001831
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Jovian)",
    "macroSeed": 7,
    "radiusEarth": 7.839999999999999,
    "rotationHours": 12.870000000000001,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.9882785185185186,
      "bandWarp": 0.5445214814814815,
      "bandTint": [
        0.78,
        0.62,
        0.44
      ],
      "jetStrength": 1,
      "jetSpeed": 0.6216006216006216,
      "jetShearTurb": 0.2968148148148148,
      "jetFestoon": 0.4442666666666667,
      "bandRough": 1.173453753441572,
      "e5BandCount": 7,
      "e5EqSign": 1,
      "e5PeakU": 1.4530376170406787
    },
    "uniforms": {
      "uBandM": 9,
      "uBandPhaseJet": 3.1102384029194,
      "uBandSEq": 0.9919288811818993,
      "uBandAMid": 0.4618172793649137,
      "uBandS2": -0.6193648234952722,
      "uBandDeflectScale": 0.4250867024329375
    },
    "attributes": {
      "aBand": {
        "hash": 3990296293,
        "sample": [
          0.4010074734687805,
          0.4322340786457062,
          0.5578935146331787,
          0.34238508343696594,
          0.7126991748809814,
          0.7529856562614441,
          0.34114524722099304,
          0.5989925265312195
        ]
      },
      "aShear": {
        "hash": 1317686240,
        "sample": [
          0.014500838704407215,
          0.33557894825935364,
          0.4383961856365204,
          0.08907070755958557,
          0.07908868044614792,
          0.004174436442553997,
          0.14321404695510864,
          0.014500834047794342
        ]
      },
      "aMush": {
        "hash": 2959676449,
        "sample": [
          0.23544591665267944,
          0.16280171275138855,
          0.18627050518989563,
          0.8375334739685059,
          0.5719959735870361,
          0.2682693302631378,
          0.8313709497451782,
          0.7645540833473206
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Saturnian)",
    "macroSeed": 1,
    "radiusEarth": 9.4,
    "rotationHours": 10.7,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.5859318518518518,
      "bandWarp": 0.35646814814814815,
      "bandTint": [
        0.85,
        0.76,
        0.55
      ],
      "jetStrength": 1,
      "jetSpeed": 0.7476635514018692,
      "jetShearTurb": 0.18748148148148147,
      "jetFestoon": 0.24746666666666667,
      "bandRough": 1.2762355715036393,
      "e5BandCount": 10,
      "e5EqSign": 1,
      "e5PeakU": 1.6585183418547516
    },
    "uniforms": {
      "uBandM": 10,
      "uBandPhaseJet": 1.1103222034793607,
      "uBandSEq": 0.9910074536781176,
      "uBandAMid": 0.5183289540465921,
      "uBandS2": -0.442954029477471,
      "uBandDeflectScale": 0.41316600968844075
    },
    "attributes": {
      "aBand": {
        "hash": 3742750984,
        "sample": [
          0.3761346936225891,
          0.4689144194126129,
          0.6363946795463562,
          0.4601854383945465,
          0.5448509454727173,
          0.7456697821617126,
          0.6914645433425903,
          0.3761346936225891
        ]
      },
      "aShear": {
        "hash": 952415523,
        "sample": [
          0.30336299538612366,
          0.6674945950508118,
          0.2583778500556946,
          0.894524097442627,
          0.8808104395866394,
          0.00026228962815366685,
          0.49158915877342224,
          0.30336296558380127
        ]
      },
      "aMush": {
        "hash": 370849823,
        "sample": [
          0.5113525986671448,
          0.3604624271392822,
          0.18188205361366272,
          0.6406911611557007,
          0.8113815784454346,
          0.15031199157238007,
          0.7962250709533691,
          0.48864737153053284
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Saturnian)",
    "macroSeed": 7,
    "radiusEarth": 9.4,
    "rotationHours": 10.7,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.5859318518518518,
      "bandWarp": 0.35646814814814815,
      "bandTint": [
        0.85,
        0.76,
        0.55
      ],
      "jetStrength": 1,
      "jetSpeed": 0.7476635514018692,
      "jetShearTurb": 0.18748148148148147,
      "jetFestoon": 0.24746666666666667,
      "bandRough": 0.8244516994804144,
      "e5BandCount": 9,
      "e5EqSign": 1,
      "e5PeakU": 1.5888420069370701
    },
    "uniforms": {
      "uBandM": 11,
      "uBandPhaseJet": 4.163051372965494,
      "uBandSEq": 0.9972829600991421,
      "uBandAMid": 0.45239715443458406,
      "uBandS2": -0.4261806007685237,
      "uBandDeflectScale": 0.44266657316907043
    },
    "attributes": {
      "aBand": {
        "hash": 1188577779,
        "sample": [
          0.5689113736152649,
          0.6326308846473694,
          0.5015724301338196,
          0.6469399929046631,
          0.43213027715682983,
          0.7648636698722839,
          0.3421483635902405,
          0.4310886263847351
        ]
      },
      "aShear": {
        "hash": 2093151521,
        "sample": [
          0.5369358062744141,
          0.0381513275206089,
          0.6556912660598755,
          0.42698875069618225,
          0.8926781415939331,
          0.006492852699011564,
          0.142634317278862,
          0.5369358062744141
        ]
      },
      "aMush": {
        "hash": 2041270054,
        "sample": [
          0.234746515750885,
          0.15563827753067017,
          0.23162145912647247,
          0.8147141933441162,
          0.23944956064224243,
          0.7625541090965271,
          0.2363000363111496,
          0.234746515750885
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Saturnian)",
    "macroSeed": 4242,
    "radiusEarth": 9.4,
    "rotationHours": 10.7,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.5859318518518518,
      "bandWarp": 0.35646814814814815,
      "bandTint": [
        0.85,
        0.76,
        0.55
      ],
      "jetStrength": 1,
      "jetSpeed": 0.7476635514018692,
      "jetShearTurb": 0.18748148148148147,
      "jetFestoon": 0.24746666666666667,
      "bandRough": 0.9996933080255985,
      "e5BandCount": 8,
      "e5EqSign": 1,
      "e5PeakU": 1.6719034938099828
    },
    "uniforms": {
      "uBandM": 10,
      "uBandPhaseJet": 4.532159898537151,
      "uBandSEq": 0.9910074536781176,
      "uBandAMid": 0.5175935771781951,
      "uBandS2": -0.41172190493953753,
      "uBandDeflectScale": 0.4156844657226144
    },
    "attributes": {
      "aBand": {
        "hash": 1604113950,
        "sample": [
          0.6419510841369629,
          0.5702770948410034,
          0.3774711787700653,
          0.591342031955719,
          0.45173484086990356,
          0.7471523880958557,
          0.39893659949302673,
          0.6419510841369629
        ]
      },
      "aShear": {
        "hash": 2172068707,
        "sample": [
          0.11562755703926086,
          0.5635568499565125,
          0.40461990237236023,
          0.7201088070869446,
          0.9510977864265442,
          0.007068959064781666,
          0.8249357342720032,
          0.11562756448984146
        ]
      },
      "aMush": {
        "hash": 387280902,
        "sample": [
          0.7296203970909119,
          0.8206151723861694,
          0.8324641585350037,
          0.17888203263282776,
          0.3804534673690796,
          0.7663826942443848,
          0.15605874359607697,
          0.27037960290908813
        ]
      }
    }
  },
  {
    "preset": "Gas giant (Saturnian)",
    "macroSeed": 7,
    "radiusEarth": 6.58,
    "rotationHours": 13.91,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.5859318518518518,
      "bandWarp": 0.35646814814814815,
      "bandTint": [
        0.85,
        0.76,
        0.55
      ],
      "jetStrength": 1,
      "jetSpeed": 0.5751258087706685,
      "jetShearTurb": 0.18748148148148147,
      "jetFestoon": 0.24746666666666667,
      "bandRough": 0.8244516994804144,
      "e5BandCount": 6,
      "e5EqSign": 1,
      "e5PeakU": 1.5888420069370701
    },
    "uniforms": {
      "uBandM": 8,
      "uBandPhaseJet": 4.163051372965494,
      "uBandSEq": 0.9972829600991421,
      "uBandAMid": 0.45239715443458406,
      "uBandS2": -0.4261806007685237,
      "uBandDeflectScale": 0.44266657316907043
    },
    "attributes": {
      "aBand": {
        "hash": 561097826,
        "sample": [
          0.3874354362487793,
          0.4590597152709961,
          0.6038126349449158,
          0.324897825717926,
          0.689166247844696,
          0.7648637294769287,
          0.5254154205322266,
          0.3874354362487793
        ]
      },
      "aShear": {
        "hash": 252716499,
        "sample": [
          0.3175472021102905,
          0.5788601040840149,
          0.43573883175849915,
          0.04375694319605827,
          0.5148041844367981,
          0.00860549509525299,
          1,
          0.3175472021102905
        ]
      },
      "aMush": {
        "hash": 420012557,
        "sample": [
          0.765253484249115,
          0.8279635310173035,
          0.840964138507843,
          0.30567798018455505,
          0.16808466613292694,
          0.7634579539299011,
          0.5666772127151489,
          0.765253484249115
        ]
      }
    }
  },
  {
    "preset": "Ice giant (Neptunian)",
    "macroSeed": 1,
    "radiusEarth": 3.9,
    "rotationHours": 16.1,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.08,
      "bandWarp": 0.12,
      "bandTint": [
        0.35,
        0.48,
        0.85
      ],
      "jetStrength": 1,
      "jetSpeed": 0.49689440993788814,
      "jetShearTurb": 0.05,
      "jetFestoon": 0,
      "bandRough": 1.292501082830131,
      "e5BandCount": 3,
      "e5EqSign": -1,
      "e5PeakU": 7.895203005215239
    },
    "uniforms": {
      "uBandM": 3,
      "uBandPhaseJet": 0.3948942107575176,
      "uBandSEq": -0.9026730742686664,
      "uBandAMid": 0.5452487831469626,
      "uBandS2": -0.43126637042421173,
      "uBandDeflectScale": 0.3671404404300252
    },
    "attributes": {
      "aBand": {
        "hash": 3454395171,
        "sample": [
          0.37897396087646484,
          0.3691761791706085,
          0.36975765228271484,
          0.5320845246315002,
          0.6511785387992859,
          0.3011644184589386,
          0.3067585825920105,
          0.6210260391235352
        ]
      },
      "aShear": {
        "hash": 2633058365,
        "sample": [
          0.13852714002132416,
          0.06330515444278717,
          0.07331110537052155,
          0.48309823870658875,
          0.04845179617404938,
          0.008512211963534355,
          0.12580955028533936,
          0.13852715492248535
        ]
      },
      "aMush": {
        "hash": 2066177180,
        "sample": [
          0.8480585813522339,
          0.8455221056938171,
          0.7891668081283569,
          0.33948004245758057,
          0.15233416855335236,
          0.4611436426639557,
          0.8479318022727966,
          0.1519414484500885
        ]
      }
    }
  },
  {
    "preset": "Ice giant (Neptunian)",
    "macroSeed": 7,
    "radiusEarth": 3.9,
    "rotationHours": 16.1,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.08,
      "bandWarp": 0.12,
      "bandTint": [
        0.35,
        0.48,
        0.85
      ],
      "jetStrength": 1,
      "jetSpeed": 0.49689440993788814,
      "jetShearTurb": 0.05,
      "jetFestoon": 0,
      "bandRough": 0.6470139598473906,
      "e5BandCount": 3,
      "e5EqSign": -1,
      "e5PeakU": 7.796047333290427
    },
    "uniforms": {
      "uBandM": 3,
      "uBandPhaseJet": 0.501603381931389,
      "uBandSEq": -0.8851912999724251,
      "uBandAMid": 0.524986435729079,
      "uBandS2": -0.43569209420644633,
      "uBandDeflectScale": 0.3740301690853978
    },
    "attributes": {
      "aBand": {
        "hash": 272823028,
        "sample": [
          0.3878394365310669,
          0.37485024333000183,
          0.3692537546157837,
          0.5132508277893066,
          0.6393304467201233,
          0.3013567626476288,
          0.3185032308101654,
          0.6121605634689331
        ]
      },
      "aShear": {
        "hash": 1158858802,
        "sample": [
          0.1717223972082138,
          0.10041666775941849,
          0.03252856060862541,
          0.47859370708465576,
          0.0028822775930166245,
          0.009255890734493732,
          0.1661253720521927,
          0.1717223972082138
        ]
      },
      "aMush": {
        "hash": 887701320,
        "sample": [
          0.16673532128334045,
          0.20647276937961578,
          0.31513911485671997,
          0.7724843621253967,
          0.8343358039855957,
          0.39502543210983276,
          0.16637490689754486,
          0.8332647085189819
        ]
      }
    }
  },
  {
    "preset": "Ice giant (Neptunian)",
    "macroSeed": 4242,
    "radiusEarth": 3.9,
    "rotationHours": 16.1,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.08,
      "bandWarp": 0.12,
      "bandTint": [
        0.35,
        0.48,
        0.85
      ],
      "jetStrength": 1,
      "jetSpeed": 0.49689440993788814,
      "jetShearTurb": 0.05,
      "jetFestoon": 0,
      "bandRough": 1.222912622615695,
      "e5BandCount": 2,
      "e5EqSign": -1,
      "e5PeakU": 7.965982676943826
    },
    "uniforms": {
      "uBandM": 2,
      "uBandPhaseJet": 2.562251870566475,
      "uBandSEq": -0.9346027805220587,
      "uBandAMid": 0.4824924917658791,
      "uBandS2": -0.4392692934164443,
      "uBandDeflectScale": 0.38979836972991894
    },
    "attributes": {
      "aBand": {
        "hash": 3960804600,
        "sample": [
          0.43321800231933594,
          0.41575565934181213,
          0.38963207602500916,
          0.35092893242836,
          0.3970390260219574,
          0.2814266085624695,
          0.6514832377433777,
          0.43321800231933594
        ]
      },
      "aShear": {
        "hash": 1285490962,
        "sample": [
          0.19154974818229675,
          0.1787879317998886,
          0.155648872256279,
          0.04701085761189461,
          0.15229114890098572,
          0.010148614645004272,
          0.26824021339416504,
          0.19154973328113556
        ]
      },
      "aMush": {
        "hash": 3505229802,
        "sample": [
          0.3468795716762543,
          0.43483054637908936,
          0.5869502425193787,
          0.8470907211303711,
          0.6563159227371216,
          0.18617568910121918,
          0.3458140194416046,
          0.6531203985214233
        ]
      }
    }
  },
  {
    "preset": "Ice giant (Neptunian)",
    "macroSeed": 7,
    "radiusEarth": 2.73,
    "rotationHours": 20.930000000000003,
    "state": {
      "bandStrength": 1,
      "bandContrast": 0.08,
      "bandWarp": 0.12,
      "bandTint": [
        0.35,
        0.48,
        0.85
      ],
      "jetStrength": 1,
      "jetSpeed": 0.38222646918299086,
      "jetShearTurb": 0.05,
      "jetFestoon": 0,
      "bandRough": 0.6470139598473906,
      "e5BandCount": 2,
      "e5EqSign": -1,
      "e5PeakU": 7.796047333290427
    },
    "uniforms": {
      "uBandM": 2,
      "uBandPhaseJet": 0.501603381931389,
      "uBandSEq": -0.8851912999724251,
      "uBandAMid": 0.524986435729079,
      "uBandS2": -0.43569209420644633,
      "uBandDeflectScale": 0.3740301690853978
    },
    "attributes": {
      "aBand": {
        "hash": 868016173,
        "sample": [
          0.43849268555641174,
          0.45894762873649597,
          0.4956812560558319,
          0.6375963091850281,
          0.6628093719482422,
          0.3013567626476288,
          0.38402777910232544,
          0.43849268555641174
        ]
      },
      "aShear": {
        "hash": 1831834474,
        "sample": [
          0.21714374423027039,
          0.23060950636863708,
          0.2568013668060303,
          0.26497623324394226,
          0.2759395241737366,
          0.009609275497496128,
          0.18110311031341553,
          0.21714375913143158
        ]
      },
      "aMush": {
        "hash": 887701320,
        "sample": [
          0.16673532128334045,
          0.20647276937961578,
          0.31513911485671997,
          0.7724843621253967,
          0.8343358039855957,
          0.39502543210983276,
          0.16637490689754486,
          0.8332647085189819
        ]
      }
    }
  },
  {
    "preset": "Sub-Neptune (hazy)",
    "macroSeed": 1,
    "radiusEarth": 2.7,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.72,
        0.66,
        0.58
      ],
      "jetStrength": 1,
      "jetSpeed": 0.3333333333333333,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 1.332704459875822,
      "e5BandCount": 5,
      "e5EqSign": -1,
      "e5PeakU": 2.386673056422004
    },
    "uniforms": {
      "uBandM": 3,
      "uBandPhaseJet": 1.9077793000826375,
      "uBandSEq": -0.17905884306385111,
      "uBandAMid": 0.5048248762032017,
      "uBandS2": -0.5114581704477565,
      "uBandDeflectScale": 0.15313256256926308
    },
    "attributes": {
      "aBand": {
        "hash": 25960950,
        "sample": [
          0.5151018500328064,
          0.5032881498336792,
          0.48269668221473694,
          0.4359115660190582,
          0.4735557734966278,
          0.48355141282081604,
          0.522447407245636,
          0.4848981499671936
        ]
      },
      "aShear": {
        "hash": 2697105035,
        "sample": [
          0.5796442031860352,
          0.6149176955223083,
          0.6399977803230286,
          0.019113777205348015,
          0.9076177477836609,
          0.014902254566550255,
          0.7948610782623291,
          0.5796442031860352
        ]
      },
      "aMush": {
        "hash": 3463799103,
        "sample": [
          0.1999857872724533,
          0.2577976584434509,
          0.38793838024139404,
          0.8154682517051697,
          0.8018333911895752,
          0.32151052355766296,
          0.19937673211097717,
          0.8000141978263855
        ]
      }
    }
  },
  {
    "preset": "Sub-Neptune (hazy)",
    "macroSeed": 7,
    "radiusEarth": 2.7,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.72,
        0.66,
        0.58
      ],
      "jetStrength": 1,
      "jetSpeed": 0.3333333333333333,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 0.9986670061945915,
      "e5BandCount": 3,
      "e5EqSign": -1,
      "e5PeakU": 2.2013776614257523
    },
    "uniforms": {
      "uBandM": 3,
      "uBandPhaseJet": 0.2340588305412107,
      "uBandSEq": -0.0936274349613139,
      "uBandAMid": 0.4785700304433703,
      "uBandS2": -0.4961135062381697,
      "uBandDeflectScale": 0.157642680848769
    },
    "attributes": {
      "aBand": {
        "hash": 123590975,
        "sample": [
          0.4557402431964874,
          0.45417138934135437,
          0.45726487040519714,
          0.5220432281494141,
          0.5678421258926392,
          0.49114513397216797,
          0.4303334355354309,
          0.5442597270011902
        ]
      },
      "aShear": {
        "hash": 2927658140,
        "sample": [
          0.12420628219842911,
          0.014042091555893421,
          0.18432697653770447,
          0.7713718414306641,
          0.03567732125520706,
          0.0038355085998773575,
          0.3092026114463806,
          0.1242062970995903
        ]
      },
      "aMush": {
        "hash": 65659505,
        "sample": [
          0.6425864100456238,
          0.7214639186859131,
          0.8155600428581238,
          0.6886868476867676,
          0.3606743812561035,
          0.1795293688774109,
          0.6415024995803833,
          0.3574135899543762
        ]
      }
    }
  },
  {
    "preset": "Sub-Neptune (hazy)",
    "macroSeed": 4242,
    "radiusEarth": 2.7,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.72,
        0.66,
        0.58
      ],
      "jetStrength": 1,
      "jetSpeed": 0.3333333333333333,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 1.3148723646998406,
      "e5BandCount": 5,
      "e5EqSign": -1,
      "e5PeakU": 2.309643977761517
    },
    "uniforms": {
      "uBandM": 3,
      "uBandPhaseJet": 1.716223001542486,
      "uBandSEq": -0.04900676987862405,
      "uBandAMid": 0.4560989724937826,
      "uBandS2": -0.5145895808034467,
      "uBandDeflectScale": 0.16087229527368443
    },
    "attributes": {
      "aBand": {
        "hash": 2780985237,
        "sample": [
          0.5062556266784668,
          0.4947862923145294,
          0.47582972049713135,
          0.44326135516166687,
          0.48881077766418457,
          0.49527257680892944,
          0.5097030401229858,
          0.4937443435192108
        ]
      },
      "aShear": {
        "hash": 1572396643,
        "sample": [
          0.6174546480178833,
          0.6292336583137512,
          0.6115744113922119,
          0.19611071050167084,
          0.9905264973640442,
          0.014187930151820183,
          0.9381012320518494,
          0.6174546480178833
        ]
      },
      "aMush": {
        "hash": 277595421,
        "sample": [
          0.8171547055244446,
          0.8448845744132996,
          0.8375827074050903,
          0.44938012957572937,
          0.18436841666698456,
          0.35011059045791626,
          0.8166512846946716,
          0.18284527957439423
        ]
      }
    }
  },
  {
    "preset": "Sub-Neptune (hazy)",
    "macroSeed": 7,
    "radiusEarth": 1.89,
    "rotationHours": 31.200000000000003,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.72,
        0.66,
        0.58
      ],
      "jetStrength": 1,
      "jetSpeed": 0.2564102564102564,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 0.9986670061945915,
      "e5BandCount": 2,
      "e5EqSign": -1,
      "e5PeakU": 2.2013776614257523
    },
    "uniforms": {
      "uBandM": 2,
      "uBandPhaseJet": 0.2340588305412107,
      "uBandSEq": -0.0936274349613139,
      "uBandAMid": 0.4785700304433703,
      "uBandS2": -0.4961135062381697,
      "uBandDeflectScale": 0.157642680848769
    },
    "attributes": {
      "aBand": {
        "hash": 2320935968,
        "sample": [
          0.4894472062587738,
          0.49738553166389465,
          0.5111680626869202,
          0.5603491067886353,
          0.5671312808990479,
          0.49114513397216797,
          0.44779884815216064,
          0.4894472062587738
        ]
      },
      "aShear": {
        "hash": 813543242,
        "sample": [
          0.39874395728111267,
          0.41037896275520325,
          0.44122114777565,
          0.3858140707015991,
          0.3671218454837799,
          0.004366661421954632,
          0.5266017913818359,
          0.39874395728111267
        ]
      },
      "aMush": {
        "hash": 65659505,
        "sample": [
          0.6425864100456238,
          0.7214639186859131,
          0.8155600428581238,
          0.6886868476867676,
          0.3606743812561035,
          0.1795293688774109,
          0.6415024995803833,
          0.3574135899543762
        ]
      }
    }
  },
  {
    "preset": "Hot Jupiter (locked giant)",
    "macroSeed": 1,
    "radiusEarth": 13,
    "rotationHours": 80,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.55,
        0.38,
        0.28
      ],
      "jetStrength": 1,
      "jetSpeed": 0.2,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 1.1855825044214725,
      "e5BandCount": 5,
      "e5EqSign": 1,
      "e5PeakU": 1.6214862883562606
    },
    "uniforms": {
      "uBandM": 5,
      "uBandPhaseJet": 2.5051924478696317,
      "uBandSEq": 0.9836748576936802,
      "uBandAMid": 0.4799487867159769,
      "uBandS2": -0.6204070522200618,
      "uBandDeflectScale": 0.4169953175267737
    },
    "attributes": {
      "aBand": {
        "hash": 1079119837,
        "sample": [
          0.41892969608306885,
          0.45184245705604553,
          0.5257384777069092,
          0.5779502987861633,
          0.35249537229537964,
          0.7461095452308655,
          0.506209671497345,
          0.5810703039169312
        ]
      },
      "aShear": {
        "hash": 583786702,
        "sample": [
          0.217986062169075,
          0.3180239796638489,
          0.39645662903785706,
          0.47479623556137085,
          0.07901343703269958,
          0.0023394101299345493,
          0.8574338555335999,
          0.217986062169075
        ]
      },
      "aMush": {
        "hash": 3373858603,
        "sample": [
          0.16924092173576355,
          0.1507996916770935,
          0.17377890646457672,
          0.5861522555351257,
          0.8295770287513733,
          0.6163882613182068,
          0.16963061690330505,
          0.8307590484619141
        ]
      }
    }
  },
  {
    "preset": "Hot Jupiter (locked giant)",
    "macroSeed": 7,
    "radiusEarth": 13,
    "rotationHours": 80,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.55,
        0.38,
        0.28
      ],
      "jetStrength": 1,
      "jetSpeed": 0.2,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 1.2438840072602033,
      "e5BandCount": 5,
      "e5EqSign": 1,
      "e5PeakU": 1.3529784423905666
    },
    "uniforms": {
      "uBandM": 5,
      "uBandPhaseJet": 1.847354618672118,
      "uBandSEq": 0.9950547536867305,
      "uBandAMid": 0.4653639651602134,
      "uBandS2": -0.6174640644789605,
      "uBandDeflectScale": 0.42362033253566395
    },
    "attributes": {
      "aBand": {
        "hash": 764165257,
        "sample": [
          0.4727616310119629,
          0.5166682600975037,
          0.5840945243835449,
          0.4732452929019928,
          0.34390124678611755,
          0.7529147267341614,
          0.3978103697299957,
          0.5272383689880371
        ]
      },
      "aShear": {
        "hash": 2546625372,
        "sample": [
          0.35124433040618896,
          0.36733168363571167,
          0.2837603986263275,
          0.5965014696121216,
          0.37291252613067627,
          0.0004078160272911191,
          0.7039582133293152,
          0.35124433040618896
        ]
      },
      "aMush": {
        "hash": 3770575794,
        "sample": [
          0.3398543894290924,
          0.26380327343940735,
          0.1765069216489792,
          0.3280026316642761,
          0.6569696664810181,
          0.8121475577354431,
          0.34090983867645264,
          0.6601455807685852
        ]
      }
    }
  },
  {
    "preset": "Hot Jupiter (locked giant)",
    "macroSeed": 4242,
    "radiusEarth": 13,
    "rotationHours": 80,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.55,
        0.38,
        0.28
      ],
      "jetStrength": 1,
      "jetSpeed": 0.2,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 1.116389448195696,
      "e5BandCount": 3,
      "e5EqSign": 1,
      "e5PeakU": 1.4317782372229881
    },
    "uniforms": {
      "uBandM": 5,
      "uBandPhaseJet": 4.474743575031099,
      "uBandSEq": 0.9950547536867305,
      "uBandAMid": 0.47406737762503326,
      "uBandS2": -0.6194067457428614,
      "uBandDeflectScale": 0.4196308021752864
    },
    "attributes": {
      "aBand": {
        "hash": 2094009222,
        "sample": [
          0.4763745367527008,
          0.43615713715553284,
          0.39303696155548096,
          0.6041666269302368,
          0.6649648547172546,
          0.7505179643630981,
          0.707651674747467,
          0.5236254930496216
        ]
      },
      "aShear": {
        "hash": 1738599508,
        "sample": [
          0.5747596621513367,
          0.4843718111515045,
          0.17954519391059875,
          0.863616943359375,
          0.5542057752609253,
          0.018548764288425446,
          0.13871075212955475,
          0.5747596621513367
        ]
      },
      "aMush": {
        "hash": 1985362667,
        "sample": [
          0.5915689468383789,
          0.6770020723342896,
          0.7884260416030884,
          0.731904149055481,
          0.4118741452693939,
          0.16165892779827118,
          0.5904237627983093,
          0.4084310531616211
        ]
      }
    }
  },
  {
    "preset": "Hot Jupiter (locked giant)",
    "macroSeed": 7,
    "radiusEarth": 9.1,
    "rotationHours": 104,
    "state": {
      "bandStrength": 1,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0.55,
        0.38,
        0.28
      ],
      "jetStrength": 1,
      "jetSpeed": 0.2,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45,
      "bandRough": 1.2438840072602033,
      "e5BandCount": 4,
      "e5EqSign": 1,
      "e5PeakU": 1.3529784423905666
    },
    "uniforms": {
      "uBandM": 4,
      "uBandPhaseJet": 1.847354618672118,
      "uBandSEq": 0.9950547536867305,
      "uBandAMid": 0.4653639651602134,
      "uBandS2": -0.6174640644789605,
      "uBandDeflectScale": 0.42362033253566395
    },
    "attributes": {
      "aBand": {
        "hash": 3582225659,
        "sample": [
          0.595966637134552,
          0.6005959510803223,
          0.5849169492721558,
          0.3619714379310608,
          0.3901107609272003,
          0.7529147267341614,
          0.4823572337627411,
          0.595966637134552
        ]
      },
      "aShear": {
        "hash": 3020646824,
        "sample": [
          0.09289742261171341,
          0.004762616939842701,
          0.1812349557876587,
          0.3815377950668335,
          0.6756669878959656,
          0.000469426391646266,
          0.8331943154335022,
          0.09289740771055222
        ]
      },
      "aMush": {
        "hash": 3770575794,
        "sample": [
          0.3398543894290924,
          0.26380327343940735,
          0.1765069216489792,
          0.3280026316642761,
          0.6569696664810181,
          0.8121475577354431,
          0.34090983867645264,
          0.6601455807685852
        ]
      }
    }
  },
  {
    "preset": "Rocky (Earthlike)",
    "macroSeed": 7,
    "radiusEarth": 1,
    "state": {
      "bandStrength": 0,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0,
        0,
        0
      ],
      "jetStrength": 0,
      "jetSpeed": 0.3333333333333333,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45
    },
    "uniforms": {
      "uBandM": null,
      "uBandPhaseJet": null,
      "uBandSEq": null,
      "uBandAMid": null,
      "uBandS2": null,
      "uBandDeflectScale": null
    },
    "attributes": {
      "aBand": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aShear": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aMush": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    }
  },
  {
    "preset": "Lava (hot airless)",
    "macroSeed": 7,
    "radiusEarth": 0.9,
    "state": {
      "bandStrength": 0,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0,
        0,
        0
      ],
      "jetStrength": 0,
      "jetSpeed": 0.3333333333333333,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45
    },
    "uniforms": {
      "uBandM": null,
      "uBandPhaseJet": null,
      "uBandSEq": null,
      "uBandAMid": null,
      "uBandS2": null,
      "uBandDeflectScale": null
    },
    "attributes": {
      "aBand": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aShear": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aMush": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    }
  },
  {
    "preset": "Frozen (airless)",
    "macroSeed": 7,
    "radiusEarth": 0.5,
    "state": {
      "bandStrength": 0,
      "bandContrast": 0.09172148148148149,
      "bandWarp": 0.12547851851851852,
      "bandTint": [
        0,
        0,
        0
      ],
      "jetStrength": 0,
      "jetSpeed": 0.3333333333333333,
      "jetShearTurb": 0.05318518518518519,
      "jetFestoon": 0.005733333333333334
    },
    "uniforms": {
      "uBandM": null,
      "uBandPhaseJet": null,
      "uBandSEq": null,
      "uBandAMid": null,
      "uBandS2": null,
      "uBandDeflectScale": null
    },
    "attributes": {
      "aBand": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aShear": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aMush": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    }
  },
  {
    "preset": "Venus (sulfuric shroud)",
    "macroSeed": 7,
    "radiusEarth": 0.95,
    "rotationHours": 5832,
    "state": {
      "bandStrength": 0,
      "bandContrast": 1,
      "bandWarp": 0.55,
      "bandTint": [
        0,
        0,
        0
      ],
      "jetStrength": 0,
      "jetSpeed": 0.2,
      "jetShearTurb": 0.3,
      "jetFestoon": 0.45
    },
    "uniforms": {
      "uBandM": null,
      "uBandPhaseJet": null,
      "uBandSEq": null,
      "uBandAMid": null,
      "uBandS2": null,
      "uBandDeflectScale": null
    },
    "attributes": {
      "aBand": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aShear": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      "aMush": {
        "hash": 1995431365,
        "sample": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    }
  }
];

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE GENERATOR, VERBATIM — E-f, "the reproduction line". A caption nobody can re-run is a claim and
// not evidence; Step 3's dead gate survived precisely because nobody could re-run it. So the script
// that produced everything above is kept HERE, in the artifact it produced, rather than in a
// scratchpad that will not exist for the next session. Save it as a .mjs anywhere in the repo root
// and run it with the sha in CAPTURED_FROM to regenerate this file byte for byte.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// // Capture the PRE-CHANGE lab gas-deck law, straight out of the lab's own source text.
// //
// // It does NOT re-type the law: it slices the two live regions out of a pinned git blob of
// // planet-lod-lab.html and runs them, so the fixture is the LAB's output, not a transcription of it.
// //
// //   node scratchpad/capture-giantdeck-baseline.mjs <git-sha>  > tests/fixtures/giantdeck-preset-baseline.mjs
// //
// import { execFileSync } from 'node:child_process';
// import { fileURLToPath } from 'node:url';
// import { dirname, join } from 'node:path';
//
// const ROOT = '/home/ax/projects/well-dipper';
// const SHA = process.argv[2] || 'HEAD';
// const LAB = execFileSync('git', ['-C', ROOT, 'show', `${SHA}:planet-lod-lab.html`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// const SHA_FULL = execFileSync('git', ['-C', ROOT, 'rev-parse', SHA], { encoding: 'utf8' }).trim();
//
// const { DRIVER_PRESETS } = await import(join(ROOT, 'driver-presets.js'));
// const { deriveConditionVector } = await import(join(ROOT, 'src/worldengine/base/conditionVector.js'));
// const { deriveUniforms } = await import(join(ROOT, 'src/worldengine/base/labCore.js'));
// const e1 = await import(join(ROOT, 'src/worldengine/base/e1Regime.js'));
// const gd = await import(join(ROOT, 'src/worldengine/base/giant-drivers.js'));
// const c5 = await import(join(ROOT, 'src/worldengine/base/climate-e5.js'));
// const bf = await import(join(ROOT, 'src/worldengine/base/band-flow.js'));
//
// // ── the two regions, sliced out of the pinned blob ───────────────────────────────────────────────
// function slice(startRe, endRe, name) {
//   const s = LAB.search(startRe);
//   if (s < 0) throw new Error(`capture: start anchor not found for ${name}`);
//   const rest = LAB.slice(s);
//   const e = rest.search(endRe);
//   if (e < 0) throw new Error(`capture: end anchor not found for ${name}`);
//   const endMatch = rest.match(endRe);
//   return rest.slice(0, e + endMatch[0].length);
// }
//
// // F24/F25 derivation block, from `const _gas =` through the last jet statement.
// const SRC_DECK = slice(/const _gas = \(_fp\.atmosphere\?\.composition === 'h2-he'\);/,
//                        /state\.jetFestoon = 0\.45 \* _vigor;/, 'deck block');
// // rebakeE5Bands body — from the opening brace to the closing brace of the function.
// const SRC_REBAKE = (() => {
//   const i = LAB.indexOf('function rebakeE5Bands(){');
//   if (i < 0) throw new Error('capture: rebakeE5Bands not found');
//   let depth = 0, j = LAB.indexOf('{', i);
//   const start = j;
//   for (; j < LAB.length; j++) {
//     if (LAB[j] === '{') depth++;
//     else if (LAB[j] === '}') { depth--; if (depth === 0) break; }
//   }
//   return LAB.slice(start + 1, j);
// })();
//
// // ── a fixed, deterministic test mesh (Fibonacci sphere, object-space radius 1.0 like the lab) ────
// export function fibonacciSphere(n, radius = 1.0) {
//   const a = new Float32Array(n * 3);
//   const ga = Math.PI * (3 - Math.sqrt(5));
//   for (let i = 0; i < n; i++) {
//     const y = 1 - (i / (n - 1)) * 2;
//     const r = Math.sqrt(Math.max(0, 1 - y * y));
//     const th = ga * i;
//     a[i * 3] = Math.cos(th) * r * radius;
//     a[i * 3 + 1] = y * radius;
//     a[i * 3 + 2] = Math.sin(th) * r * radius;
//   }
//   return a;
// }
// const MESH_N = 512;
// const POS = fibonacciSphere(MESH_N, 1.0);
//
// // FNV-1a over the IEEE-754 bit pattern of every element — a difference in any bit moves it.
// function hashF32(arr) {
//   const dv = new DataView(new ArrayBuffer(8));
//   let h = 0x811c9dc5;
//   for (let i = 0; i < arr.length; i++) {
//     dv.setFloat64(0, arr[i]);
//     for (let b = 0; b < 8; b++) { h ^= dv.getUint8(b); h = Math.imul(h, 0x01000193) >>> 0; }
//   }
//   return h >>> 0;
// }
// const SAMPLE_IDX = [0, 1, 7, 63, 127, 255, 383, 511];
//
// const GAS_PRESETS = ['Gas giant (Jovian)', 'Gas giant (Saturnian)', 'Ice giant (Neptunian)',
//                      'Sub-Neptune (hazy)', 'Hot Jupiter (locked giant)'];
// const SEEDS = [1, 7, 4242];
//
// // ── the harness the two regions run inside ───────────────────────────────────────────────────────
// const deckFn = new Function('env', `with (env) { ${SRC_DECK} ; return null; }`);
// const rebakeFn = new Function('env', `with (env) { ${SRC_REBAKE} ; return null; }`);
//
// function runOne(presetName, macroSeed, radiusEarth, rotationHoursDrawn) {
//   const _fp = DRIVER_PRESETS[presetName];
//   const state = {
//     planetRadiusEarth: radiusEarth,
//     rotationHours: rotationHoursDrawn,
//     macroSeed, stormSeed: 3,
//     e5RotationScale: 1, e5Obliquity: 0,
//     bandTint: [0, 0, 0], _derived: undefined,
//   };
//   const geometry = {
//     attributes: {
//       position: { array: POS, count: MESH_N },
//       aBand: { array: new Float32Array(MESH_N), needsUpdate: false },
//       aShear: { array: new Float32Array(MESH_N), needsUpdate: false },
//       aMush: { array: new Float32Array(MESH_N), needsUpdate: false },
//       aStorm: { array: new Float32Array(MESH_N), needsUpdate: false },
//     },
//   };
//   const uniforms = Object.fromEntries(['uBandM', 'uBandPhaseJet', 'uBandSEq', 'uBandAMid', 'uBandS2',
//                                        'uBandDeflectScale'].map((k) => [k, { value: NaN }]));
//   const env = {
//     _fp, state, geometry, uniforms, R: 1.0,
//     driverUI: { preset: presetName, qualityTier: 1.0 },
//     DRIVER_PRESETS, deriveUniforms, deriveConditionVector,
//     compositionClass: e1.compositionClass, giantRegimeOf: e1.giantRegimeOf,
//     drawGiantConditions: gd.drawGiantConditions, deriveGiantDrivers: gd.deriveGiantDrivers,
//     giantDriverScalars: gd.giantDriverScalars,
//     bakeClimateE5Attributes: c5.bakeClimateE5Attributes,
//     bandProxyUniforms: bf.bandProxyUniforms, drawBandRoughness: bf.drawBandRoughness,
//     bakeStormEAttributes: () => ({ aStorm: new Float32Array(MESH_N) }),   // OUT of pack #1 (§7 storm slice)
//     _driverTouched: new Set(),
//     _ss: (e0, e1x, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1x - e0))); return t * t * (3 - 2 * t); },
//     _clamp01: (x) => Math.max(0, Math.min(1, x)),
//     rebakeE5Bands: () => rebakeFn(env),
//   };
//   deckFn(env);
//   rebakeFn(env);   // the lab's `rebakeE5Bands();` call, which sits one line past the sliced block
//   const attrs = geometry.attributes;
//   const sample = (a) => SAMPLE_IDX.map((i) => a[i]);
//   return {
//     preset: presetName, macroSeed, radiusEarth, rotationHours: rotationHoursDrawn,
//     state: {
//       bandStrength: state.bandStrength, bandContrast: state.bandContrast, bandWarp: state.bandWarp,
//       bandTint: state.bandTint.slice(), jetStrength: state.jetStrength, jetSpeed: state.jetSpeed,
//       jetShearTurb: state.jetShearTurb, jetFestoon: state.jetFestoon,
//       bandRough: state.bandRough,
//       e5BandCount: state.e5BandCount, e5EqSign: state.e5EqSign, e5PeakU: state.e5PeakU,
//     },
//     uniforms: Object.fromEntries(Object.entries(uniforms).map(([k, v]) => [k, v.value])),
//     attributes: Object.fromEntries(['aBand', 'aShear', 'aMush'].map((k) => [k, {
//       hash: hashF32(attrs[k].array), sample: sample(attrs[k].array),
//     }])),
//   };
// }
//
// const ROWS = [];
// for (const p of GAS_PRESETS) {
//   const canonR = DRIVER_PRESETS[p].radiusEarth;
//   for (const s of SEEDS) ROWS.push(runOne(p, s, canonR, DRIVER_PRESETS[p].rotationHours));
//   // one OFF-canonical radius + one DRAWN rotation per preset — the display-policy / live-feed axis
//   ROWS.push(runOne(p, 7, canonR * 0.7, (DRIVER_PRESETS[p].rotationHours ?? 24) * 1.3));
// }
// // and the solid presets, whose only correct output is the OFF state
// const SOLID = ['Rocky (Earthlike)', 'Lava (hot airless)', 'Frozen (airless)', 'Venus (sulfuric shroud)'];
// for (const p of SOLID) ROWS.push(runOne(p, 7, DRIVER_PRESETS[p].radiusEarth, DRIVER_PRESETS[p].rotationHours));
//
// const out = `// tests/fixtures/giantdeck-preset-baseline.mjs — GENERATED, DO NOT HAND-EDIT.
// //
// // The gas-deck law AS THE LAB RAN IT BEFORE the giantDeck pack existed. PLAN §4 Step 5's first gate
// // is "pack+writer output equals a fixture captured from the lab BEFORE the change, max delta exactly 0".
// //
// // ⭐ HOW IT WAS CAPTURED, so the number below is re-derivable rather than asserted. The capture script
// // does NOT re-type the lab's law. It slices the two live regions out of a PINNED git blob of
// // planet-lod-lab.html — the F24/F25 derivation block (\`const _gas = …\` through
// // \`state.jetFestoon = 0.45 * _vigor;\`) and the whole body of \`function rebakeE5Bands(){\` — and runs
// // them with \`new Function\` against the real modules. So this is the lab's own output.
// //
// //   node scratchpad/capture-giantdeck-baseline.mjs ${SHA_FULL.slice(0, 7)} > tests/fixtures/giantdeck-preset-baseline.mjs
// //
// // captured from: planet-lod-lab.html @ ${SHA_FULL}
// //
// // ⚠ ROWS ARE KEYED BY CONDITION, NOT BY PRESET NAME. Every row records the exact (preset, macroSeed,
// // radiusEarth, rotationHours) it was produced from, and the test rebuilds the SAME condition vector
// // from them before calling the pack. PLAN §4 Step 5: "Measure on the same CONDITION object, not the
// // same preset name — the two routes differ by 3-6x on T_eq for the same nominal body, and a
// // preset-to-preset comparison produces a false red that looks exactly like a broken extraction."
// //
// // ⚠ \`aStorm\` IS ABSENT ON PURPOSE, not forgotten. Its producer is the storm slice, which PLAN §7
// // fences out of pack #1; the capture stubs \`bakeStormEAttributes\` to a zero array so nothing here
// // can be read as a claim about it.
// //
// // Attribute rows carry an FNV-1a hash over the IEEE-754 bit pattern of EVERY element (any bit moves
// // it) plus 8 full-precision samples at fixed indices, so a failure reports a NUMBER and not just
// // "the hash differs". The mesh is the deterministic Fibonacci sphere below — the same one the test
// // builds — at object-space radius 1.0, which is the lab's own \`const R = 1.0;\`.
// export const MESH_N = ${MESH_N};
// export const MESH_RADIUS = 1.0;
// export const SAMPLE_IDX = ${JSON.stringify(SAMPLE_IDX)};
// export const CAPTURED_FROM = '${SHA_FULL}';
//
// // The exact mesh the capture baked over. Kept as CODE, not as 1536 floats: a Float32Array written out
// // as decimal literals does not round-trip, and a fixture that is 0.5 ULP off its own mesh turns a
// // byte-identity gate into a tolerance gate without anyone deciding to.
// export function fibonacciSphere(n, radius = 1.0) {
//   const a = new Float32Array(n * 3);
//   const ga = Math.PI * (3 - Math.sqrt(5));
//   for (let i = 0; i < n; i++) {
//     const y = 1 - (i / (n - 1)) * 2;
//     const r = Math.sqrt(Math.max(0, 1 - y * y));
//     const th = ga * i;
//     a[i * 3] = Math.cos(th) * r * radius;
//     a[i * 3 + 1] = y * radius;
//     a[i * 3 + 2] = Math.sin(th) * r * radius;
//   }
//   return a;
// }
//
// export const BASELINE = ${JSON.stringify(ROWS, null, 2)};
// `;
// process.stdout.write(out);
//
