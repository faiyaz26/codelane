interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  class?: string;
  children?: any;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button(props: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zed-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-zed-bg-app disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses = {
    primary: 'bg-zed-accent-blue hover:bg-zed-accent-blue-hover text-white',
    secondary: 'bg-zed-bg-surface hover:bg-zed-bg-hover border border-zed-border-default text-zed-text-primary',
    danger: 'bg-zed-accent-red hover:bg-zed-accent-red-hover text-white',
    ghost: 'hover:bg-zed-bg-hover text-zed-text-primary',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  const classes = [
    baseClasses,
    variantClasses[props.variant || 'primary'],
    sizeClasses[props.size || 'md'],
    props.class,
  ].filter(Boolean).join(' ');

  return (
    <button
      class={classes}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}
