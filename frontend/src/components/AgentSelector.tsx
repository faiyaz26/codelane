import { createSignal, For, Show, createEffect } from 'solid-js';
import { Select } from '@kobalte/core/select';
import { TextField } from './ui/TextField';
import { Button } from './ui/Button';
import type { AgentConfig, AgentType } from '../types/agent';
import { checkCommandExists } from '../lib/settings-api';

interface AgentSelectorProps {
  value: AgentConfig;
  onChange: (config: AgentConfig) => void;
  presets?: Record<string, AgentConfig>;
  onValidationChange?: (isValid: boolean) => void;
}

export function AgentSelector(props: AgentSelectorProps) {
  const [envKey, setEnvKey] = createSignal('');
  const [envValue, setEnvValue] = createSignal('');
  const [commandExists, setCommandExists] = createSignal<boolean | null>(null);
  const [isChecking, setIsChecking] = createSignal(false);

  // Check if command exists when it changes
  createEffect(async () => {
    const command = props.value.command;
    if (!command || command.trim() === '') {
      setCommandExists(null);
      props.onValidationChange?.(false);
      return;
    }

    setIsChecking(true);
    const result = await checkCommandExists(command);
    const exists = result !== null;
    setCommandExists(exists);
    setIsChecking(false);

    // Notify parent of validation state
    // For shell agent, always valid; for others, depends on command existence
    const isValid = props.value.agentType === 'shell' || exists;
    props.onValidationChange?.(isValid);
  });

  const handleAgentTypeChange = (type: AgentType) => {
    // When changing agent type, apply preset if available
    const preset = props.presets?.[type];
    if (preset) {
      props.onChange(preset);
    } else {
      props.onChange({ ...props.value, agentType: type });
    }
  };

  const handleAddEnvVar = () => {
    const key = envKey().trim();
    const value = envValue().trim();
    if (key && value) {
      props.onChange({
        ...props.value,
        env: { ...props.value.env, [key]: value },
      });
      setEnvKey('');
      setEnvValue('');
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    const newEnv = { ...props.value.env };
    delete newEnv[key];
    props.onChange({ ...props.value, env: newEnv });
  };

  const handleArgsChange = (argsString: string) => {
    // Split by spaces, but respect quoted strings
    const args = argsString.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg =>
      arg.replace(/^"(.*)"$/, '$1')
    ) || [];
    props.onChange({ ...props.value, args });
  };

  return (
    <div class="space-y-4">
      {/* Agent Type Selector */}
      <div>
        <label class="block text-sm font-medium text-zed-text-primary mb-2">
          Agent Type
        </label>
        <select
          class="w-full h-10 px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue focus:border-transparent"
          value={props.value.agentType}
          onChange={(e) => handleAgentTypeChange(e.currentTarget.value as AgentType)}
        >
          <option value="shell">Shell (Traditional Terminal)</option>
          <option value="claude">Claude Code CLI</option>
          <option value="cursor">Cursor CLI</option>
          <option value="aider">Aider CLI</option>
        </select>
        <p class="mt-1 text-xs text-zed-text-tertiary">
          Select which CLI agent to use for this configuration
        </p>
      </div>

      {/* Command with status indicator */}
      <div>
        <label class="block text-sm font-medium text-zed-text-primary mb-2">
          Command
        </label>
        <div class="flex gap-2">
          <div class="flex-1 relative">
            <input
              type="text"
              class="w-full px-3 py-2 pr-10 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue focus:border-transparent"
              placeholder="/bin/zsh"
              value={props.value.command}
              onInput={(e) => props.onChange({ ...props.value, command: e.currentTarget.value })}
            />
            {/* Status indicator */}
            <div class="absolute right-3 top-1/2 -translate-y-1/2">
              <Show when={isChecking()}>
                <div class="w-4 h-4 border-2 border-zed-accent-blue border-t-transparent rounded-full animate-spin" />
              </Show>
              <Show when={!isChecking() && commandExists() === true}>
                <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              </Show>
              <Show when={!isChecking() && commandExists() === false}>
                <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </Show>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const agentName = props.value.agentType;
              const result = await checkCommandExists(agentName);
              if (result) {
                props.onChange({ ...props.value, command: result });
              }
            }}
            class="px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary hover:bg-zed-bg-hover transition-colors text-sm"
            title="Auto-detect command path"
          >
            Detect
          </button>
        </div>
        <p class="mt-1 text-xs text-zed-text-tertiary">
          Full path to the executable
          <Show when={commandExists() === false}>
            <span class="text-red-500 ml-2">⚠ Command not found in PATH</span>
          </Show>
          <Show when={commandExists() === true}>
            <span class="text-green-500 ml-2">✓ Command found</span>
          </Show>
        </p>
      </div>

      {/* Arguments */}
      <TextField
        label="Arguments"
        placeholder="-l -i"
        value={props.value.args.join(' ')}
        onChange={handleArgsChange}
        description="Space-separated command-line arguments"
      />

      {/* Use Lane CWD */}
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          id="useLaneCwd"
          checked={props.value.useLaneCwd}
          onChange={(e) => props.onChange({ ...props.value, useLaneCwd: e.currentTarget.checked })}
          class="w-4 h-4 rounded border-zed-border-default bg-zed-bg-surface text-zed-accent-blue focus:ring-2 focus:ring-zed-accent-blue"
        />
        <label for="useLaneCwd" class="text-sm text-zed-text-primary">
          Use lane's working directory
        </label>
      </div>

      {/* Environment Variables */}
      <div>
        <label class="block text-sm font-medium text-zed-text-primary mb-2">
          Environment Variables
        </label>
        <div class="space-y-2">
          {/* Existing env vars */}
          <Show when={Object.keys(props.value.env).length > 0}>
            <div class="space-y-1">
              <For each={Object.entries(props.value.env)}>
                {([key, value]) => (
                  <div class="flex items-center gap-2 p-2 bg-zed-bg-surface rounded border border-zed-border-default">
                    <code class="flex-1 text-xs text-zed-text-primary font-mono">
                      {key}={value}
                    </code>
                    <button
                      onClick={() => handleRemoveEnvVar(key)}
                      class="text-zed-text-tertiary hover:text-zed-accent-red transition-colors"
                      title="Remove"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Add new env var */}
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="KEY"
              value={envKey()}
              onInput={(e) => setEnvKey(e.currentTarget.value)}
              class="flex-1 px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary placeholder:text-zed-text-tertiary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue"
            />
            <input
              type="text"
              placeholder="value"
              value={envValue()}
              onInput={(e) => setEnvValue(e.currentTarget.value)}
              class="flex-1 px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary placeholder:text-zed-text-tertiary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddEnvVar}
              disabled={!envKey().trim() || !envValue().trim()}
            >
              Add
            </Button>
          </div>
          <p class="text-xs text-zed-text-tertiary">
            Additional environment variables to set for the agent
          </p>
        </div>
      </div>
    </div>
  );
}
