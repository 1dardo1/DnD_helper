import { farFromTop } from './back-to-top';

describe('back to top', () => {
  it('appears after a screen and a half of scroll', () => {
    expect(farFromTop(0, 800)).toBe(false);
    expect(farFromTop(1200, 800)).toBe(false);
    expect(farFromTop(1201, 800)).toBe(true);
  });
});
