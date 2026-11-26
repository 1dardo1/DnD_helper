import type { assistantEn } from './assistant.en';

/** Textos de la página del asistente de reglas en español (mismas claves que assistant.en.ts). */
export const assistantEs: Record<keyof typeof assistantEn, string> = {
  'assistant.intro':
    'Haz una pregunta de reglas. El asistente busca en el compendio de este dispositivo y, si hay un servicio de IA configurado, redacta una respuesta que cita las entradas que ha usado.',
  'assistant.question': 'Tu pregunta',
  'assistant.placeholder': 'p. ej. ¿Cuánto daño hace Bola de fuego?',
  'assistant.ask': 'Preguntar',
  'assistant.examples': 'Prueba con:',
  'assistant.example1': '¿Cuánto daño hace Bola de fuego?',
  'assistant.example2': '¿Qué hace la acción Esquivar?',
  'assistant.example3': '¿Qué dote me deja sumar mi bonificador de competencia a la Iniciativa?',
  'assistant.searching': 'Buscando en el compendio…',
  'assistant.answering': 'Redactando la respuesta…',
  'assistant.answerTitle': 'Respuesta',
  'assistant.disclaimer':
    'Respuesta generada por IA a partir de las entradas citadas: comprueba las fuentes antes de fiarte.',
  'assistant.model': 'Modelo: {model}',
  'assistant.cited': 'citada',
  'assistant.sources': 'Entradas encontradas',
  'assistant.sourcesHelp':
    'Las entradas del compendio más cercanas a tu pregunta, las mejores primero. La respuesta se redacta solo a partir de ellas.',
  'assistant.noResults': 'No he encontrado entradas relacionadas. Prueba con otras palabras.',
  'assistant.searchOnly':
    'Modo solo búsqueda: no hay un servicio de IA configurado, así que no se redacta respuesta. Abajo tienes las entradas del compendio más cercanas a tu pregunta.',
  'assistant.setUp': 'Configúralo en Ajustes',
  'assistant.retry': 'Reintentar',
  'assistant.error.network':
    'No se ha podido contactar con el servicio de IA (¿sin conexión?). Abajo tienes las entradas encontradas.',
  'assistant.error.timeout':
    'El servicio de IA ha tardado demasiado en responder. Abajo tienes las entradas encontradas.',
  'assistant.error.rate_limited':
    'Demasiadas preguntas por ahora. Espera un momento y vuelve a intentarlo. Abajo tienes las entradas encontradas.',
  'assistant.error.upstream_error':
    'El servicio de IA ha fallado al redactar la respuesta. Abajo tienes las entradas encontradas.',
  'assistant.error.bad_request': 'El servicio de IA no ha aceptado esta pregunta.',
  'assistant.error.too_large':
    'La pregunta o las entradas eran demasiado largas para el servicio de IA.',
  'assistant.error.forbidden':
    'El servicio de IA no acepta peticiones desde esta dirección. Abajo tienes las entradas encontradas.',
  'assistant.error.other':
    'El servicio de IA ha dado una respuesta inesperada. Abajo tienes las entradas encontradas.',
  'assistant.type.spell': 'Conjuro',
  'assistant.type.feat': 'Dote',
  'assistant.type.class': 'Clase',
  'assistant.type.subclass': 'Subclase',
  'assistant.type.option': 'Opción de clase',
  'assistant.type.species': 'Especie',
  'assistant.type.background': 'Trasfondo',
  'assistant.type.item': 'Objeto',
  'assistant.type.monster': 'Monstruo',
  'assistant.type.rule': 'Regla',
};
