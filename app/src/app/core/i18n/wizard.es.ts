import { wizardEn } from './wizard.en';

/** Textos del asistente de creación y de la subida de nivel en español (mismas claves que wizard.en.ts). */
export const wizardEs: Record<keyof typeof wizardEn, string> = {
  'wizard.stepOf': 'Paso {n} de {total}',
  'wizard.steps': 'Pasos',
  'wizard.stepsAria': 'Pasos de la creación',
  'wizard.progress': '{done} de {total} pasos hechos',
  'wizard.state.todo': 'Pendiente',
  'wizard.state.todoN': '{n} por elegir',
  'wizard.state.warn': 'Con avisos',
  'wizard.state.done': 'Completo',
  'wizard.state.optional': 'Opcional',
  'wizard.state.current': 'estás aquí',
  'wizard.back': 'Atrás',
  'wizard.next': 'Siguiente',
  'wizard.skip': 'Saltar',
  'wizard.then': 'después: {step}',
  'wizard.ready': 'Paso listo',
  'wizard.toChoose': '{n} por elegir',
  'wizard.warnings': '{n} aviso(s)',
  'wizard.missingTitle': 'Lo que falta en este paso',
  'wizard.missingHint': 'Puedes seguir y volver luego: no se pierde nada de lo elegido.',
  'wizard.optionalHint': 'Opcional: puedes saltarlo y rellenarlo más tarde en la hoja.',
  'wizard.create': 'Crear personaje',
  'wizard.saveChanges': 'Guardar cambios',
  'wizard.saveLevelUp': 'Guardar la subida de nivel',
  'wizard.why': 'Por qué este paso y cómo funciona',
  'wizard.step.spells': 'Conjuros',
  'wizard.step.hp': 'Puntos de golpe',
  'wizard.step.detailsNew': 'Revisar y crear',
  'wizard.step.detailsEdit': 'Revisar y guardar',

  'wizard.lead.class':
    'Tu clase es tu oficio de aventurero: decide tus puntos de golpe, con qué armas y armaduras sabes luchar, tus salvaciones y si lanzas conjuros. Elige el nivel con el que empiezas; añade otra clase solo si multiclaseas.',
  'wizard.why.class':
    'Va primero porque casi todo depende de ella: qué características necesitas más, qué habilidades puedes elegir y tu equipo inicial. La mayoría de clases eligen su subclase a nivel 3.',
  'wizard.lead.background':
    'Tu trasfondo es lo que hacías antes de aventurar. Te da una dote de origen, dos habilidades, una herramienta, equipo y +3 a repartir entre tres características.',
  'wizard.why.background':
    'El bono de trasfondo son +2 a una y +1 a otra de sus tres características (o +1 a las tres). Se suma a las puntuaciones que pondrás en el paso Características: suele ir a la característica principal de tu clase ({primary}).',
  'wizard.lead.species':
    'Tu especie te da rasgos de nacimiento: tamaño, velocidad, sentidos como la visión en la oscuridad, resistencias y a veces conjuros o una dote. Aquí eliges también dos idiomas además del Común.',
  'wizard.why.species':
    'En las reglas de 2024 la especie ya no sube características (lo hace el trasfondo), así que puedes elegirla por sus rasgos y por el personaje que imaginas.',
  'wizard.lead.abilities':
    'Fuerza, Destreza, Constitución, Inteligencia, Sabiduría y Carisma: cada una da un modificador que se suma a tus tiradas. Pon aquí las puntuaciones base; el bono del trasfondo ya va sumado en el total.',
  'wizard.why.abilities':
    'Va después de clase y trasfondo para que sepas cuál es tu característica principal y dónde cayó el bono. Elige un método: el array estándar (seis valores fijos), la compra de puntos (27 puntos, cada valor cuesta) o escribirlas si tu DM os deja tirar dados.',
  'wizard.lead.hp':
    'Tus puntos de golpe máximos: el dado de golpe de cada nivel de clase más tu modificador de Constitución en cada nivel. Elige para cada nivel cómo se obtiene: tirar el dado, la media o escribir un valor.',
  'wizard.why.hp':
    'Va después de las características porque la Constitución cuenta en cada nivel. Por regla, el nivel 1 de tu primera clase da el máximo del dado; el resto, la tirada o la media que use tu mesa.',
  'wizard.lead.choices':
    'Lo que te deja elegir tu clase: habilidades, pericia, maestría de armas, herramientas, las dotes de tus niveles y opciones de clase (invocaciones, maniobras, planos...).',
  'wizard.why.choices':
    'Va después de las características porque algunas dotes y opciones las piden (FUE 13...). Las competencias que ya tienes por el trasfondo o la especie aparecen marcadas.',
  'wizard.lead.spells':
    'Los trucos se lanzan a voluntad; los conjuros preparados gastan espacios de conjuro. Cada clase tiene su propia cuenta, según su tabla y su nivel.',
  'wizard.why.spells':
    'Solo salen los conjuros de tu lista hasta el nivel de espacio que alcanzas. Los conjuros que te dan la especie o las dotes ya están en la hoja y no cuentan aquí.',
  'wizard.lead.equipment':
    'Elige el paquete inicial de tu clase y el de tu trasfondo (o quédate el oro y compra en la tienda), y qué armadura llevas puesta.',
  'wizard.why.equipment':
    'Es opcional: puedes saltarlo y apuntar el equipo más tarde en la hoja. La armadura y el escudo cambian tu CA en el resumen.',
  'wizard.lead.details':
    'Revisa la hoja tal como quedará, ponle nombre y guárdala. Lo que falte sale abajo: tócalo para ir a resolverlo.',
  'wizard.why.details':
    'Puedes crear el personaje aunque falte algo y terminarlo más tarde editándolo; los avisos seguirán en la hoja.',
  'wizard.lead.levelUp':
    'Elige solo lo que trae el nivel nuevo. El resumen enseña la hoja antes y después.',

  'wizard.summary': 'Tu personaje',
  'wizard.summary.open': 'Ver el resumen',
  'wizard.summary.unnamed': 'Sin nombre',
  'wizard.summary.noClass': 'Sin clase todavía',
  'wizard.summary.pending': 'pendiente',
  'wizard.summary.goTo': 'Ir a {step}',
  'wizard.summary.unset': 'sin decidir',
  'wizard.summary.abilitiesUnset': 'Se deciden en el paso Características.',
  'wizard.summary.combat': 'Combate',
  'wizard.summary.hpDice': '{dice} de dados + {con} de CON',
  'wizard.summary.hpOther': ' + {n} de otros',
  'wizard.summary.feats': 'Dotes',
  'wizard.summary.from.background': 'trasfondo',
  'wizard.summary.from.species': 'especie',
  'wizard.summary.from.class': '{cls} {level}',
  'wizard.summary.none': 'ninguna todavía',
  'wizard.summary.spellsOf': '{cls}: {cantrips} trucos · {prepared} preparados',
  'wizard.summary.spellDc': 'CD {dc}, ataque {attack}',
  'wizard.summary.items': '{n} objetos',
  'wizard.summary.noItems': 'Sin equipo todavía (opcional)',
  'wizard.summary.attacksNone': 'Sin armas todavía',
  'wizard.summary.hpShort': 'PG',
  'wizard.summary.acShort': 'CA',
  'wizard.summary.pb': 'Bon. competencia',
  'wizard.summary.ft': 'pies',
  'wizard.summary.speedFt': '{n} pies',
  'wizard.summary.expertise': 'pericia',

  'wizard.review.pending': 'Lo que falta',
  'wizard.review.allDone': 'Está todo elegido: tu personaje está listo.',
  'wizard.review.goTo': 'ir',
  'wizard.review.identity': 'Nombre y carpeta',
  'wizard.review.folder': 'Carpeta (opcional)',
  'wizard.review.folderHint': 'Para agruparlo en la lista de personajes.',
  'wizard.review.sheet': 'La hoja tal como quedará',

  'wizard.info.atLevel': 'Hasta tu nivel {level}',
  'wizard.info.later': 'Niveles siguientes',
  'wizard.info.features': 'Rasgos por nivel',
  'wizard.info.proficiencies': 'Competencias',
  'wizard.info.hitDie': 'Dado de golpe',
  'wizard.info.hpFirst': 'Puntos de golpe a nivel 1: {die} + CON',
  'wizard.info.skillsChoose': 'Habilidades: elige {n} de {list}',
  'wizard.info.multiclass': 'Para multiclasear en ella: {what}',
  'wizard.info.primary': 'Característica principal',
  'wizard.info.casterYes': 'Lanzamiento de conjuros',
  'wizard.info.description': 'Descripción',
  'wizard.info.featText': 'Qué hace la dote {feat}',
  'wizard.info.subclassFeatures': 'Qué te da',
  'wizard.info.or': '{a} o {b}',
  'wizard.info.prerequisite': 'Requisito',

  'wizard.bg.hint': 'La característica principal de tu clase es {primary}: ahí suele ir el +2.',
  'wizard.bg.youGet': 'Lo que te da este trasfondo',
  'wizard.ab.methodHelp.standard': 'Reparte 15, 14, 13, 12, 10 y 8, uno a cada característica.',
  'wizard.ab.methodHelp.point-buy':
    'Todas empiezan en 8 y tienes 27 puntos: 9 = 1, 10 = 2, 11 = 3, 12 = 4, 13 = 5, 14 = 7, 15 = 9.',
  'wizard.ab.methodHelp.manual':
    'Escribe los valores que sacaste (lo normal: 4d6 quitando el dado más bajo).',
  'wizard.ab.base': 'Base',
  'wizard.ab.bonus': 'Bono',
  'wizard.ab.total': 'Total',
  'wizard.ab.primary': 'principal de {cls}',
  'wizard.ab.multiclassNeed': '{cls} pide {min}',
  'wizard.ab.bonusFrom': 'trasfondo',
  'wizard.ab.left': 'Te quedan {n} puntos',

  'wizard.hp.total': 'Puntos de golpe máximos',
  'wizard.hp.formula': '{dice} (dados) {con} (Constitución × {levels}){other} = {total}',
  'wizard.hp.other': ' + {n} (dotes y rasgos)',
  'wizard.hp.all': 'Para todos los niveles a la vez',
  'wizard.hp.rollAll': '🎲 Tirar todos los niveles',
  'wizard.hp.averageAll': 'Media en todos',
  'wizard.hp.writeTotal': 'Escribir el total a mano',
  'wizard.hp.totalLabel': 'El máximo que quieres',
  'wizard.hp.spread': 'Repartir entre los niveles',
  'wizard.hp.spreadHint':
    'Se reparte entre los niveles como valores fijos (lo más igualado que permiten los dados); el nivel 1 mantiene el máximo de la regla.',
  'wizard.hp.spreadOff': 'Los dados no llegan justo: se queda en {got} ({off}).',
  'wizard.hp.firstRule': 'Regla estándar: el nivel 1 de tu primera clase da el máximo del dado.',
  'wizard.hp.firstMax': 'Máximo del dado ({die}) — regla estándar',
  'wizard.hp.houseRule': 'regla de la casa',
  'wizard.hp.firstNotRolled': 'Sin tirar: mientras tanto cuenta el máximo ({die}).',
  'wizard.hp.ofClass': '{cls} (d{die})',
  'wizard.hp.noClass': 'Elige antes una clase: los puntos de golpe salen de su dado de golpe.',

  'wizard.choices.inStep': 'En este paso',
  'wizard.mastery.property': 'maestría: {m}',

  'create.missing.cantrips': '{cls}: elige {count} truco(s) más.',
  'create.missing.spells': '{cls}: elige {count} conjuro(s) preparado(s) más.',
  'create.missing.hpRoll': '{cls} nivel {level}: tira el dado de golpe (aún sin tirar).',
};
