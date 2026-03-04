import { describe, it, expect, beforeEach } from 'vitest';
import { statusBarManager } from '../StatusBarManager';

describe('StatusBarManager', () => {
  // Can't easily reset a singleton, so we'll use unique IDs for each test
  
  it('registers an item and sorts by priority', () => {
    statusBarManager.registerItem({
      id: 'item1',
      alignment: 'right',
      component: () => null,
      priority: 10
    });
    
    statusBarManager.registerItem({
      id: 'item2',
      alignment: 'right',
      component: () => null,
      priority: 20
    });

    const items = statusBarManager.getItems()();
    const rightItems = items.filter(i => i.id === 'item1' || i.id === 'item2');
    
    expect(rightItems[0].id).toBe('item2'); // Higher priority first
    expect(rightItems[1].id).toBe('item1');
  });

  it('removes an item', () => {
    statusBarManager.registerItem({
      id: 'item-to-remove',
      alignment: 'left',
      component: () => null
    });

    let items = statusBarManager.getItems()();
    expect(items.find(i => i.id === 'item-to-remove')).toBeDefined();

    statusBarManager.removeItem('item-to-remove');
    
    items = statusBarManager.getItems()();
    expect(items.find(i => i.id === 'item-to-remove')).toBeUndefined();
  });
});
