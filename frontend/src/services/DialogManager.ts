import { createSignal, type Component } from 'solid-js';

export interface DialogOptions {
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  component: Component<any> | HTMLElement;
  props?: any;
}

class DialogManager {
  private activeDialog;
  private setActiveDialog;

  constructor() {
    const [activeDialog, setActiveDialog] = createSignal<DialogOptions | null>(null);
    this.activeDialog = activeDialog;
    this.setActiveDialog = setActiveDialog;
  }

  open(options: DialogOptions) {
    this.setActiveDialog(options);
  }

  close() {
    this.setActiveDialog(null);
  }

  getActiveDialog() {
    return this.activeDialog;
  }
}

export const dialogManager = new DialogManager();
