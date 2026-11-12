import { statesEn } from './states.en';

/** Textos de los estados activos y de Forma salvaje en español (mismas claves que states.en.ts). */
export const statesEs: Record<keyof typeof statesEn, string> = {
  'state.title': 'Estados activos',
  'state.on': 'Activo',
  'state.off': 'Inactivo',
  'state.activate': 'Activar',
  'state.activateCost': 'Activar (gasta 1 · quedan {left})',
  'state.noUses': 'Sin usos',
  'state.end': 'Terminar',
  'state.ended.heavyArmor': 'Ha terminado: llevas armadura pesada.',
  'state.ended.incapacitated': 'Ha terminado: tienes el estado Incapacitado.',
  'state.ended.unconscious': 'Ha terminado: tienes el estado Inconsciente.',
  'state.fx.rage':
    '+{n} al daño con ataques de Fuerza (ya sumado) · Resistencia al daño contundente, perforante y cortante · Ventaja en pruebas y salvaciones de Fuerza · sin concentración ni conjuros',
  'state.dur.rage':
    'Dura hasta el final de tu siguiente turno; la alargas atacando a un enemigo, obligándole a una salvación o con una acción adicional (máx. 10 minutos). Termina con armadura pesada o el estado Incapacitado.',
  'state.dur.ragePersistent':
    'Dura 10 minutos sin alargarla; termina si tienes el estado Inconsciente o te pones armadura pesada.',
  'state.fx.hex':
    '+1d6 de daño necrótico a la criatura maldita en cada impacto con tirada de ataque; tiene desventaja en las pruebas de la característica elegida',
  'state.fx.huntersMark':
    '+1{die} de daño de fuerza a la criatura marcada en cada impacto con tirada de ataque; ventaja en Sabiduría (Percepción o Supervivencia) para encontrarla',
  'state.dur.concentration': 'Concentración, hasta 1 hora. Un descanso corto o largo lo termina.',
  'state.fx.innateSorcery':
    'CD de conjuros de hechicero {dc} (+1, ya sumado) · ventaja en las tiradas de ataque de conjuros de hechicero',
  'state.dur.innateSorcery': 'Dura 1 minuto.',
  'state.whileOff': 'solo con el estado activo',
  'combat.note.rageOn': 'furia: +{n} al daño ya sumado',
  'combat.note.lunarRadiance': 'Resplandor lunar: puedes hacer el daño radiante',
  'ws.title': 'Forma salvaje',
  'ws.rules':
    '{known} formas conocidas · VD máx. {cr} · {fly} · dura {hours} h · {thp} PG temporales al transformarte',
  'ws.fly.yes': 'con vuelo',
  'ws.fly.no': 'sin vuelo',
  'ws.transform': 'Transformarse',
  'ws.transformCost': 'Transformarse (gasta 1 · quedan {left})',
  'ws.revert': 'Volver a la forma normal',
  'ws.pickForm': 'Forma',
  'ws.noForms': 'Aún no conoces ninguna forma.',
  'ws.goForms': 'Elegir formas',
  'ws.current': 'Forma actual: {name}',
  'ws.since': 'desde {date} · dura {hours} h',
  'ws.known': 'Formas conocidas ({n}/{max})',
  'ws.knownHint':
    'Al terminar un descanso largo puedes cambiar una de tus formas conocidas por otra válida.',
  'ws.choose': 'Elegir formas',
  'ws.done': 'Hecho',
  'ws.search': 'Buscar bestia',
  'ws.learn': 'Aprender',
  'ws.forget': 'Olvidar',
  'ws.full': 'Ya conoces {max} formas: olvida una para aprender otra.',
  'ws.notAllowed': 'No válida a tu nivel',
  'ws.sheet': 'Ficha',
  'ws.eligible': '{n} bestias válidas',
  'ws.crShort': 'VD {cr}',
  'ws.acCircle': '13 + SAB (Formas de círculo)',
  'ws.yourHp': 'Tus PG',
  'ws.keeps': 'Conservas',
  'ws.keepsText':
    'tu tipo de criatura, tus PG y Dados de Golpe, Inteligencia, Sabiduría y Carisma, tus rasgos de clase, idiomas y dotes, y tus competencias en habilidades y salvaciones con tu bonificador (el modificador de la bestia si es mayor).',
  'ws.changes': 'Cambia',
  'ws.changesText':
    'Fuerza, Destreza y Constitución, CA, velocidades, tamaño, sentidos y ataques pasan a ser los de la bestia. Manejas objetos según sus extremidades.',
  'ws.spells.none':
    'No puedes lanzar conjuros (transformarte no rompe tu concentración). CD de conjuros {dc}.',
  'ws.spells.circle':
    'En esta forma solo puedes lanzar tus conjuros del Círculo de la Luna. CD de conjuros {dc}.',
  'ws.spells.all':
    'Puedes lanzar conjuros, salvo los de componente material con coste o que se consume. CD de conjuros {dc}.',
  'ws.fromBeast': 'de la bestia',
  'ws.attacks': 'Ataques de la forma',
  'ws.toughness': '+SAB (Formas de círculo mejoradas)',
};

/** Both languages, for I18nService.extend. */
export const STATES_TEXTS = { en: statesEn, es: statesEs };
