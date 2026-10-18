import { describe, expect, it } from 'vitest';
import { canAccessScreen, screenOptions } from './screenPermissions';

describe('screen permissions', () => {
  it('allows admins to access every screen', () => {
    expect(screenOptions.every(({ key }) => canAccessScreen({ role: 'admin' }, key))).toBe(true);
  });

  it('only allows a regular user screens granted by the company admin', () => {
    const user = { role: 'user', screen_permissions: ['projects', 'maps'] };
    expect(canAccessScreen(user, 'projects')).toBe(true);
    expect(canAccessScreen(user, 'maps')).toBe(true);
    expect(canAccessScreen(user, 'finance')).toBe(false);
  });

  it('does not grant screens when permission data is absent', () => {
    expect(canAccessScreen({ role: 'engineer' }, 'projects')).toBe(false);
  });
});
