import { remoteStore } from './RemoteStore';

/**
 * AgentChatParser - Parses the rendered terminal screen buffer into chat messages.
 * 
 * By parsing the xterm.js buffer (which has already resolved cursor movements and spinners),
 * we get perfectly clean text without ANSI/redraw noise.
 */
class AgentChatParser {
  private lastParsedLength = 0;

  /**
   * Extract interactive actions from a prompt line
   */
  private extractActions(text: string): { label: string; value: string }[] | undefined {
    const trimmed = text.trim();
    
    const ynMatch = trimmed.match(/[\[\(]([yYnNaAcCrR\/\s]+)[\]\)]/);
    if (ynMatch) {
      const options = ynMatch[1].split('/').map(s => s.trim().toLowerCase());
      const actions = [];
      if (options.includes('y')) actions.push({ label: 'Yes', value: 'y\n' });
      if (options.includes('n')) actions.push({ label: 'No', value: 'n\n' });
      if (options.includes('a')) actions.push({ label: 'All', value: 'a\n' });
      if (options.includes('r')) actions.push({ label: 'Reject', value: 'r\n' });
      if (options.includes('c')) actions.push({ label: 'Cancel', value: '\x03' }); 
      
      if (actions.length > 0) return actions;
    }

    if (/press enter/i.test(trimmed)) {
      return [{ label: 'Enter', value: '\n' }];
    }

    return undefined;
  }

  /**
   * Filters out repetitive TUI noise and scrollback artifacts
   */
  private filterNoise(lines: string[]): string[] {
    return lines.filter(line => {
      const trimmed = line.trim();
      
      // Horizontal dividers (very common in TUIs)
      if (/^[─━_=\-\u2500-\u257F]{5,}$/.test(trimmed)) return false;
      
      // Known Claude Code / Gemini CLI footers
      if (trimmed === '? for shortcuts') return false;
      if (trimmed.startsWith('shift+tab to accept')) return false;
      // Match "X files" or "X GEMINI.md files" footer
      if (/^\d+\s+.*?files?$/.test(trimmed) && trimmed.length < 40) return false;
      
      // Loading spinners stuck in scrollback
      if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/i.test(trimmed) && trimmed.length < 15) return false;

      return true;
    });
  }

  /**
   * Parse the full terminal buffer and update the store.
   * This is called periodically or when data arrives.
   */
  parseBuffer(fullText: string) {
    // Clean up terminal artifacts
    let text = fullText
      .replace(/\s+$/g, '') // Trim trailing whitespace
      .replace(/\n{3,}/g, '\n\n'); // Normalize excessive newlines
    
    if (!text.trim()) return;

    // Detect if we have new content
    if (text.length === this.lastParsedLength) {
      // It might just be a spinner updating the last few chars, we still want to update the live message
    }
    
    this.lastParsedLength = text.length;

    let lines = text.split('\n');
    lines = this.filterNoise(lines);

    const messages: any[] = [];
    
    let currentRole = 'agent';
    let currentContent: string[] = [];
    let currentActions: any = undefined;

    // Very basic heuristic: 
    // If a line starts with $ or ❯, it's a prompt/user input.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for User input markers
      if (trimmed.startsWith('$ ') || trimmed.startsWith('❯ ')) {
        // Finalize previous agent message
        if (currentContent.length > 0) {
          messages.push({ role: currentRole, content: currentContent.join('\n').trim(), actions: currentActions });
          currentContent = [];
          currentActions = undefined;
        }
        
        // Add user message
        messages.push({ role: 'user', content: trimmed.replace(/^[\$❯]\s*/, '') });
        currentRole = 'agent';
        continue;
      }

      // Check for actions on the current line
      const actions = this.extractActions(trimmed);
      if (actions) {
        currentActions = actions;
      }

      currentContent.push(line);
    }

    // Add the final pending message (usually the active agent response)
    if (currentContent.length > 0) {
      messages.push({ role: currentRole, content: currentContent.join('\n').trim(), actions: currentActions });
    }

    // Filter out completely empty messages
    const validMessages = messages.filter(m => m.content.trim().length > 0 || m.actions);

    // Update the store. For simplicity, we just replace the messages array
    // since the buffer contains the full history of the active session.
    // In a production app, we'd map these to unique IDs more carefully.
    
    // Convert to ChatMessage format
    const chatMessages = validMessages.map((m, idx) => ({
      id: `buf-${idx}`,
      role: m.role,
      content: m.content,
      timestamp: Date.now(),
      actions: m.actions
    }));

    remoteStore.setMessages(chatMessages as any);
  }

  reset() {
    this.lastParsedLength = 0;
  }
}

export const agentChatParser = new AgentChatParser();

