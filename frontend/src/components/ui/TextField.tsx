import { TextField as KobalteTextField } from '@kobalte/core/text-field';

interface TextFieldProps {
  label?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  value?: string;
  onChange?: (value: string) => void;
  class?: string;
}

export function TextField(props: TextFieldProps) {
  return (
    <KobalteTextField
      class={props.class}
      value={props.value}
      onChange={props.onChange}
      validationState={props.errorMessage ? 'invalid' : 'valid'}
    >
      {props.label && (
        <KobalteTextField.Label class="block text-sm font-medium text-zed-text-primary mb-2">
          {props.label}
        </KobalteTextField.Label>
      )}
      <KobalteTextField.Input
        placeholder={props.placeholder}
        class={`w-full px-3 py-2 bg-zed-bg-surface border rounded-md text-zed-text-primary placeholder:text-zed-text-tertiary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue focus:border-transparent transition-colors ${
          props.errorMessage ? 'border-zed-accent-red' : 'border-zed-border-default'
        }`}
      />
      {props.description && (
        <KobalteTextField.Description class="mt-1 text-xs text-zed-text-tertiary">
          {props.description}
        </KobalteTextField.Description>
      )}
      {props.errorMessage && (
        <KobalteTextField.ErrorMessage class="mt-1 text-xs text-zed-accent-red">
          {props.errorMessage}
        </KobalteTextField.ErrorMessage>
      )}
    </KobalteTextField>
  );
}
