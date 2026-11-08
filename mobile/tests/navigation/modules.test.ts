import { MODULES, MORE, TABBED, moduleFor } from '@/navigation/modules';

describe('modules', () => {
  it('lists the modules in the web navigation order', () => {
    expect(MODULES.map((m) => m.key)).toEqual([
      'dashboard',
      'finance',
      'fitness',
      'time',
      'insights',
      'gaming',
    ]);
  });

  it('gives the first four a tab and puts the rest behind More', () => {
    expect(TABBED.map((m) => m.key)).toEqual(['dashboard', 'finance', 'fitness', 'time']);
    expect(MORE.map((m) => m.key)).toEqual(['insights', 'gaming']);
  });

  it('says when every unbuilt module lands and what it will do', () => {
    for (const entry of MODULES) {
      if (entry.status === 'soon') {
        expect(entry.release).not.toBe('');
        expect(entry.planned.length).toBeGreaterThan(0);
      } else if (entry.status === 'web') {
        expect(entry.webPath).toMatch(/^\//);
      }
    }
  });

  it('has Finance in the app now, with its own screens rather than a placeholder', () => {
    expect(moduleFor('finance').status).toBe('app');
  });

  it('refuses an unknown module rather than rendering a blank screen', () => {
    expect(() => moduleFor('steps')).toThrow('No module steps');
  });
});
