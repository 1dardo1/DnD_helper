import { plainPreview } from './entry-labels.service';

describe('plainPreview', () => {
  it('strips markdown and cuts long texts at a word', () => {
    expect(plainPreview('**Bonus.** You gain a [+2](x) bonus.\n\n- one\n- two')).toBe(
      'Bonus. You gain a +2 bonus. one two',
    );
    expect(plainPreview('word '.repeat(60), 22)).toBe('word word word word…');
  });
});
