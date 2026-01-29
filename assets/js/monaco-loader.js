/**
 * Monaco Editor Loader for Codelane
 *
 * This script loads Monaco Editor from CDN and initializes the global state
 * needed for the editor bridge to function.
 */

(function() {
    'use strict';

    // Monaco CDN configuration
    const MONACO_VERSION = '0.45.0';
    const MONACO_CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}`;

    // Global state for Monaco editors
    window.monacoEditors = window.monacoEditors || {};
    window.monacoModels = window.monacoModels || {};
    window.monacoReady = false;
    window.monacoReadyCallbacks = [];

    /**
     * Execute callback when Monaco is ready
     */
    window.onMonacoReady = function(callback) {
        if (window.monacoReady && window.monaco) {
            callback(window.monaco);
        } else {
            window.monacoReadyCallbacks.push(callback);
        }
    };

    /**
     * Notify all waiting callbacks that Monaco is ready
     */
    function notifyMonacoReady() {
        window.monacoReady = true;
        window.monacoReadyCallbacks.forEach(function(callback) {
            try {
                callback(window.monaco);
            } catch (e) {
                console.error('Monaco ready callback error:', e);
            }
        });
        window.monacoReadyCallbacks = [];
    }

    /**
     * Load a script dynamically
     */
    function loadScript(src) {
        return new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize Monaco Editor
     */
    async function initMonaco() {
        if (window.monaco) {
            console.log('Monaco already loaded');
            notifyMonacoReady();
            return;
        }

        console.log('Loading Monaco Editor from CDN...');

        try {
            // Load the Monaco loader
            await loadScript(`${MONACO_CDN_BASE}/min/vs/loader.js`);

            // Configure require paths
            window.require.config({
                paths: {
                    'vs': `${MONACO_CDN_BASE}/min/vs`
                }
            });

            // Load Monaco
            await new Promise(function(resolve, reject) {
                window.require(['vs/editor/editor.main'], function() {
                    console.log('Monaco Editor loaded successfully');
                    resolve();
                }, function(err) {
                    console.error('Failed to load Monaco:', err);
                    reject(err);
                });
            });

            // Register Codelane dark theme
            registerCodelaneDarkTheme();

            // Set default theme
            window.monaco.editor.setTheme('codelane-dark');

            notifyMonacoReady();

        } catch (error) {
            console.error('Failed to initialize Monaco:', error);
            throw error;
        }
    }

    /**
     * Register the Codelane dark theme matching gray-900 background
     */
    function registerCodelaneDarkTheme() {
        window.monaco.editor.defineTheme('codelane-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                // Syntax highlighting rules
                { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'C586C0' },
                { token: 'keyword.control', foreground: 'C586C0' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'string.escape', foreground: 'D7BA7D' },
                { token: 'number', foreground: 'B5CEA8' },
                { token: 'type', foreground: '4EC9B0' },
                { token: 'type.identifier', foreground: '4EC9B0' },
                { token: 'class', foreground: '4EC9B0' },
                { token: 'function', foreground: 'DCDCAA' },
                { token: 'function.declaration', foreground: 'DCDCAA' },
                { token: 'variable', foreground: '9CDCFE' },
                { token: 'variable.parameter', foreground: '9CDCFE' },
                { token: 'constant', foreground: '4FC1FF' },
                { token: 'operator', foreground: 'D4D4D4' },
                { token: 'delimiter', foreground: 'D4D4D4' },
                { token: 'delimiter.bracket', foreground: 'FFD700' },
                { token: 'attribute', foreground: '9CDCFE' },
                { token: 'attribute.name', foreground: '9CDCFE' },
                { token: 'attribute.value', foreground: 'CE9178' },
                { token: 'tag', foreground: '569CD6' },
                { token: 'metatag', foreground: '569CD6' },
                // Rust-specific
                { token: 'keyword.rust', foreground: 'C586C0' },
                { token: 'lifetime.rust', foreground: '569CD6' },
                { token: 'macro.rust', foreground: '4EC9B0' },
            ],
            colors: {
                // Editor colors matching gray-900 (#111827)
                'editor.background': '#111827',
                'editor.foreground': '#D4D4D4',
                'editorCursor.foreground': '#AEAFAD',
                'editor.lineHighlightBackground': '#1F2937',
                'editor.lineHighlightBorder': '#00000000',
                'editorLineNumber.foreground': '#4B5563',
                'editorLineNumber.activeForeground': '#9CA3AF',
                'editor.selectionBackground': '#374151',
                'editor.selectionHighlightBackground': '#374151',
                'editor.inactiveSelectionBackground': '#1F2937',
                'editorIndentGuide.background1': '#374151',
                'editorIndentGuide.activeBackground1': '#4B5563',
                'editorWhitespace.foreground': '#374151',
                'editorBracketMatch.background': '#374151',
                'editorBracketMatch.border': '#6B7280',

                // Gutter
                'editorGutter.background': '#111827',
                'editorGutter.addedBackground': '#22C55E',
                'editorGutter.modifiedBackground': '#3B82F6',
                'editorGutter.deletedBackground': '#EF4444',

                // Minimap
                'minimap.background': '#111827',
                'minimap.selectionHighlight': '#374151',
                'minimapSlider.background': '#37415180',
                'minimapSlider.hoverBackground': '#4B556380',
                'minimapSlider.activeBackground': '#6B728080',

                // Scrollbar
                'scrollbar.shadow': '#00000000',
                'scrollbarSlider.background': '#37415180',
                'scrollbarSlider.hoverBackground': '#4B556380',
                'scrollbarSlider.activeBackground': '#6B728080',

                // Widget (autocomplete, hover, etc.)
                'editorWidget.background': '#1F2937',
                'editorWidget.border': '#374151',
                'editorSuggestWidget.background': '#1F2937',
                'editorSuggestWidget.border': '#374151',
                'editorSuggestWidget.selectedBackground': '#374151',
                'editorSuggestWidget.highlightForeground': '#60A5FA',
                'editorHoverWidget.background': '#1F2937',
                'editorHoverWidget.border': '#374151',

                // Input
                'input.background': '#1F2937',
                'input.border': '#374151',
                'input.foreground': '#D4D4D4',
                'inputOption.activeBorder': '#3B82F6',

                // List
                'list.hoverBackground': '#374151',
                'list.activeSelectionBackground': '#3B82F6',
                'list.inactiveSelectionBackground': '#374151',
                'list.highlightForeground': '#60A5FA',

                // Peek view
                'peekView.border': '#3B82F6',
                'peekViewEditor.background': '#1F2937',
                'peekViewResult.background': '#111827',
                'peekViewTitle.background': '#1F2937',

                // Diff
                'diffEditor.insertedTextBackground': '#22C55E20',
                'diffEditor.removedTextBackground': '#EF444420',
                'diffEditor.insertedLineBackground': '#22C55E15',
                'diffEditor.removedLineBackground': '#EF444415',
            }
        });

        console.log('Codelane dark theme registered');
    }

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMonaco);
    } else {
        initMonaco();
    }

    // Export for manual initialization
    window.initMonaco = initMonaco;
})();
