import { TextField as KobalteTextField } from '@kobalte/core/text-field';
import { JSX, splitProps } from 'solid-js';

interface TextFieldProps extends KobalteTextField.TextFieldRootProps {
  label?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
}

export function TextField(props: TextFieldProps) {
  const [local, others] = splitProps(props, ['label', 'placeholder', 'description', 'errorMessage', 'class']);

  return (
    <KobalteTextField.Root class={local.class} {...others} validationState={local.errorMessage ? 'invalid' : 'valid'}>
      {local.label && (
        <KobalteTextField.Label class="block text-sm font-medium text-zed-text-primary mb-2">
          {local.label}
        </KobalteTextField.Label>
      )}
      <KobalteTextField.Input
        placeholder={local.placeholder}
        class="w-full px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary placeholder:text-zed-text-tertiary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue focus:border-transparent transition-colors data-[invalid]:border-zed-accent-red"
      />
      {local.description && (
        <KobalteTextField.Description class="mt-1 text-xs text-zed-text-tertiary">
          {local.description}
        </KobalteTextField.Description>
      )}
      {local.errorMessage && (
        <KobalteTextField.ErrorMessage class="mt-1 text-xs text-zed-accent-red">
          {local.errorMessage}
        </KobalteTextField.ErrorMessage>
      )}
    </KobalteTextField.Root>
  );
}
