// СГЕНЕРИРОВАНО из «Способы_сварки_v4.xlsx» — единственный источник правды
// о том, какие поля нужны какому способу сварки и что печатается в бланке.
//
// Руками не править: правится таблица, потом файл пересобирается.
//
// ВАЖНО про owner. После перестройки схемы поля живут в разных сущностях:
//   'card' — в самой техкарте (WeldingCard)
//   'seam' — в шве по чертежу (technology.SeamSpec), карта их только ПОКАЗЫВАЕТ
//   'pass' — в проходе карты (WeldPass)
//   'run'  — в выполнении операции (welding.OperationRun), это факт, а не план
//
// То есть форма карты редактирует только owner === 'card' и 'pass'.
// Остальное приходит по связям и выводится для справки.

export type MethodCode =
  | 'tig1'
  | 'tig2'
  | 'tig3'
  | 'tig4'
  | 'mig'
  | 'plasma'
  | 'ebw'
  | 'diff'
  | 'spot'
  | 'seamw'
  | 'laser';

export type FieldLevel = 'card' | 'pass';
export type FieldOwner = 'card' | 'seam' | 'pass' | 'run';
export type WeldingMode = 'continuous' | 'pulse';

export interface FieldSpec {
  /** Ключ поля. Точка = поле внутри JSON-колонки extra. */
  key: string;
  label: string;
  unit?: string;
  /** Раздел формы — по нему группируются поля на экране. */
  section: string;
  /** Уровень: поле карты или поле прохода. */
  level: FieldLevel;
  /** В какой сущности реально хранится — см. комментарий выше. */
  owner: FieldOwner;
  /** Способы, для которых поле показывается. */
  methods: readonly MethodCode[];
  /** Попадает в печатный бланк техкарты. */
  inSheet: boolean;
  /** Вводится диапазоном: в модели `key_min` и `key_max`. */
  range?: true;
  /** Считает сервер, фронт только показывает. */
  readOnly?: true;
  /** Показывать только в импульсном режиме. */
  pulseOnly?: true;
  /** Скрывать в импульсном режиме для этих способов. */
  hiddenWhenPulse?: readonly MethodCode[];
}

export const FIELDS: readonly FieldSpec[] = [

  // —— КАРТА: ПОЗИЦИИ СОЕДИНЕНИЯ ——
  { key: "pos_1", label: "Позиция 1 (номер по чертежу)", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: true },
  { key: "material_1_id", label: "Марка материала 1", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: true },
  { key: "thickness_1", label: "Толщина позиции 1", unit: "мм", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: true },
  { key: "mass_1", label: "Масса позиции 1", unit: "кг", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: false },
  { key: "pos_2", label: "Позиция 2 (номер по чертежу)", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: true },
  { key: "material_2_id", label: "Марка материала 2", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: true },
  { key: "thickness_2", label: "Толщина позиции 2", unit: "мм", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: true },
  { key: "mass_2", label: "Масса позиции 2", unit: "кг", section: "ПОЗИЦИИ СОЕДИНЕНИЯ", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'spot', 'seamw', 'laser'], inSheet: false },

  // —— КАРТА: СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА ——
  { key: "tungsten_id", label: "Вольфрамовый электрод (марка + Ø)", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'plasma'], inSheet: true },
  { key: "extra.electrode_angle", label: "Угол заточки электрода", unit: "°", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig2', 'tig3', 'plasma'], inSheet: true },
  { key: "filler_id", label: "Присадочный материал", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true },
  { key: "shield_gas_id", label: "Защитный газ в горелку", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'mig', 'plasma', 'laser'], inSheet: true },
  { key: "backing_gas_id", label: "Защитный газ на поддув", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'mig', 'plasma', 'laser'], inSheet: true },
  { key: "plasma_gas_id", label: "Плазмообразующий газ", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['plasma'], inSheet: true },
  { key: "flux_id", label: "Флюс", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig2', 'tig3'], inSheet: true },
  { key: "extra.env_welding", label: "Среда при сварке", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig4', 'diff'], inSheet: true },
  { key: "extra.env_cooling", label: "Среда при остывании", section: "СВАРОЧНЫЕ МАТЕРИАЛЫ И СРЕДА", level: 'card', owner: 'card', methods: ['tig4', 'diff'], inSheet: true },

  // —— КАРТА: ГЕОМЕТРИЯ ШВА ——
  { key: "seam_type", label: "Тип шва (прямой / кольцевой)", section: "ГЕОМЕТРИЯ ШВА", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'seamw', 'laser'], inSheet: false },
  { key: "seam_diameter", label: "Диаметр шва (для кольцевого)", unit: "мм", section: "ГЕОМЕТРИЯ ШВА", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'seamw', 'laser'], inSheet: true },
  { key: "seam_length", label: "Длина шва", unit: "мм", section: "ГЕОМЕТРИЯ ШВА", level: 'card', owner: 'seam', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'seamw', 'laser'], inSheet: true },

  // —— КАРТА: РЕЖИМ И УСЛОВИЯ ——
  { key: "welding_mode", label: "Режим сварки (импульсный / непрерывный)", section: "РЕЖИМ И УСЛОВИЯ", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true },
  { key: "extra.position", label: "Положение шва", section: "РЕЖИМ И УСЛОВИЯ", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'laser'], inSheet: false },
  { key: "heat_treatment", label: "Термообработка", section: "РЕЖИМ И УСЛОВИЯ", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'laser'], inSheet: false },

  // —— КАРТА: СПЕЦИФИКА СПОСОБОВ ——
  { key: "extra.nozzle", label: "Сопло газовое / Ø сопла", unit: "мм", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['tig1', 'tig2', 'tig3', 'mig', 'plasma'], inSheet: true },
  { key: "plasma_nozzle_d", label: "Ø плазмообразующего сопла", unit: "мм", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['plasma'], inSheet: true },
  { key: "extra.stickout", label: "Вылет электрода", unit: "мм", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['tig2', 'tig3', 'mig'], inSheet: true },
  { key: "extra.offset", label: "Смещение от оси", unit: "мм", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['tig2', 'mig', 'plasma', 'laser'], inSheet: true },
  { key: "extra.plasma_mode", label: "Режим плазменной сварки (проникающий и др.)", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['plasma'], inSheet: true },
  { key: "extra.vacuum", label: "Вакуум", unit: "Па", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['ebw', 'diff'], inSheet: true },
  { key: "extra.focus_distance", label: "Фокусное расстояние", unit: "мм", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['ebw', 'laser'], inSheet: true },
  { key: "extra.accel_voltage", label: "Ускоряющее напряжение", unit: "кВ", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['ebw'], inSheet: true },
  { key: "extra.sweep", label: "Развёртка луча", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: ['ebw', 'laser'], inSheet: true },
  { key: "extra.interlayer", label: "Промежуточный слой", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: [], inSheet: false },
  { key: "extra.contact_area", label: "Площадь контакта", unit: "мм²", section: "СПЕЦИФИКА СПОСОБОВ", level: 'card', owner: 'card', methods: [], inSheet: false },

  // —— КАРТА: ЗАМЕРЫ ПОСЛЕ СВАРКИ ——
  { key: "size_before", label: "Размер до сварки", unit: "мм", section: "ЗАМЕРЫ ПОСЛЕ СВАРКИ", level: 'card', owner: 'run', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'laser'], inSheet: false },
  { key: "size_after", label: "Размер после сварки", unit: "мм", section: "ЗАМЕРЫ ПОСЛЕ СВАРКИ", level: 'card', owner: 'run', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'diff', 'laser'], inSheet: false },

  // —— ПРОХОД: общее ——
  { key: "current", label: "Ток сварки (от–до)", unit: "А", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'spot', 'seamw', 'laser'], inSheet: true, range: true },
  { key: "voltage", label: "Напряжение (от–до)", unit: "В", section: "", level: 'pass', owner: 'pass', methods: ['tig2', 'tig3', 'mig', 'plasma', 'spot', 'seamw'], inSheet: true, range: true, hiddenWhenPulse: ['tig1', 'tig2', 'tig3', 'tig4'] },
  { key: "extra.voltage_start", label: "Напряжение при старте", unit: "В", section: "", level: 'pass', owner: 'pass', methods: ['mig'], inSheet: true },
  { key: "extra.arc_gap", label: "Дуговой промежуток", unit: "мм", section: "", level: 'pass', owner: 'pass', methods: ['tig2', 'tig3'], inSheet: true, pulseOnly: true },
  { key: "speed_raw", label: "Скорость сварки (в ед. установки)", unit: "ед. уст.", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'seamw', 'laser'], inSheet: true, range: true },
  { key: "speed", label: "Скорость сварки в м/ч", unit: "м/ч", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'ebw', 'seamw', 'laser'], inSheet: true, range: true, readOnly: true },
  { key: "wire_speed", label: "Скорость подачи проволоки (от–до)", unit: "м/мин", section: "", level: 'pass', owner: 'pass', methods: ['tig2', 'tig3', 'mig', 'plasma', 'laser'], inSheet: true, range: true },
  { key: "gas_flow", label: "Расход защитного газа (от–до)", unit: "л/мин", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true, range: true },
  { key: "backing_flow", label: "Расход газа на поддув (от–до)", unit: "л/мин", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'mig', 'plasma', 'laser'], inSheet: true, range: true },
  { key: "plasma_flow", label: "Расход плазмообразующего газа", unit: "л/мин", section: "", level: 'pass', owner: 'pass', methods: ['plasma'], inSheet: true, range: true },
  { key: "pass_filler_id", label: "Присадочный материал на проходе", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3'], inSheet: true },
  { key: "filler_diameter", label: "Диаметр присадки", unit: "мм", section: "", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma'], inSheet: true },

  // —— ПРОХОД: ИМПУЛЬСНЫЙ РЕЖИМ ——
  { key: "pulse_current", label: "Ток импульса", unit: "А", section: "ИМПУЛЬСНЫЙ РЕЖИМ", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true, pulseOnly: true },
  { key: "pulse_time", label: "Время импульса", unit: "с", section: "ИМПУЛЬСНЫЙ РЕЖИМ", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true, pulseOnly: true },
  { key: "pause_current", label: "Ток паузы", unit: "А", section: "ИМПУЛЬСНЫЙ РЕЖИМ", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true, pulseOnly: true },
  { key: "pause_time", label: "Время паузы", unit: "с", section: "ИМПУЛЬСНЫЙ РЕЖИМ", level: 'pass', owner: 'pass', methods: ['tig1', 'tig2', 'tig3', 'tig4', 'mig', 'plasma', 'laser'], inSheet: true, pulseOnly: true },

  // —— ПРОХОД: СПЕЦИФИКА СПОСОБОВ ——
  { key: "beam_current", label: "Ток луча", unit: "мА", section: "СПЕЦИФИКА СПОСОБОВ", level: 'pass', owner: 'pass', methods: ['ebw'], inSheet: true },
  { key: "extra.focus_current", label: "Ток фокусировки", unit: "мА", section: "СПЕЦИФИКА СПОСОБОВ", level: 'pass', owner: 'pass', methods: ['ebw'], inSheet: true },
  { key: "extra.temperature", label: "Температура", unit: "°C", section: "СПЕЦИФИКА СПОСОБОВ", level: 'pass', owner: 'pass', methods: ['diff'], inSheet: true },
  { key: "extra.pressure", label: "Давление", unit: "МПа", section: "СПЕЦИФИКА СПОСОБОВ", level: 'pass', owner: 'pass', methods: ['diff'], inSheet: true },
  { key: "extra.hold_time", label: "Время выдержки", unit: "мин", section: "СПЕЦИФИКА СПОСОБОВ", level: 'pass', owner: 'pass', methods: ['diff'], inSheet: true },
];

/** Поле лежит в JSON-колонке extra, а не отдельной колонкой таблицы. */
export function isExtra(f: FieldSpec): boolean {
  return f.key.startsWith('extra.');
}

/** Имя внутри extra: 'extra.position' → 'position'. */
export function extraName(f: FieldSpec): string {
  return f.key.slice('extra.'.length);
}

/**
 * Поля для формы: способ + уровень + режим сварки.
 * Импульсные параметры показываются только в импульсном режиме;
 * напряжение у TIG в импульсном заменяется дуговым промежутком.
 */
export function fieldsFor(
  method: MethodCode,
  level: FieldLevel,
  mode: WeldingMode = 'continuous',
): FieldSpec[] {
  return FIELDS.filter((f) => {
    if (f.level !== level) return false;
    if (!f.methods.includes(method)) return false;
    if (f.pulseOnly && mode !== 'pulse') return false;
    if (mode === 'pulse' && f.hiddenWhenPulse?.includes(method)) return false;
    return true;
  });
}

/** Только то, что редактируется в форме карты (owner card или pass). */
export function editableFieldsFor(
  method: MethodCode,
  level: FieldLevel,
  mode: WeldingMode = 'continuous',
): FieldSpec[] {
  return fieldsFor(method, level, mode).filter(
    (f) => (f.owner === 'card' || f.owner === 'pass') && !f.readOnly,
  );
}

/** Только то, что печатается в бланке. */
export function sheetFieldsFor(
  method: MethodCode,
  level: FieldLevel,
  mode: WeldingMode = 'continuous',
): FieldSpec[] {
  return fieldsFor(method, level, mode).filter((f) => f.inSheet);
}

/** Поля, сгруппированные по разделам — для раскладки формы. */
export function sectionsFor(
  method: MethodCode,
  level: FieldLevel,
  mode: WeldingMode = 'continuous',
): { section: string; fields: FieldSpec[] }[] {
  const out: { section: string; fields: FieldSpec[] }[] = [];
  for (const f of fieldsFor(method, level, mode)) {
    const last = out[out.length - 1];
    if (last && last.section === f.section) last.fields.push(f);
    else out.push({ section: f.section, fields: [f] });
  }
  return out;
}
