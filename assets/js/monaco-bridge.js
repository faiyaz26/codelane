/**
 * Monaco Editor Bridge for Codelane
 *
 * This script provides bridge functions that Rust can call via eval()
 * to interact with Monaco Editor instances.
 */

(function() {
    'use strict';

    // Ensure global state exists
    window.monacoEditors = window.monacoEditors || {};
    window.monacoModels = window.monacoModels || {};
    window.monacoEventHandlers = window.monacoEventHandlers || {};

    /**
     * Generate a unique editor ID
     */
    function generateEditorId() {
        return 'editor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Create a new Monaco editor instance
     *
     * @param {string} containerId - The ID of the DOM container element
     * @param {Object} options - Editor configuration options
     * @returns {Promise<string>} - The editor ID
     */
    window.createMonacoEditor = function(containerId, options) {
        return new Promise(function(resolve, reject) {
            window.onMonacoReady(function(monaco) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) {
                        reject(new Error('Container not found: ' + containerId));
                        return;
                    }

                    const editorId = options.editorId || generateEditorId();

                    // Dispose existing editor if present
                    if (window.monacoEditors[editorId]) {
                        window.monacoEditors[editorId].dispose();
                    }

                    // Default options merged with provided options
                    const editorOptions = Object.assign({
                        theme: 'codelane-dark',
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                        fontLigatures: true,
                        tabSize: 4,
                        insertSpaces: true,
                        wordWrap: 'off',
                        minimap: { enabled: true },
                        lineNumbers: 'on',
                        readOnly: false,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        renderWhitespace: 'selection',
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        smoothScrolling: true,
                        mouseWheelZoom: true,
                        bracketPairColorization: { enabled: true },
                        guides: {
                            bracketPairs: true,
                            indentation: true,
                        },
                        padding: { top: 8, bottom: 8 },
                        folding: true,
                        foldingStrategy: 'indentation',
                        showFoldingControls: 'mouseover',
                        links: true,
                        contextmenu: true,
                        quickSuggestions: true,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: 'on',
                        tabCompletion: 'on',
                        wordBasedSuggestions: 'currentDocument',
                        parameterHints: { enabled: true },
                        hover: { enabled: true },
                        find: {
                            addExtraSpaceOnTop: false,
                            autoFindInSelection: 'multiline',
                            seedSearchStringFromSelection: 'selection',
                        },
                    }, options);

                    // Handle minimap option
                    if (typeof options.minimapEnabled === 'boolean') {
                        editorOptions.minimap = { enabled: options.minimapEnabled };
                    }

                    // Create the editor
                    const editor = monaco.editor.create(container, editorOptions);

                    // Store the editor
                    window.monacoEditors[editorId] = editor;

                    // Set up event handlers
                    setupEditorEvents(editorId, editor);

                    console.log('Created Monaco editor:', editorId);
                    resolve(editorId);

                } catch (error) {
                    console.error('Failed to create editor:', error);
                    reject(error);
                }
            });
        });
    };

    /**
     * Set up event handlers for an editor
     */
    function setupEditorEvents(editorId, editor) {
        // Content change handler
        editor.onDidChangeModelContent(function(event) {
            const content = editor.getValue();
            dispatchEditorEvent(editorId, 'change', { content: content });
        });

        // Cursor position change handler
        editor.onDidChangeCursorPosition(function(event) {
            dispatchEditorEvent(editorId, 'cursor', {
                line: event.position.lineNumber,
                column: event.position.column
            });
        });

        // Selection change handler
        editor.onDidChangeCursorSelection(function(event) {
            const selection = event.selection;
            dispatchEditorEvent(editorId, 'selection', {
                startLine: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLine: selection.endLineNumber,
                endColumn: selection.endColumn
            });
        });

        // Focus handler
        editor.onDidFocusEditorText(function() {
            dispatchEditorEvent(editorId, 'focus', {});
        });

        // Blur handler
        editor.onDidBlurEditorText(function() {
            dispatchEditorEvent(editorId, 'blur', {});
        });

        // Add keyboard shortcuts
        editor.addCommand(
            window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS,
            function() {
                const content = editor.getValue();
                dispatchEditorEvent(editorId, 'save', { content: content });
            }
        );
    }

    /**
     * Dispatch an editor event to Rust via custom event
     */
    function dispatchEditorEvent(editorId, eventType, data) {
        const event = new CustomEvent('monaco-event', {
            detail: {
                type: eventType,
                editorId: editorId,
                ...data
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Set the content of an editor
     *
     * @param {string} editorId - The editor ID
     * @param {string} content - The new content
     * @returns {boolean} - Success status
     */
    window.setMonacoContent = function(editorId, content) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.setValue(content);
        return true;
    };

    /**
     * Get the content of an editor
     *
     * @param {string} editorId - The editor ID
     * @returns {string|null} - The editor content or null if not found
     */
    window.getMonacoContent = function(editorId) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return null;
        }

        return editor.getValue();
    };

    /**
     * Set the language mode of an editor
     *
     * @param {string} editorId - The editor ID
     * @param {string} language - The language ID (e.g., 'rust', 'javascript')
     * @returns {boolean} - Success status
     */
    window.setMonacoLanguage = function(editorId, language) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        const model = editor.getModel();
        if (model) {
            window.monaco.editor.setModelLanguage(model, language);
            return true;
        }

        return false;
    };

    /**
     * Set the editor theme globally
     *
     * @param {string} themeName - The theme name (e.g., 'vs-dark', 'codelane-dark')
     * @returns {boolean} - Success status
     */
    window.setMonacoTheme = function(themeName) {
        if (!window.monaco) {
            console.error('Monaco not loaded');
            return false;
        }

        window.monaco.editor.setTheme(themeName);
        return true;
    };

    /**
     * Dispose of an editor instance
     *
     * @param {string} editorId - The editor ID
     * @returns {boolean} - Success status
     */
    window.disposeMonacoEditor = function(editorId) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.warn('Editor not found for disposal:', editorId);
            return false;
        }

        editor.dispose();
        delete window.monacoEditors[editorId];
        console.log('Disposed Monaco editor:', editorId);
        return true;
    };

    /**
     * Update editor options
     *
     * @param {string} editorId - The editor ID
     * @param {Object} options - Options to update
     * @returns {boolean} - Success status
     */
    window.updateMonacoOptions = function(editorId, options) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.updateOptions(options);
        return true;
    };

    /**
     * Go to a specific line in the editor
     *
     * @param {string} editorId - The editor ID
     * @param {number} lineNumber - The line number to go to
     * @returns {boolean} - Success status
     */
    window.goToMonacoLine = function(editorId, lineNumber) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.revealLineInCenter(lineNumber);
        editor.setPosition({ lineNumber: lineNumber, column: 1 });
        editor.focus();
        return true;
    };

    /**
     * Set selection in the editor
     *
     * @param {string} editorId - The editor ID
     * @param {number} startLine - Start line number
     * @param {number} startColumn - Start column
     * @param {number} endLine - End line number
     * @param {number} endColumn - End column
     * @returns {boolean} - Success status
     */
    window.setMonacoSelection = function(editorId, startLine, startColumn, endLine, endColumn) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.setSelection({
            startLineNumber: startLine,
            startColumn: startColumn,
            endLineNumber: endLine,
            endColumn: endColumn
        });
        editor.revealRangeInCenter({
            startLineNumber: startLine,
            startColumn: startColumn,
            endLineNumber: endLine,
            endColumn: endColumn
        });
        return true;
    };

    /**
     * Get the current cursor position
     *
     * @param {string} editorId - The editor ID
     * @returns {Object|null} - Position object {line, column} or null
     */
    window.getMonacoCursorPosition = function(editorId) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return null;
        }

        const position = editor.getPosition();
        return {
            line: position.lineNumber,
            column: position.column
        };
    };

    /**
     * Insert text at the current cursor position
     *
     * @param {string} editorId - The editor ID
     * @param {string} text - Text to insert
     * @returns {boolean} - Success status
     */
    window.insertMonacoText = function(editorId, text) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.trigger('keyboard', 'type', { text: text });
        return true;
    };

    /**
     * Execute an editor action
     *
     * @param {string} editorId - The editor ID
     * @param {string} actionId - The action ID
     * @returns {Promise<boolean>} - Success status
     */
    window.executeMonacoAction = function(editorId, actionId) {
        return new Promise(function(resolve) {
            const editor = window.monacoEditors[editorId];
            if (!editor) {
                console.error('Editor not found:', editorId);
                resolve(false);
                return;
            }

            const action = editor.getAction(actionId);
            if (action) {
                action.run().then(function() {
                    resolve(true);
                }).catch(function(err) {
                    console.error('Action failed:', err);
                    resolve(false);
                });
            } else {
                console.error('Action not found:', actionId);
                resolve(false);
            }
        });
    };

    /**
     * Focus the editor
     *
     * @param {string} editorId - The editor ID
     * @returns {boolean} - Success status
     */
    window.focusMonacoEditor = function(editorId) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.focus();
        return true;
    };

    /**
     * Set read-only mode
     *
     * @param {string} editorId - The editor ID
     * @param {boolean} readOnly - Whether the editor should be read-only
     * @returns {boolean} - Success status
     */
    window.setMonacoReadOnly = function(editorId, readOnly) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.updateOptions({ readOnly: readOnly });
        return true;
    };

    /**
     * Add decorations to the editor (e.g., for highlighting lines)
     *
     * @param {string} editorId - The editor ID
     * @param {Array} decorations - Array of decoration objects
     * @returns {Array|null} - Decoration IDs or null
     */
    window.addMonacoDecorations = function(editorId, decorations) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return null;
        }

        return editor.deltaDecorations([], decorations);
    };

    /**
     * Remove decorations from the editor
     *
     * @param {string} editorId - The editor ID
     * @param {Array} decorationIds - Array of decoration IDs to remove
     * @returns {boolean} - Success status
     */
    window.removeMonacoDecorations = function(editorId, decorationIds) {
        const editor = window.monacoEditors[editorId];
        if (!editor) {
            console.error('Editor not found:', editorId);
            return false;
        }

        editor.deltaDecorations(decorationIds, []);
        return true;
    };

    /**
     * Create a diff editor
     *
     * @param {string} containerId - The container element ID
     * @param {Object} options - Diff editor options
     * @returns {Promise<string>} - The editor ID
     */
    window.createMonacoDiffEditor = function(containerId, options) {
        return new Promise(function(resolve, reject) {
            window.onMonacoReady(function(monaco) {
                try {
                    const container = document.getElementById(containerId);
                    if (!container) {
                        reject(new Error('Container not found: ' + containerId));
                        return;
                    }

                    const editorId = options.editorId || generateEditorId();

                    // Dispose existing editor if present
                    if (window.monacoEditors[editorId]) {
                        window.monacoEditors[editorId].dispose();
                    }

                    const diffEditorOptions = Object.assign({
                        theme: 'codelane-dark',
                        automaticLayout: true,
                        renderSideBySide: true,
                        ignoreTrimWhitespace: true,
                        readOnly: false,
                        originalEditable: false,
                    }, options);

                    const diffEditor = monaco.editor.createDiffEditor(container, diffEditorOptions);

                    // Store the editor
                    window.monacoEditors[editorId] = diffEditor;

                    console.log('Created Monaco diff editor:', editorId);
                    resolve(editorId);

                } catch (error) {
                    console.error('Failed to create diff editor:', error);
                    reject(error);
                }
            });
        });
    };

    /**
     * Set diff editor content
     *
     * @param {string} editorId - The diff editor ID
     * @param {string} originalContent - Original content
     * @param {string} modifiedContent - Modified content
     * @param {string} language - Language ID
     * @returns {boolean} - Success status
     */
    window.setMonacoDiffContent = function(editorId, originalContent, modifiedContent, language) {
        const editor = window.monacoEditors[editorId];
        if (!editor || !editor.setModel) {
            console.error('Diff editor not found:', editorId);
            return false;
        }

        const originalModel = window.monaco.editor.createModel(originalContent, language);
        const modifiedModel = window.monaco.editor.createModel(modifiedContent, language);

        editor.setModel({
            original: originalModel,
            modified: modifiedModel
        });

        return true;
    };

    /**
     * Register a custom language
     *
     * @param {Object} languageDefinition - Language definition
     * @returns {boolean} - Success status
     */
    window.registerMonacoLanguage = function(languageDefinition) {
        if (!window.monaco) {
            console.error('Monaco not loaded');
            return false;
        }

        window.monaco.languages.register({ id: languageDefinition.id });

        if (languageDefinition.tokensProvider) {
            window.monaco.languages.setMonarchTokensProvider(
                languageDefinition.id,
                languageDefinition.tokensProvider
            );
        }

        if (languageDefinition.configuration) {
            window.monaco.languages.setLanguageConfiguration(
                languageDefinition.id,
                languageDefinition.configuration
            );
        }

        return true;
    };

    /**
     * Layout all editors (useful after container resize)
     */
    window.layoutMonacoEditors = function() {
        Object.values(window.monacoEditors).forEach(function(editor) {
            if (editor && editor.layout) {
                editor.layout();
            }
        });
    };

    /**
     * Check if Monaco is ready
     *
     * @returns {boolean} - Whether Monaco is loaded and ready
     */
    window.isMonacoReady = function() {
        return window.monacoReady && !!window.monaco;
    };

    console.log('Monaco bridge loaded');
})();
