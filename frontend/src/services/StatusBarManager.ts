import { createSignal, type Component } from 'solid-js';

export interface StatusBarItem {
  id: string;
  component: Component;
  alignment: 'left' | 'right';
  priority?: number; // Higher priority = closer to the edge
}

class StatusBarManager {
  private items;
  private setItems;

  constructor() {
    const [items, setItems] = createSignal<StatusBarItem[]>([]);
    this.items = items;
    this.setItems = setItems;
  }

  registerItem(item: StatusBarItem) {
    this.setItems(prev => {
      const filtered = prev.filter(i => i.id !== item.id);
      return [...filtered, item].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    });
  }

  removeItem(id: string) {
    this.setItems(prev => prev.filter(i => i.id !== id));
  }

  getItems() {
    return this.items;
  }
}

export const statusBarManager = new StatusBarManager();
