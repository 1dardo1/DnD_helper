/**
 * How a rule text says it is used in combat, read from the text itself (deterministic: the same
 * phrases of the 2024 rules always give the same answer). Pure; no Angular.
 *
 *   action   "As a Magic action", "take a Magic action", "as an action", "take the Utilize action"
 *   bonus    "As a Bonus Action", "take a Bonus Action to", "Bonus Action, which you take..."
 *   reaction "take a Reaction", "use your Reaction", "Reaction, which you take when..."
 *   attack   part of an attack you already make: "as part of the Attack action", "whenever you
 *            take the Attack action", "when you hit a creature with an attack roll... you can"
 *   free     no action: "(no action required)" as the way to use it, or a trigger that lets you do
 *            something ("If you fail an ability check..., you can roll")
 */
export type Timing = 'action' | 'bonus' | 'reaction' | 'attack' | 'free';

export const TIMINGS: readonly Timing[] = ['action', 'bonus', 'reaction', 'attack', 'free'];

/** A sentence that says how something is used, and what it says. */
export interface Use {
  timing: Timing;
  /** The sentence (as written, Markdown marks removed) that says it. */
  sentence: string;
  /** Index of that sentence in sentencesOf(text). */
  index: number;
}

// Restrictions ("you can't take Reactions", "it can't take actions") are not uses.
const NEGATED =
  /\b(?:can't|cannot|can not|don't|doesn't|no longer|without (?:using|taking))\b[^.]{0,30}$/i;

const RULES: { timing: Timing; re: RegExp }[] = [
  {
    timing: 'reaction',
    re: /\b(?:take|takes|taking|use|uses|using|expend|spend)\s+(?:a|your|its|one)\s+Reaction\b|\bas\s+(?:a|your)\s+Reaction\b|\bReaction,?\s+which\s+you\s+take\b|\bReaction\s+to\s+\w|\breaction\s+when\b/i,
  },
  {
    timing: 'bonus',
    re: /\b(?:as|take|takes|taking|use|uses|using|spend|expend)\s+(?:a|your|one)\s+Bonus\s+Action\b|\bBonus\s+Action,?\s+which\s+you\s+take\b|\bBonus\s+Action\s+to\s+\w|\bas\s+a\s+Bonus\s+Action\b/i,
  },
  {
    timing: 'action',
    re: /\b(?:as|take|takes|taking|use|uses|using)\s+(?:a|an|the|your)\s+(?:Magic|Utilize)\s+action\b|\bas\s+an\s+action\b|\buse\s+your\s+action\b|\b(?:Magic|Utilize)\s+action\s+to\s+\w/i,
  },
  {
    // part of an attack you already make (the Attack action, a hit, the damage of a hit)
    timing: 'attack',
    re: /\bas\s+part\s+of\s+(?:the|your|that|an?)\s+Attack\s+action\b|\bwhen(?:ever)?\s+you\s+take\s+the\s+Attack\s+action\b|\binstead\s+of\s+(?:one|each|any)\s+of\s+(?:your|the|those)\s+attacks\b|\breplace\s+(?:one|any)\s+of\s+the\s+attacks\b|^(?=.*\byou\s+can\b).*\b(?:when|whenever|immediately\s+after|after)\s+you\s+(?:hit|damage|deal\s+damage\s+to)\s+(?:a|an|the|one)\s+(?:creature|target|enemy)\b|\b(?:creature|target)\s+you\s+hit\s+with\s+an\s+attack\b|\bonce\s+(?:per|on\s+each\s+of\s+your)\s+turns?,?\s+when\s+you\s+hit\b/i,
  },
  {
    // no action: a trigger that lets you do something, "(no action required)", movement spent
    timing: 'free',
    re: /^(?=.*\byou\s+can\b)(?!.*\b(?:finish(?:es)?\s+a\s+(?:Short|Long)\s+Rest|reach\s+(?:character\s+)?level|gain\s+a\s+level|cast\s+(?:a|this|that)\s+spell)\b).*\b(?:if|when|whenever)\s+(?:you|a\s+creature|an?\s+(?:ally|enemy|attacker))\s+(?:fail|fails|miss|misses|roll|rolls|are|would|drop|start|make|makes|take|takes|hit|hits)\b|^[^.]*\bno\s+action\s+required\b|\bspend\s+\d+\s+feet\s+of\s+movement\b/i,
  },
];

/** The text without Markdown marks (bold, italics, headings, table bars), lines joined. */
export function plain(text: string): string {
  return text
    .replace(/\*+/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\|/g, ' . ')
    .replace(/[ \t]+/g, ' ');
}

/** Sentences of a text (also split at paragraph breaks and table cells). */
export function sentencesOf(text: string): string[] {
  return plain(text)
    .split(/\n+|(?<=[.!?:;])\s+(?=[A-Z¿¡ÁÉÍÓÚÑ"“(])/)
    .map((s) => s.replace(/^[\s.]+/, '').trim())
    .filter((s) => s.length > 1);
}

/** How the text says it is used, one Use per timing (its first sentence). */
export function usesOf(text: string): Use[] {
  const sentences = sentencesOf(text);
  const found = new Map<Timing, Use>();
  sentences.forEach((sentence, index) => {
    for (const { timing, re } of RULES) {
      if (found.has(timing)) continue;
      const m = re.exec(sentence);
      if (!m) continue;
      if (NEGATED.test(sentence.slice(0, m.index))) continue;
      found.set(timing, { timing, sentence, index });
    }
  });
  // "no action required" / a trigger is the way to use it only when nothing else is said
  // (Psychic Veil: a Magic action, dismissed with no action required)
  if (found.size > 1) found.delete('free');
  return TIMINGS.filter((t) => found.has(t)).map((t) => found.get(t)!);
}

/** A part of a feature: its intro, or a paragraph that starts with a bold label ("**Name.**"). */
export interface Block {
  /** The label, without its final "." or ":"; null for the intro (the feature itself). */
  label: string | null;
  text: string;
}

// "**Name.** text" or "**Name:** text" (a bold line alone, "**Swarm Appearance**", is a title)
const LABEL = /^\s*\*{2,3}([^*\n]{2,60}?)(?:[.:]\*{2,3}|\*{2,3}[.:])[ \t]*(?=\S)/;

/**
 * The feature's intro and its labelled parts. A label only starts a part at the beginning of a
 * paragraph (or of a line after a line break); the rest stays with the part before it.
 */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [{ label: null, text: '' }];
  for (const para of text.split(
    /\n(?=\s*\*{2,3}[^*\n]{2,60}?(?:[.:]\*{2,3}|\*{2,3}[.:])[ \t]*\S)/,
  )) {
    const m = LABEL.exec(para);
    if (m && blocks.length && para.trim()) {
      blocks.push({ label: m[1].trim(), text: para.slice(m[0].length).trim() });
    } else {
      blocks[blocks.length - 1].text += (blocks[blocks.length - 1].text ? '\n' : '') + para;
    }
  }
  return blocks.filter((b, i) => i === 0 || b.text.trim());
}
