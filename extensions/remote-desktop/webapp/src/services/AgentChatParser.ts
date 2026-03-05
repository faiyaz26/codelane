import { remoteStore } from './RemoteStore';

/**
 * AgentChatParser - Parses raw terminal output into high-level chat messages.
 * 
 * Optimized to handle 'spinning' text and status lines common in modern agents.
 */
class AgentChatParser {
  private buffer = '';
  private lastMessageTime = Date.now();
  private messageDebounce = 1500; // ms to group rapid outputs
  private hasLiveMessage = false;

  /**
   * Strip ANSI escape codes
   */
  private stripAnsi(text: string): string {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }

  /**
   * Extract interactive actions from a prompt line (e.g. [y/n/A/r])
   */
  private extractActions(text: string): { label: string; value: string }[] | undefined {
    const trimmed = text.trim();
    
    // Pattern: [y/N] or (y/n) or [Y/n/a/c]
    const ynMatch = trimmed.match(/[\[\(]([yYnNaAcCrR\/\s]+)[\]\)]/);
    if (ynMatch) {
      const options = ynMatch[1].split('/').map(s => s.trim().toLowerCase());
      const actions = [];
      if (options.includes('y')) actions.push({ label: 'Yes', value: 'y\n' });
      if (options.includes('n')) actions.push({ label: 'No', value: 'n\n' });
      if (options.includes('a')) actions.push({ label: 'All', value: 'a\n' });
      if (options.includes('r')) actions.push({ label: 'Reject', value: 'r\n' });
      if (options.includes('c')) actions.push({ label: 'Cancel', value: '\x03' }); // Ctrl+C
      
      if (actions.length > 0) return actions;
    }

    // Pattern: "Press Enter to continue"
    if (/press enter/i.test(trimmed)) {
      return [{ label: 'Enter', value: '\n' }];
    }

    return undefined;
  }

  /**
   * Process new raw data from the terminal
   */
  processData(bytes: Uint8Array) {
    const text = new TextDecoder().decode(bytes);
    const clean = this.stripAnsi(text);
    
    // Ignore pure empty space/control noise
    if (!clean.trim()) return;

    const now = Date.now();
    const isRapid = (now - this.lastMessageTime < this.messageDebounce);

    // If we're receiving data rapidly, append to buffer and update the 'live' message
    if (isRapid && this.hasLiveMessage) {
      this.buffer += clean;
      
      const content = this.cleanStatusLines(this.buffer);
      if (content) {
        remoteStore.updateLastMessage(content);
        
        // Live check for prompt actions
        const actions = this.extractActions(this.buffer);
        if (actions) {
          remoteStore.updateLastMessageActions(actions);
          this.hasLiveMessage = false; // Finalize message since it's a prompt
          this.buffer = '';
        }
      }
    } else {
      // New message block started
      if (this.buffer.trim()) {
        this.buffer = '';
      }
      this.buffer = clean;
      const content = this.cleanStatusLines(this.buffer);
      const actions = this.extractActions(this.buffer);
      
      remoteStore.addMessage({ 
        role: 'agent', 
        content,
        actions 
      });
      
      this.hasLiveMessage = !actions;
      if (actions) this.buffer = '';
    }

    this.lastMessageTime = now;
  }

  /**
   * Cleans up common terminal status noise (spinners, memory counts)
   */
  private cleanStatusLines(text: string): string {
    // Split by lines and only take unique-ish lines to avoid spinner trails
    const lines = text.split(/\r?\n/);
    const result = [];
    let lastLine = '';

    for (const line of lines) {
      let trimmed = line.trim();
      if (!trimmed) continue;
      
      // If line is just a number/unit (common for memory usage), 
      // or if it's very similar to last line, skip it
      const isStatusNoise = /^[0-9.]+\s*(MB|GB|KB|%)$/.test(trimmed);
      if (isStatusNoise) continue;

      if (trimmed !== lastLine) {
        result.push(line);
        lastLine = trimmed;
      }
    }

    return result.join('\n').trim();
  }

  reset() {
    this.buffer = '';
    this.lastMessageTime = 0;
    this.hasLiveMessage = false;
  }
}

export const agentChatParser = new AgentChatParser();

