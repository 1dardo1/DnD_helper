import kriugRaw from '../../../../../characters/kriug-1793958485566.json';
import orenRaw from '../../../../../characters/oren-bianic-1793811890281.json';
import kassRaw from '../../../../../characters/kassasdin-1793879600138.json';
import sibylRaw from '../../../../../characters/sibyl-1793915635728.json';
import rulesRaw from '../../../../../data/rules.json';
import { weaponEntriesOf } from '../characters/weapons';
import { normalizeCharacter } from '../models/character';
import { Rule } from '../models/compendium';
import { playResources } from '../play/play-state';
import { attacksFor } from '../rules/attacks';
import { computeSheet } from '../rules/engine';
import { REAL, REAL_SPELLS } from '../rules/real-data.testing';
import { combatRows } from './combat-actions';

describe('dump', () => {
  it('prints', () => {
    const spells = new Map(REAL_SPELLS.map((s) => [s.id, s]));
    const rules = (rulesRaw as unknown as Rule[]).filter((r) => r.category === 'actions');
    for (const raw of [orenRaw, kriugRaw, kassRaw, sibylRaw]) {
      const ch = normalizeCharacter(raw)!;
      const sheet = computeSheet(ch, REAL);
      const rows = combatRows({
        sheet,
        character: ch,
        data: REAL,
        attacks: attacksFor(sheet, weaponEntriesOf(ch.inventory, REAL.items)),
        spells,
        rules,
        resources: playResources(sheet),
      });
      const lines = rows.map(
        (r) =>
          `${r.kind.padEnd(8)} ${r.section.padEnd(16)} ${r.timing.padEnd(8)} ${(r.nameKey ?? r.name) + (r.part ? ' / ' + r.part : '')} | ${r.cost ? JSON.stringify(r.cost) : ''} | ${r.line.map((l) => (l.k === 'sentence' ? l.text.slice(0, 70) : JSON.stringify(l))).join(' ; ')}`,
      );
      (globalThis as any).process.stdout.write(`\n===== ${ch.name}\n` + lines.join('\n'));
      const used = new Set(rows.map((r) => r.name));
      (globalThis as any).process.stdout.write(
        'NOT CLASSIFIED: ' +
          sheet.features
            .filter((f) => !used.has(f.name))
            .map((f) => `${f.source.type}:${f.name}`)
            .join(', '),
      );
    }
    expect(true).toBe(true);
  });
});
