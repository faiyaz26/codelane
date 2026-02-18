import { mergeProps } from 'solid-js';

interface GitPullRequestCreateArrowIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
}

function GitPullRequestCreateArrowIcon(props: GitPullRequestCreateArrowIconProps) {
  const merged = mergeProps({
    size: undefined,
    color: '#000000',
    strokeWidth: 2,
    background: 'transparent',
    opacity: 1,
    rotation: 0,
    shadow: 0,
    flipHorizontal: false,
    flipVertical: false,
    padding: 0
  }, props);

  const transforms = () => {
    const t = [];
    if (merged.rotation !== 0) t.push(`rotate(${merged.rotation}deg)`);
    if (merged.flipHorizontal) t.push('scaleX(-1)');
    if (merged.flipVertical) t.push('scaleY(-1)');
    return t.join(' ') || undefined;
  };

  const viewBoxSize = () => 24 + (merged.padding * 2);
  const viewBoxOffset = () => -merged.padding;
  const viewBox = () => `${viewBoxOffset()} ${viewBoxOffset()} ${viewBoxSize()} ${viewBoxSize()}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={merged.size}
      height={merged.size}
      viewBox={viewBox()}
      fill="none"
      style={{
        opacity: merged.opacity,
        transform: transforms(),
        filter: merged.shadow > 0 ? `drop-shadow(0 ${merged.shadow}px ${merged.shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        'background-color': merged.background !== 'transparent' ? merged.background : undefined
      }}
    >
      <g fill="none" stroke={merged.color} stroke-linecap="round" stroke-linejoin="round" stroke-width={merged.strokeWidth}>
        <circle cx="5" cy="6" r="3"/>
        <path d="M5 9v12"/>
        <path d="M15 9l-3-3l3-3"/>
        <path d="M12 6h5a2 2 0 0 1 2 2v3m0 4v6m3-3h-6"/>
      </g>
    </svg>
  );
};

export default GitPullRequestCreateArrowIcon;
