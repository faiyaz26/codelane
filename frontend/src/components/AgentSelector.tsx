import { createSignal, For, Show } from 'solid-js';
import { Select } from '@kobalte/core/select';
import { TextField } from './ui/TextField';
import { Button } from './ui/Button';
import type { AgentConfig, AgentType } from '../types/agent';

interface AgentSelectorProps {
  value: AgentConfig;
  onChange: (config: AgentConfig) => void;
  presets?: Record<string, AgentConfig>;
}

export function AgentSelector(props: AgentSelectorProps) {
  const [envKey, setEnvKey] = createSignal('');
  const [envValue, setEnvValue] = createSignal('');

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
          class="w-full px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue focus:border-transparent"
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

      {/* Command */}
      <TextField
        label="Command"
        placeholder="/bin/zsh"
        value={props.value.command}
        onChange={(value) => props.onChange({ ...props.value, command: value })}
        description="Full path to the executable"
      />

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
