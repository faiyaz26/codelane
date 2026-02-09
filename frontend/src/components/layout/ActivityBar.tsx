import { For } from 'solid-js';
import codelaneLogoWhite from '../../assets/codelane-logo-white.png';

export enum ActivityView {
  Explorer = 'explorer',
  Search = 'search',
  CodeReview = 'code-review',
  Extensions = 'extensions',
}

interface ActivityBarProps {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
  onSettingsOpen: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

interface ActivityItem {
  id: ActivityView;
  icon: string;
  label: string;
}

const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: ActivityView.Explorer,
    icon: 'files',
    label: 'Explorer',
  },
  {
    id: ActivityView.Search,
    icon: 'search',
    label: 'Search',
  },
  {
    id: ActivityView.CodeReview,
    icon: 'git',
    label: 'Code Review',
  },
  {
    id: ActivityView.Extensions,
    icon: 'extensions',
    label: 'Extensions',
  },
];

function ActivityIcon(props: { icon: string; class?: string }) {
  switch (props.icon) {
    case 'files':
      return (
        <svg class={props.class} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'search':
      return (
        <svg class={props.class} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case 'git':
      return (
        <svg class={props.class} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
          />
        </svg>
      );
    case 'extensions':
      return (
        <svg class={props.class} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function ActivityBar(props: ActivityBarProps) {
  return (
    <div class="w-14 bg-zed-bg-panel border-l border-zed-border-subtle flex flex-col">
      {/* Top Activity Icons */}
      <div class="flex-1 flex flex-col items-center pt-2 gap-1">
        <For each={ACTIVITY_ITEMS}>
          {(item) => (
            <button
              class={`w-10 h-10 flex items-center justify-center rounded transition-colors relative ${
                props.activeView === item.id
                  ? 'text-zed-text-primary'
                  : 'text-zed-text-tertiary hover:text-zed-text-secondary'
              }`}
              onClick={() => {
                if (props.activeView === item.id) {
                  // Toggle sidebar if clicking on active view
                  props.onToggleSidebar?.();
                } else {
                  // Switch to new view and expand if collapsed
                  props.onViewChange(item.id);
                  if (props.sidebarCollapsed) {
                    props.onToggleSidebar?.();
                  }
                }
              }}
              title={item.label}
            >
              {/* Active indicator */}
              {props.activeView === item.id && (
                <div class="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-zed-accent-blue rounded-l" />
              )}
              <ActivityIcon icon={item.icon} class="w-6 h-6" />
            </button>
          )}
        </For>
      </div>

      {/* Bottom Section - Settings + Logo */}
      <div class="flex flex-col items-center pb-3 gap-1">
        {/* Settings */}
        <button
          class="w-10 h-10 flex items-center justify-center rounded text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover transition-colors"
          onClick={props.onSettingsOpen}
          title="Settings"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Logo */}
        <div class="w-10 h-10 flex items-center justify-center" title="Codelane">
          <img src={codelaneLogoWhite} alt="Codelane" class="w-7 h-7 object-contain opacity-60" />
        </div>
      </div>
    </div>
  );
}
