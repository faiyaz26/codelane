import { Select as KobalteSelect } from '@kobalte/core/select';
import { splitProps, createSignal, createEffect } from 'solid-js';

interface SelectProps {
  options: any[];
  optionValue: string;
  optionLabel: string;
  value: any; // The selected object
  onChange: (value: any) => void;
  placeholder?: string;
  class?: string;
  triggerClass?: string;
}

export function Select(props: SelectProps) {
  const [local, others] = splitProps(props, ['class', 'triggerClass', 'options', 'optionValue', 'optionLabel', 'value', 'onChange', 'placeholder']);

  return (
    <KobalteSelect
      options={local.options}
      optionValue={local.optionValue}
      optionLabel={local.optionLabel}
      value={local.value}
      onChange={local.onChange}
      placeholder={local.placeholder}
      itemComponent={itemProps => (
        <KobalteSelect.Item
          item={itemProps.item}
          class="flex items-center justify-between px-3 py-2 text-sm text-zed-text-primary cursor-pointer outline-none hover:bg-zed-bg-hover focus:bg-zed-bg-hover transition-colors rounded"
        >
          <KobalteSelect.ItemLabel>{itemProps.item.rawValue[local.optionLabel]}</KobalteSelect.ItemLabel>
          <KobalteSelect.ItemIndicator>
            <svg class="w-4 h-4 text-zed-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
    >
      <KobalteSelect.Trigger
        class={`flex items-center justify-between px-3 h-8 bg-zed-bg-surface border border-zed-border-default rounded text-sm text-zed-text-primary hover:border-zed-border-active transition-all focus:outline-none focus:ring-2 focus:ring-zed-accent-blue/50 ${local.triggerClass || ''}`}
      >
        <KobalteSelect.Value<any>>
          {state => state.selectedOption() ? state.selectedOption()[local.optionLabel] : local.placeholder}
        </KobalteSelect.Value>
        <KobalteSelect.Icon class="ml-2 text-zed-text-tertiary">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content class="z-[60] bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl p-1 min-w-[180px] animate-slide-down">
          <KobalteSelect.Listbox />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  );
}
