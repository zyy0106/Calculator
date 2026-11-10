/* WebCASIO - 物理/数学常数数据层 (S1)
 * 全部数值采用 SI 单位制下的纯数值, 不带单位.
 * 收录 CASIO fx-991CN CW 内置的 47 个物理常数 + 6 个重要数学常数.
 *
 * 字段说明:
 *   id    内部唯一标识 (原子字符的载荷, 如 'eps0')
 *   tex   KaTeX 片段, 用于公式框与面板按钮显示
 *   name  中文名称
 *   v     数值字面量字符串 (SI 纯数值). mathjs 可直接解析
 *   grade 精度等级:
 *           'exact'    SI 定义的精确值
 *           'derived'  由精确值推导, 这里给到 17 位有效数字
 *           'measured' CODATA 2018 实测值, 只有公布位数 (普遍少于 15 位)
 *           'math'     数学常数, 给到 20 位以上
 *   group 分组键
 *
 * 导出: CONSTANTS, CONST_BY_ID, CONST_GROUPS, constCode(id), constSciParts(id, sig)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ConstantsData = api;
    root.CONSTANTS = api.CONSTANTS;
    root.CONST_BY_ID = api.CONST_BY_ID;
    root.CONST_GROUPS = api.CONST_GROUPS;
    root.constCode = api.constCode;
    root.constSciParts = api.constSciParts;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GROUP_LABELS = {
    universal: '普适常数',
    em: '电磁学常数',
    atomic: '原子与核物理常数',
    physchem: '物理化学常数',
    adopted: '约定值',
    other: '其他',
    math: '数学常数'
  };

  var CONSTANTS = [
    // ---- 普适常数 ----
    { id: 'h',       tex: 'h',            name: '普朗克常数',        v: '6.62607015e-34',            grade: 'exact',    group: 'universal' },
    { id: 'hbar',    tex: '\\hbar',       name: '约化普朗克常数',    v: '1.0545718176461565e-34',    grade: 'derived',  group: 'universal' },
    { id: 'c0',      tex: 'c_0',          name: '真空中光速',        v: '299792458',                 grade: 'exact',    group: 'universal' },
    { id: 'eps0',    tex: '\\varepsilon_0', name: '真空电容率',      v: '8.8541878128e-12',          grade: 'measured', group: 'universal' },
    { id: 'mu0',     tex: '\\mu_0',       name: '真空磁导率',        v: '1.25663706212e-6',          grade: 'measured', group: 'universal' },
    { id: 'Z0',      tex: 'Z_0',          name: '真空特征阻抗',      v: '376.730313668',             grade: 'measured', group: 'universal' },
    { id: 'G',       tex: 'G',            name: '万有引力常数',      v: '6.67430e-11',               grade: 'measured', group: 'universal' },
    { id: 'lP',      tex: 'l_P',          name: '普朗克长度',        v: '1.616255e-35',              grade: 'measured', group: 'universal' },
    { id: 'tP',      tex: 't_P',          name: '普朗克时间',        v: '5.391247e-44',              grade: 'measured', group: 'universal' },

    // ---- 电磁学常数 ----
    { id: 'muN',     tex: '\\mu_N',       name: '核磁子',            v: '5.0507837461e-27',          grade: 'measured', group: 'em' },
    { id: 'muB',     tex: '\\mu_B',       name: '玻尔磁子',          v: '9.2740100783e-24',          grade: 'measured', group: 'em' },
    { id: 'qe',      tex: 'e',            name: '元电荷',            v: '1.602176634e-19',           grade: 'exact',    group: 'em' },
    { id: 'Phi0',    tex: '\\Phi_0',      name: '磁通量子',          v: '2.0678338484619295e-15',    grade: 'derived',  group: 'em' },
    { id: 'G0',      tex: 'G_0',          name: '电导量子',          v: '7.7480917298636487e-5',     grade: 'derived',  group: 'em' },
    { id: 'KJ',      tex: 'K_J',          name: '约瑟夫森常数',      v: '4.8359784841698363e14',     grade: 'derived',  group: 'em' },
    { id: 'RK',      tex: 'R_K',          name: '冯·克利青常数',     v: '2.5812807459304513e4',      grade: 'derived',  group: 'em' },

    // ---- 原子与核物理常数 ----
    { id: 'mp',      tex: 'm_p',          name: '质子质量',          v: '1.67262192369e-27',         grade: 'measured', group: 'atomic' },
    { id: 'mn',      tex: 'm_n',          name: '中子质量',          v: '1.67492749804e-27',         grade: 'measured', group: 'atomic' },
    { id: 'me',      tex: 'm_e',          name: '电子质量',          v: '9.1093837015e-31',          grade: 'measured', group: 'atomic' },
    { id: 'mmu',     tex: 'm_\\mu',       name: 'μ 子质量',          v: '1.883531627e-28',           grade: 'measured', group: 'atomic' },
    { id: 'mtau',    tex: 'm_\\tau',      name: 'τ 子质量',          v: '3.16754e-27',               grade: 'measured', group: 'atomic' },
    { id: 'a0',      tex: 'a_0',          name: '玻尔半径',          v: '5.29177210903e-11',         grade: 'measured', group: 'atomic' },
    { id: 'alpha',   tex: '\\alpha',      name: '精细结构常数',      v: '7.2973525693e-3',           grade: 'measured', group: 'atomic' },
    { id: 're',      tex: 'r_e',          name: '经典电子半径',      v: '2.8179403262e-15',          grade: 'measured', group: 'atomic' },
    { id: 'lamC',    tex: '\\lambda_C',   name: '康普顿波长',        v: '2.42631023867e-12',         grade: 'measured', group: 'atomic' },
    { id: 'gammap',  tex: '\\gamma_p',    name: '质子旋磁比',        v: '2.6752218744e8',            grade: 'measured', group: 'atomic' },
    { id: 'lamCp',   tex: '\\lambda_{C,p}', name: '质子康普顿波长',  v: '1.32140985539e-15',         grade: 'measured', group: 'atomic' },
    { id: 'lamCn',   tex: '\\lambda_{C,n}', name: '中子康普顿波长',  v: '1.31959090581e-15',         grade: 'measured', group: 'atomic' },
    { id: 'Rinf',    tex: 'R_\\infty',    name: '里德伯常数',        v: '10973731.568160',           grade: 'measured', group: 'atomic' },
    { id: 'mup',     tex: '\\mu_p',       name: '质子磁矩',          v: '1.41060679736e-26',         grade: 'measured', group: 'atomic' },
    { id: 'mue',     tex: '\\mu_e',       name: '电子磁矩',          v: '-9.2847647043e-24',         grade: 'measured', group: 'atomic' },
    { id: 'mun',     tex: '\\mu_n',       name: '中子磁矩',          v: '-9.6623651e-27',            grade: 'measured', group: 'atomic' },
    { id: 'mumu',    tex: '\\mu_\\mu',    name: 'μ 子磁矩',          v: '-4.49044830e-26',           grade: 'measured', group: 'atomic' },

    // ---- 物理化学常数 ----
    { id: 'mu_u',    tex: 'm_u',          name: '原子质量常数',      v: '1.66053906660e-27',         grade: 'measured', group: 'physchem' },
    { id: 'NA',      tex: 'N_A',          name: '阿伏伽德罗常数',    v: '6.02214076e23',             grade: 'exact',    group: 'physchem' },
    { id: 'k',       tex: 'k',            name: '玻尔兹曼常数',      v: '1.380649e-23',              grade: 'exact',    group: 'physchem' },
    { id: 'F',       tex: 'F',            name: '法拉第常数',        v: '9.6485332123310014e4',      grade: 'derived',  group: 'physchem' },
    { id: 'Rgas',    tex: 'R',            name: '摩尔气体常数',      v: '8.3144626181532395',        grade: 'derived',  group: 'physchem' },
    { id: 'Vm',      tex: 'V_m',          name: '理想气体摩尔体积',  v: '2.2413969545014137e-2',     grade: 'derived',  group: 'physchem' },
    { id: 'c1',      tex: 'c_1',          name: '第一辐射常数',      v: '3.7417718521927573e-16',    grade: 'derived',  group: 'physchem' },
    { id: 'c2',      tex: 'c_2',          name: '第二辐射常数',      v: '1.4387768775039337e-2',     grade: 'derived',  group: 'physchem' },
    { id: 'sigma',   tex: '\\sigma',      name: '斯特藩-玻尔兹曼常数', v: '5.6703744191844301e-8',   grade: 'derived',  group: 'physchem' },

    // ---- 约定值 ----
    { id: 'gn',      tex: 'g_n',          name: '标准重力加速度',    v: '9.80665',                   grade: 'exact',    group: 'adopted' },
    { id: 'atm',     tex: '\\mathrm{atm}', name: '标准大气压',       v: '101325',                    grade: 'exact',    group: 'adopted' },
    { id: 'RK90',    tex: 'R_{K\\text{-}90}', name: '约定冯·克利青常数', v: '25812.807',            grade: 'exact',    group: 'adopted' },
    { id: 'KJ90',    tex: 'K_{J\\text{-}90}', name: '约定约瑟夫森常数', v: '483597.9e9',            grade: 'exact',    group: 'adopted' },

    // ---- 其他 ----
    { id: 't0',      tex: 't',            name: '冰点热力学温度',    v: '273.15',                    grade: 'exact',    group: 'other' },

    // ---- 数学常数 ----
    { id: 'pi',      tex: '\\pi',         name: '圆周率',            v: 'pi',                        grade: 'math',     group: 'math' },
    { id: 'e',       tex: '\\mathrm{e}',  name: '自然常数',          v: 'e',                         grade: 'math',     group: 'math' },
    { id: 'egamma',  tex: '\\gamma',      name: '欧拉-马歇罗尼常数', v: '0.57721566490153286061',    grade: 'math',     group: 'math' },
    { id: 'phi',     tex: '\\varphi',     name: '黄金分割比',        v: '1.6180339887498948482',     grade: 'math',     group: 'math' },
    { id: 'catalan', tex: 'K_{\\mathrm{C}}', name: '卡塔兰常数',     v: '0.91596559417721901505',    grade: 'math',     group: 'math' },
    { id: 'zeta3',   tex: '\\zeta(3)',    name: '阿培里常数',        v: '1.2020569031595942854',     grade: 'math',     group: 'math' }
  ];

  var CONST_BY_ID = Object.create(null);
  for (var i = 0; i < CONSTANTS.length; i++) CONST_BY_ID[CONSTANTS[i].id] = CONSTANTS[i];

  var GROUP_ORDER = ['universal', 'em', 'atomic', 'physchem', 'adopted', 'other', 'math'];
  var CONST_GROUPS = GROUP_ORDER.map(function (g) {
    return {
      key: g,
      label: GROUP_LABELS[g],
      items: CONSTANTS.filter(function (c) { return c.group === g; })
    };
  });

  /* 返回可直接拼进求值字符串的操作数.
   * pi / e 走 mathjs 的内置符号, 其余用数值字面量; 负值加括号避免 "3-" 式歧义. */
  function constCode(id) {
    var c = CONST_BY_ID[id];
    if (!c) return 'NaN';
    if (c.v === 'pi' || c.v === 'e') return c.v;
    return c.v.charAt(0) === '-' ? '(' + c.v + ')' : c.v;
  }

  /* 面板长按时显示的科学记数法. 返回 {mant, exp, tex}.
   * sig 为有效数字位数, 默认 10. */
  function constSciParts(id, sig) {
    var c = CONST_BY_ID[id];
    if (!c) return null;
    var n = (c.v === 'pi') ? Math.PI : (c.v === 'e') ? Math.E : Number(c.v);
    var s = n.toExponential(Math.max(0, (sig || 10) - 1));
    var m = /^(-?\d(?:\.\d+)?)e([+-]\d+)$/.exec(s);
    if (!m) return { mant: String(n), exp: '0', tex: String(n) };
    var mant = m[1].replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    var exp = String(parseInt(m[2], 10));
    return {
      mant: mant,
      exp: exp,
      tex: exp === '0' ? mant : mant + '\\times 10^{' + exp + '}'
    };
  }

  return {
    CONSTANTS: CONSTANTS,
    CONST_BY_ID: CONST_BY_ID,
    CONST_GROUPS: CONST_GROUPS,
    GROUP_LABELS: GROUP_LABELS,
    constCode: constCode,
    constSciParts: constSciParts
  };
});

/* ---- 自检: node tools/constants-data.js --selftest ---- */
if (typeof module === 'object' && require.main === module && process.argv.indexOf('--selftest') >= 0) {
  var A = module.exports, fail = 0, seenId = {}, seenTex = {}, seenName = {};
  function chk(ok, msg) { if (!ok) { fail++; console.log('FAIL ' + msg); } }
  A.CONSTANTS.forEach(function (c) {
    chk(!seenId[c.id], 'id 重复: ' + c.id); seenId[c.id] = 1;
    chk(!seenTex[c.tex], 'tex 重复: ' + c.tex); seenTex[c.tex] = 1;
    chk(!seenName[c.name], 'name 重复: ' + c.name); seenName[c.name] = 1;
    chk(/^[A-Za-z][A-Za-z0-9_]*$/.test(c.id), 'id 非法: ' + c.id);
    chk(!!c.name && !!c.tex, '缺字段: ' + c.id);
    var code = A.constCode(c.id);
    if (c.v !== 'pi' && c.v !== 'e') {
      var n = Number(c.v);
      chk(isFinite(n) && n !== 0, '数值无法解析: ' + c.id + ' = ' + c.v);
      if (n < 0) chk(code.charAt(0) === '(' && code.slice(-1) === ')', '负值未加括号: ' + c.id);
      var sci = A.constSciParts(c.id, 12);
      chk(sci && sci.tex.indexOf('NaN') < 0, 'constSciParts 失败: ' + c.id);
    } else {
      chk(code === c.v, 'pi/e 应走符号: ' + c.id);
    }
  });
  var phys = A.CONSTANTS.filter(function (c) { return c.group !== 'math'; });
  chk(phys.length === 47, '物理常数应为 47 个, 实为 ' + phys.length);
  var byGrade = {};
  A.CONSTANTS.forEach(function (c) { byGrade[c.grade] = (byGrade[c.grade] || 0) + 1; });
  console.log('总数 ' + A.CONSTANTS.length + ' (物理 ' + phys.length + ' + 数学 ' + (A.CONSTANTS.length - phys.length) + ')');
  console.log('精度分级 ' + JSON.stringify(byGrade));
  console.log('分组 ' + A.CONST_GROUPS.map(function (g) { return g.label + '=' + g.items.length; }).join(', '));
  console.log(fail === 0 ? 'SELFTEST OK' : ('SELFTEST 失败 ' + fail + ' 项'));
  if (fail) process.exitCode = 1;
}
