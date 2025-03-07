/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isFirefox } from 'vs/base/browser/browser';
import { BrowserFeatures } from 'vs/base/browser/canIUse';
import { DataTransfers } from 'vs/base/browser/dnd';
import * as dom from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { AutoOpenBarrier, Promises, timeout } from 'vs/base/common/async';
import { Codicon, getAllCodicons } from 'vs/base/common/codicons';
import { debounce } from 'vs/base/common/decorators';
import { ErrorNoTelemetry } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { ISeparator, template } from 'vs/base/common/labels';
import { Lazy } from 'vs/base/common/lazy';
import { Disposable, DisposableStore, dispose, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import * as path from 'vs/base/common/path';
import { isMacintosh, isWindows, OperatingSystem, OS } from 'vs/base/common/platform';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { withNullAsUndefined } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { TabFocus, TabFocusContext } from 'vs/editor/browser/config/tabFocus';
import { FindReplaceState } from 'vs/editor/contrib/find/browser/findState';
import * as nls from 'vs/nls';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { CodeDataTransfers, containsDragType } from 'vs/platform/dnd/browser/dnd';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService, IPromptChoice, Severity } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IProductService } from 'vs/platform/product/common/productService';
import { IQuickInputService, IQuickPickItem, QuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IMarkProperties, ITerminalCommand, TerminalCapability } from 'vs/platform/terminal/common/capabilities/capabilities';
import { TerminalCapabilityStoreMultiplexer } from 'vs/platform/terminal/common/capabilities/terminalCapabilityStore';
import { IProcessDataEvent, IProcessPropertyMap, IReconnectionProperties, IShellLaunchConfig, ITerminalDimensionsOverride, ITerminalLaunchError, PosixShellType, ProcessPropertyType, ShellIntegrationStatus, TerminalExitReason, TerminalIcon, TerminalLocation, TerminalSettingId, TerminalShellType, TitleEventSource, WindowsShellType } from 'vs/platform/terminal/common/terminal';
import { formatMessageForTerminal } from 'vs/platform/terminal/common/terminalStrings';
import { getIconRegistry } from 'vs/platform/theme/common/iconRegistry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWorkspaceContextService, IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { IWorkspaceTrustRequestService } from 'vs/platform/workspace/common/workspaceTrust';
import { IViewDescriptorService, IViewsService, ViewContainerLocation } from 'vs/workbench/common/views';
import { TaskSettingId } from 'vs/workbench/contrib/tasks/common/tasks';
import * as strings from 'vs/base/common/strings';
import { IDetectedLinks, TerminalLinkManager } from 'vs/workbench/contrib/terminal/browser/links/terminalLinkManager';
import { TerminalLinkQuickpick } from 'vs/workbench/contrib/terminal/browser/links/terminalLinkQuickpick';
import { IRequestAddInstanceToGroupEvent, ITerminalExternalLinkProvider, ITerminalInstance, TerminalDataTransfers } from 'vs/workbench/contrib/terminal/browser/terminal';
import { TerminalLaunchHelpAction } from 'vs/workbench/contrib/terminal/browser/terminalActions';
import { freePort, gitCreatePr, gitPushSetUpstream, gitSimilar, gitTwoDashes, pwshGeneralError as pwshGeneralError, pwshUnixCommandNotFoundError } from 'vs/workbench/contrib/terminal/browser/terminalQuickFixBuiltinActions';
import { TerminalConfigHelper } from 'vs/workbench/contrib/terminal/browser/terminalConfigHelper';
import { TerminalEditorInput } from 'vs/workbench/contrib/terminal/browser/terminalEditorInput';
import { TerminalFindWidget } from 'vs/workbench/contrib/terminal/browser/terminalFindWidget';
import { getColorClass, getColorStyleElement, getStandardColors } from 'vs/workbench/contrib/terminal/browser/terminalIcon';
import { TerminalProcessManager } from 'vs/workbench/contrib/terminal/browser/terminalProcessManager';
import { showRunRecentQuickPick } from 'vs/workbench/contrib/terminal/browser/terminalRunRecentQuickPick';
import { ITerminalStatusList, TerminalStatus, TerminalStatusList } from 'vs/workbench/contrib/terminal/browser/terminalStatusList';
import { TypeAheadAddon } from 'vs/workbench/contrib/terminal/browser/terminalTypeAheadAddon';
import { getTerminalResourcesFromDragEvent, getTerminalUri } from 'vs/workbench/contrib/terminal/browser/terminalUri';
import { EnvironmentVariableInfoWidget } from 'vs/workbench/contrib/terminal/browser/widgets/environmentVariableInfoWidget';
import { TerminalWidgetManager } from 'vs/workbench/contrib/terminal/browser/widgets/widgetManager';
import { ITerminalQuickFixAddon, TerminalQuickFixAddon } from 'vs/workbench/contrib/terminal/browser/xterm/quickFixAddon';
import { LineDataEventAddon } from 'vs/workbench/contrib/terminal/browser/xterm/lineDataEventAddon';
import { XtermTerminal } from 'vs/workbench/contrib/terminal/browser/xterm/xtermTerminal';
import { IEnvironmentVariableInfo } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { deserializeEnvironmentVariableCollections } from 'vs/platform/terminal/common/environmentVariableShared';
import { getCommandHistory, getDirectoryHistory } from 'vs/workbench/contrib/terminal/common/history';
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, ITerminalProcessManager, ITerminalProfileResolverService, ProcessState, TerminalCommandId, TERMINAL_CREATION_COMMANDS, TERMINAL_VIEW_ID } from 'vs/workbench/contrib/terminal/common/terminal';
import { TerminalContextKeys } from 'vs/workbench/contrib/terminal/common/terminalContextKey';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { IWorkbenchLayoutService, Position } from 'vs/workbench/services/layout/browser/layoutService';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';
import type { IMarker, Terminal as XTermTerminal } from 'xterm';
import { IAudioCueService, AudioCue } from 'vs/platform/audioCues/browser/audioCueService';
import { ITerminalQuickFixOptions } from 'vs/platform/terminal/common/xterm/terminalQuickFix';
import { FileSystemProviderCapabilities, IFileService } from 'vs/platform/files/common/files';
import { preparePathForShell } from 'vs/workbench/contrib/terminal/common/terminalEnvironment';
import { IEnvironmentVariableCollection } from 'vs/platform/terminal/common/environmentVariable';
import { ITerminalWidget } from 'vs/workbench/contrib/terminal/browser/widgets/widgets';
import { Widget } from 'vs/base/browser/ui/widget';
import { FastDomNode, createFastDomNode } from 'vs/base/browser/fastDomNode';
import { ISimpleSelectedSuggestion } from 'vs/workbench/services/suggest/browser/simpleSuggestWidget';
import { MarkdownRenderer } from 'vs/editor/contrib/markdownRenderer/browser/markdownRenderer';

const enum Constants {
	/**
	 * The maximum amount of milliseconds to wait for a container before starting to create the
	 * terminal process. This period helps ensure the terminal has good initial dimensions to work
	 * with if it's going to be a foreground terminal.
	 */
	WaitForContainerThreshold = 100,

	DefaultCols = 80,
	DefaultRows = 30,
	MaxSupportedCols = 5000,
	MaxCanvasWidth = 8000
}

let xtermConstructor: Promise<typeof XTermTerminal> | undefined;
function getXtermConstructor(): Promise<typeof XTermTerminal> {
	if (xtermConstructor) {
		return xtermConstructor;
	}
	xtermConstructor = Promises.withAsyncBody<typeof XTermTerminal>(async (resolve) => {
		const Terminal = (await import('xterm')).Terminal;
		// Localize strings
		Terminal.strings.promptLabel = nls.localize('terminal.integrated.a11yPromptLabel', 'Terminal input');
		Terminal.strings.tooMuchOutput = nls.localize('terminal.integrated.a11yTooMuchOutput', 'Too much output to announce, navigate to rows manually to read');
		Terminal.strings.accessibleBuffer = nls.localize('terminal.integrated.accessibleBuffer', 'Terminal buffer');
		resolve(Terminal);
	});
	return xtermConstructor;
}

interface ICanvasDimensions {
	width: number;
	height: number;
}

interface IGridDimensions {
	cols: number;
	rows: number;
}

const shellIntegrationSupportedShellTypes = [
	PosixShellType.Bash,
	PosixShellType.Zsh,
	PosixShellType.PowerShell,
	WindowsShellType.PowerShell
];

export class TerminalInstance extends Disposable implements ITerminalInstance {
	private static _lastKnownCanvasDimensions: ICanvasDimensions | undefined;
	private static _lastKnownGridDimensions: IGridDimensions | undefined;
	private static _instanceIdCounter = 1;

	private readonly _scopedInstantiationService: IInstantiationService;

	readonly _processManager: ITerminalProcessManager;
	private readonly _resource: URI;
	// Enables disposal of the xterm onKey
	// event when the CwdDetection capability
	// is added
	private _xtermOnKey: IDisposable | undefined;
	private _xtermReadyPromise: Promise<XtermTerminal>;
	private _xtermTypeAheadAddon: TypeAheadAddon | undefined;
	private _pressAnyKeyToCloseListener: IDisposable | undefined;
	private _instanceId: number;
	private _latestXtermWriteData: number = 0;
	private _latestXtermParseData: number = 0;
	private _isExiting: boolean;
	private _hadFocusOnExit: boolean;
	private _isVisible: boolean;
	private _isDisposed: boolean;
	private _exitCode: number | undefined;
	private _exitReason: TerminalExitReason | undefined;
	private _skipTerminalCommands: string[];
	private _aliases: string[][] | undefined;
	private _shellType: TerminalShellType | undefined;
	private _title: string = '';
	private _titleSource: TitleEventSource = TitleEventSource.Process;
	private _container: HTMLElement | undefined;
	private _wrapperElement: (HTMLElement & { xterm?: XTermTerminal });
	private _horizontalScrollbar: DomScrollableElement | undefined;
	private _terminalFocusContextKey: IContextKey<boolean>;
	private _terminalHasFixedWidth: IContextKey<boolean>;
	private _terminalHasTextContextKey: IContextKey<boolean>;
	private _terminalAltBufferActiveContextKey: IContextKey<boolean>;
	private _terminalShellIntegrationEnabledContextKey: IContextKey<boolean>;
	private _cols: number = 0;
	private _rows: number = 0;
	private _fixedCols: number | undefined;
	private _fixedRows: number | undefined;
	private _cwd: string | undefined = undefined;
	private _initialCwd: string | undefined = undefined;
	private _layoutSettingsChanged: boolean = true;
	private _dimensionsOverride: ITerminalDimensionsOverride | undefined;
	private _areLinksReady: boolean = false;
	private _initialDataEvents: string[] | undefined = [];
	private _containerReadyBarrier: AutoOpenBarrier;
	private _attachBarrier: AutoOpenBarrier;
	private _icon: TerminalIcon | undefined;
	private _messageTitleDisposable: IDisposable | undefined;
	private _widgetManager: TerminalWidgetManager = new TerminalWidgetManager();
	private _linkManager: TerminalLinkManager | undefined;
	private _environmentInfo: { widget: EnvironmentVariableInfoWidget; disposable: IDisposable } | undefined;
	private _dndObserver: IDisposable | undefined;
	private _terminalLinkQuickpick: TerminalLinkQuickpick | undefined;
	private _lastLayoutDimensions: dom.Dimension | undefined;
	private _hasHadInput: boolean;
	private _description?: string;
	private _processName: string = '';
	private _sequence?: string;
	private _staticTitle?: string;
	private _workspaceFolder?: IWorkspaceFolder;
	private _labelComputer?: TerminalLabelComputer;
	private _userHome?: string;
	private _hasScrollBar?: boolean;
	private _target?: TerminalLocation | undefined;
	private _disableShellIntegrationReporting: boolean | undefined;
	private _usedShellIntegrationInjection: boolean = false;
	get usedShellIntegrationInjection(): boolean { return this._usedShellIntegrationInjection; }
	private _quickFixAddon: TerminalQuickFixAddon | undefined;
	private _lineDataEventAddon: LineDataEventAddon | undefined;

	readonly capabilities = new TerminalCapabilityStoreMultiplexer();
	readonly statusList: ITerminalStatusList;

	/**
	 * Enables opening the contextual actions, if any, that are available
	 * and registering of command finished listeners
	 */
	get quickFix(): ITerminalQuickFixAddon | undefined { return this._quickFixAddon; }

	readonly findWidget: Lazy<TerminalFindWidget>;

	xterm?: XtermTerminal;
	disableLayout: boolean = false;

	get waitOnExit(): ITerminalInstance['waitOnExit'] { return this._shellLaunchConfig.attachPersistentProcess?.waitOnExit || this._shellLaunchConfig.waitOnExit; }
	set waitOnExit(value: ITerminalInstance['waitOnExit']) {
		this._shellLaunchConfig.waitOnExit = value;
	}

	get target(): TerminalLocation | undefined { return this._target; }
	set target(value: TerminalLocation | undefined) {
		if (this.xterm) {
			this.xterm.target = value;
		}
		this._target = value;
	}
	get disableShellIntegrationReporting(): boolean {
		if (this._disableShellIntegrationReporting === undefined) {
			this._disableShellIntegrationReporting = (this.shellLaunchConfig.hideFromUser || this.shellLaunchConfig.executable === undefined || this.shellType === undefined) || !shellIntegrationSupportedShellTypes.includes(this.shellType);
		}
		return this._disableShellIntegrationReporting;
	}
	get instanceId(): number { return this._instanceId; }
	get resource(): URI { return this._resource; }
	get cols(): number {
		if (this._fixedCols !== undefined) {
			return this._fixedCols;
		}
		if (this._dimensionsOverride && this._dimensionsOverride.cols) {
			if (this._dimensionsOverride.forceExactSize) {
				return this._dimensionsOverride.cols;
			}
			return Math.min(Math.max(this._dimensionsOverride.cols, 2), this._cols);
		}
		return this._cols;
	}
	get rows(): number {
		if (this._fixedRows !== undefined) {
			return this._fixedRows;
		}
		if (this._dimensionsOverride && this._dimensionsOverride.rows) {
			if (this._dimensionsOverride.forceExactSize) {
				return this._dimensionsOverride.rows;
			}
			return Math.min(Math.max(this._dimensionsOverride.rows, 2), this._rows);
		}
		return this._rows;
	}
	get isDisposed(): boolean { return this._isDisposed; }
	get fixedCols(): number | undefined { return this._fixedCols; }
	get fixedRows(): number | undefined { return this._fixedRows; }
	get maxCols(): number { return this._cols; }
	get maxRows(): number { return this._rows; }
	// TODO: Ideally processId would be merged into processReady
	get processId(): number | undefined { return this._processManager.shellProcessId; }
	// TODO: How does this work with detached processes?
	// TODO: Should this be an event as it can fire twice?
	get processReady(): Promise<void> { return this._processManager.ptyProcessReady; }
	get hasChildProcesses(): boolean { return this.shellLaunchConfig.attachPersistentProcess?.hasChildProcesses || this._processManager.hasChildProcesses; }
	get reconnectionProperties(): IReconnectionProperties | undefined { return this.shellLaunchConfig.attachPersistentProcess?.reconnectionProperties || this.shellLaunchConfig.reconnectionProperties; }
	get areLinksReady(): boolean { return this._areLinksReady; }
	get initialDataEvents(): string[] | undefined { return this._initialDataEvents; }
	get exitCode(): number | undefined { return this._exitCode; }
	get exitReason(): TerminalExitReason | undefined { return this._exitReason; }
	get hadFocusOnExit(): boolean { return this._hadFocusOnExit; }
	get isTitleSetByProcess(): boolean { return !!this._messageTitleDisposable; }
	get shellLaunchConfig(): IShellLaunchConfig { return this._shellLaunchConfig; }
	get shellType(): TerminalShellType | undefined { return this._shellType; }
	get os(): OperatingSystem | undefined { return this._processManager.os; }
	get isRemote(): boolean { return this._processManager.remoteAuthority !== undefined; }
	get remoteAuthority(): string | undefined { return this._processManager.remoteAuthority; }
	get hasFocus(): boolean { return this._wrapperElement.contains(document.activeElement) ?? false; }
	get title(): string { return this._title; }
	get titleSource(): TitleEventSource { return this._titleSource; }
	get icon(): TerminalIcon | undefined { return this._getIcon(); }
	get color(): string | undefined { return this._getColor(); }
	get processName(): string { return this._processName; }
	get sequence(): string | undefined { return this._sequence; }
	get staticTitle(): string | undefined { return this._staticTitle; }
	get workspaceFolder(): IWorkspaceFolder | undefined { return this._workspaceFolder; }
	get cwd(): string | undefined { return this._cwd; }
	get initialCwd(): string | undefined { return this._initialCwd; }
	get description(): string | undefined {
		if (this._description) {
			return this._description;
		}
		const type = this.shellLaunchConfig.attachPersistentProcess?.type || this.shellLaunchConfig.type;
		if (type) {
			if (type === 'Task') {
				return nls.localize('terminalTypeTask', "Task");
			}
			return nls.localize('terminalTypeLocal', "Local");
		}
		return undefined;
	}
	get userHome(): string | undefined { return this._userHome; }

	// The onExit event is special in that it fires and is disposed after the terminal instance
	// itself is disposed
	private readonly _onExit = new Emitter<number | ITerminalLaunchError | undefined>();
	readonly onExit = this._onExit.event;
	private readonly _onDisposed = this._register(new Emitter<ITerminalInstance>());
	readonly onDisposed = this._onDisposed.event;
	private readonly _onProcessIdReady = this._register(new Emitter<ITerminalInstance>());
	readonly onProcessIdReady = this._onProcessIdReady.event;
	private readonly _onLinksReady = this._register(new Emitter<ITerminalInstance>());
	readonly onLinksReady = this._onLinksReady.event;
	private readonly _onTitleChanged = this._register(new Emitter<ITerminalInstance>());
	readonly onTitleChanged = this._onTitleChanged.event;
	private readonly _onIconChanged = this._register(new Emitter<{ instance: ITerminalInstance; userInitiated: boolean }>());
	readonly onIconChanged = this._onIconChanged.event;
	private readonly _onData = this._register(new Emitter<string>());
	readonly onData = this._onData.event;
	private readonly _onBinary = this._register(new Emitter<string>());
	readonly onBinary = this._onBinary.event;
	private readonly _onLineData = this._register(new Emitter<string>({
		onDidAddFirstListener: () => this._onLineDataSetup()
	}));
	readonly onLineData = this._onLineData.event;
	private readonly _onRequestExtHostProcess = this._register(new Emitter<ITerminalInstance>());
	readonly onRequestExtHostProcess = this._onRequestExtHostProcess.event;
	private readonly _onDimensionsChanged = this._register(new Emitter<void>());
	readonly onDimensionsChanged = this._onDimensionsChanged.event;
	private readonly _onMaximumDimensionsChanged = this._register(new Emitter<void>());
	readonly onMaximumDimensionsChanged = this._onMaximumDimensionsChanged.event;
	private readonly _onDidFocus = this._register(new Emitter<ITerminalInstance>());
	readonly onDidFocus = this._onDidFocus.event;
	private readonly _onDidBlur = this._register(new Emitter<ITerminalInstance>());
	readonly onDidBlur = this._onDidBlur.event;
	private readonly _onDidInputData = this._register(new Emitter<ITerminalInstance>());
	readonly onDidInputData = this._onDidInputData.event;
	private readonly _onRequestAddInstanceToGroup = this._register(new Emitter<IRequestAddInstanceToGroupEvent>());
	readonly onRequestAddInstanceToGroup = this._onRequestAddInstanceToGroup.event;
	private readonly _onDidChangeHasChildProcesses = this._register(new Emitter<boolean>());
	readonly onDidChangeHasChildProcesses = this._onDidChangeHasChildProcesses.event;
	private readonly _onDidChangeFindResults = new Emitter<{ resultIndex: number; resultCount: number } | undefined>();
	readonly onDidChangeFindResults = this._onDidChangeFindResults.event;
	private readonly _onDidFocusFindWidget = new Emitter<void>();
	readonly onDidFocusFindWidget = this._onDidFocusFindWidget.event;

	constructor(
		private readonly _terminalShellTypeContextKey: IContextKey<string>,
		private readonly _terminalInRunCommandPicker: IContextKey<boolean>,
		private readonly _terminalSuggestWidgetVisibleContextKey: IContextKey<boolean>,
		private readonly _configHelper: TerminalConfigHelper,
		private _shellLaunchConfig: IShellLaunchConfig,
		resource: URI | undefined,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ITerminalProfileResolverService private readonly _terminalProfileResolverService: ITerminalProfileResolverService,
		@IPathService private readonly _pathService: IPathService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IPreferencesService private readonly _preferencesService: IPreferencesService,
		@IViewsService private readonly _viewsService: IViewsService,
		@IClipboardService private readonly _clipboardService: IClipboardService,
		@IThemeService private readonly _themeService: IThemeService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IStorageService private readonly _storageService: IStorageService,
		@IAccessibilityService private readonly _accessibilityService: IAccessibilityService,
		@IProductService private readonly _productService: IProductService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IWorkbenchEnvironmentService workbenchEnvironmentService: IWorkbenchEnvironmentService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly _editorService: IEditorService,
		@IWorkspaceTrustRequestService private readonly _workspaceTrustRequestService: IWorkspaceTrustRequestService,
		@IHistoryService private readonly _historyService: IHistoryService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@IOpenerService private readonly _openerService: IOpenerService,
		@ICommandService private readonly _commandService: ICommandService,
		@IAudioCueService private readonly _audioCueService: IAudioCueService
	) {
		super();

		this._wrapperElement = document.createElement('div');
		this._wrapperElement.classList.add('terminal-wrapper');

		this._skipTerminalCommands = [];
		this._isExiting = false;
		this._hadFocusOnExit = false;
		this._isVisible = false;
		this._isDisposed = false;
		this._instanceId = TerminalInstance._instanceIdCounter++;
		this._hasHadInput = false;
		this._fixedRows = _shellLaunchConfig.attachPersistentProcess?.fixedDimensions?.rows;
		this._fixedCols = _shellLaunchConfig.attachPersistentProcess?.fixedDimensions?.cols;

		// the resource is already set when it's been moved from another window
		this._resource = resource || getTerminalUri(this._workspaceContextService.getWorkspace().id, this.instanceId, this.title);

		if (this._shellLaunchConfig.attachPersistentProcess?.hideFromUser) {
			this._shellLaunchConfig.hideFromUser = this._shellLaunchConfig.attachPersistentProcess.hideFromUser;
		}

		if (this._shellLaunchConfig.attachPersistentProcess?.isFeatureTerminal) {
			this._shellLaunchConfig.isFeatureTerminal = this._shellLaunchConfig.attachPersistentProcess.isFeatureTerminal;
		}

		if (this._shellLaunchConfig.attachPersistentProcess?.type) {
			this._shellLaunchConfig.type = this._shellLaunchConfig.attachPersistentProcess.type;
		}

		if (this.shellLaunchConfig.cwd) {
			const cwdUri = typeof this._shellLaunchConfig.cwd === 'string' ? URI.from({
				scheme: Schemas.file,
				path: this._shellLaunchConfig.cwd
			}) : this._shellLaunchConfig.cwd;
			if (cwdUri) {
				this._workspaceFolder = withNullAsUndefined(this._workspaceContextService.getWorkspaceFolder(cwdUri));
			}
		}
		if (!this._workspaceFolder) {
			const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
			this._workspaceFolder = activeWorkspaceRootUri ? withNullAsUndefined(this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri)) : undefined;
		}

		const scopedContextKeyService = this._register(contextKeyService.createScoped(this._wrapperElement));
		this._scopedInstantiationService = instantiationService.createChild(new ServiceCollection(
			[IContextKeyService, scopedContextKeyService]
		));

		this._terminalFocusContextKey = TerminalContextKeys.focus.bindTo(scopedContextKeyService);
		this._terminalHasFixedWidth = TerminalContextKeys.terminalHasFixedWidth.bindTo(scopedContextKeyService);
		this._terminalHasTextContextKey = TerminalContextKeys.textSelected.bindTo(scopedContextKeyService);
		this._terminalAltBufferActiveContextKey = TerminalContextKeys.altBufferActive.bindTo(scopedContextKeyService);
		this._terminalShellIntegrationEnabledContextKey = TerminalContextKeys.terminalShellIntegrationEnabled.bindTo(scopedContextKeyService);

		this.findWidget = new Lazy(() => {
			const findWidget = this._scopedInstantiationService.createInstance(TerminalFindWidget, new FindReplaceState(), this);
			this._register(findWidget.focusTracker.onDidFocus(() => {
				this._container?.classList.toggle('find-focused', true);
				this._onDidFocusFindWidget.fire();
			}));
			this._register(findWidget.focusTracker.onDidBlur(() => this._container?.classList.toggle('find-focused', false)));
			if (this._container) {
				this._container.appendChild(findWidget.getDomNode());
			}
			if (this._lastLayoutDimensions) {
				findWidget.layout(this._lastLayoutDimensions.width);
			}
			return findWidget;
		});
		this._logService.trace(`terminalInstance#ctor (instanceId: ${this.instanceId})`, this._shellLaunchConfig);
		this._register(this.capabilities.onDidAddCapability(e => {
			this._logService.debug('terminalInstance added capability', e);
			if (e === TerminalCapability.CwdDetection) {
				this.capabilities.get(TerminalCapability.CwdDetection)?.onDidChangeCwd(e => {
					this._cwd = e;
					this._xtermOnKey?.dispose();
					this._setTitle(this.title, TitleEventSource.Config);
					this._scopedInstantiationService.invokeFunction(getDirectoryHistory)?.add(e, { remoteAuthority: this.remoteAuthority });
				});
			} else if (e === TerminalCapability.CommandDetection) {
				const commandCapability = this.capabilities.get(TerminalCapability.CommandDetection);
				commandCapability?.onCommandFinished(e => {
					if (e.command.trim().length > 0) {
						this._scopedInstantiationService.invokeFunction(getCommandHistory)?.add(e.command, { shellType: this._shellType });
					}
				});
			}
		}));
		this._register(this.capabilities.onDidRemoveCapability(e => this._logService.debug('terminalInstance removed capability', e)));

		// Resolve just the icon ahead of time so that it shows up immediately in the tabs. This is
		// disabled in remote because this needs to be sync and the OS may differ on the remote
		// which would result in the wrong profile being selected and the wrong icon being
		// permanently attached to the terminal. This also doesn't work when the default profile
		// setting is set to null, that's handled after the process is created.
		if (!this.shellLaunchConfig.executable && !workbenchEnvironmentService.remoteAuthority) {
			this._terminalProfileResolverService.resolveIcon(this._shellLaunchConfig, OS);
		}
		this._icon = _shellLaunchConfig.attachPersistentProcess?.icon || _shellLaunchConfig.icon;

		// When a custom pty is used set the name immediately so it gets passed over to the exthost
		// and is available when Pseudoterminal.open fires.
		if (this.shellLaunchConfig.customPtyImplementation) {
			this._setTitle(this._shellLaunchConfig.name, TitleEventSource.Api);
		}

		this.statusList = this._scopedInstantiationService.createInstance(TerminalStatusList);
		this._initDimensions();
		this._processManager = this._createProcessManager();

		this._register(toDisposable(() => this._dndObserver?.dispose()));

		this._containerReadyBarrier = new AutoOpenBarrier(Constants.WaitForContainerThreshold);
		this._attachBarrier = new AutoOpenBarrier(1000);
		this._xtermReadyPromise = this._createXterm();
		this._xtermReadyPromise.then(async () => {
			// Wait for a period to allow a container to be ready
			await this._containerReadyBarrier.wait();

			// Resolve the executable ahead of time if shell integration is enabled, this should not
			// be done for custom PTYs as that would cause extension Pseudoterminal-based terminals
			// to hang in resolver extensions
			if (!this.shellLaunchConfig.customPtyImplementation && this._configHelper.config.shellIntegration?.enabled && !this.shellLaunchConfig.executable) {
				const os = await this._processManager.getBackendOS();
				const defaultProfile = (await this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority: this.remoteAuthority, os }));
				this.shellLaunchConfig.executable = defaultProfile.path;
				this.shellLaunchConfig.args = defaultProfile.args;
				this.shellLaunchConfig.icon = defaultProfile.icon;
				this.shellLaunchConfig.color = defaultProfile.color;
			}

			await this._createProcess();

			// Re-establish the title after reconnect
			if (this.shellLaunchConfig.attachPersistentProcess) {
				this._cwd = this.shellLaunchConfig.attachPersistentProcess.cwd;
				this._setTitle(this.shellLaunchConfig.attachPersistentProcess.title, this.shellLaunchConfig.attachPersistentProcess.titleSource);
				this.setShellType(this.shellType);
			}

			if (this._fixedCols) {
				await this._addScrollbar();
			}
		}).catch((err) => {
			// Ignore exceptions if the terminal is already disposed
			if (!this._isDisposed) {
				throw err;
			}
		});

		this._register(this._configurationService.onDidChangeConfiguration(async e => {
			if (e.affectsConfiguration('terminal.integrated')) {
				this.updateConfig();
				this.setVisible(this._isVisible);
			}
			const layoutSettings: string[] = [
				TerminalSettingId.FontSize,
				TerminalSettingId.FontFamily,
				TerminalSettingId.FontWeight,
				TerminalSettingId.FontWeightBold,
				TerminalSettingId.LetterSpacing,
				TerminalSettingId.LineHeight,
				'editor.fontFamily'
			];
			if (layoutSettings.some(id => e.affectsConfiguration(id))) {
				this._layoutSettingsChanged = true;
				await this._resize();
			}
			if (e.affectsConfiguration(TerminalSettingId.UnicodeVersion)) {
				this._updateUnicodeVersion();
			}
			if (e.affectsConfiguration('editor.accessibilitySupport')) {
				this.updateAccessibilitySupport();
			}
			if (
				e.affectsConfiguration(TerminalSettingId.TerminalTitle) ||
				e.affectsConfiguration(TerminalSettingId.TerminalTitleSeparator) ||
				e.affectsConfiguration(TerminalSettingId.TerminalDescription)) {
				this._labelComputer?.refreshLabel();
			}
		}));
		this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => this._labelComputer?.refreshLabel()));
		this._register(this.onDidBlur(() => this.xterm?.suggestController?.hideSuggestWidget()));

		// Clear out initial data events after 10 seconds, hopefully extension hosts are up and
		// running at that point.
		let initialDataEventsTimeout: number | undefined = window.setTimeout(() => {
			initialDataEventsTimeout = undefined;
			this._initialDataEvents = undefined;
		}, 10000);
		this._register(toDisposable(() => {
			if (initialDataEventsTimeout) {
				window.clearTimeout(initialDataEventsTimeout);
			}
		}));
	}

	private _getIcon(): TerminalIcon | undefined {
		if (!this._icon) {
			this._icon = this._processManager.processState >= ProcessState.Launching
				? getIconRegistry().getIcon(this._configurationService.getValue(TerminalSettingId.TabsDefaultIcon))
				: undefined;
		}
		return this._icon;
	}

	private _getColor(): string | undefined {
		if (this.shellLaunchConfig.color) {
			return this.shellLaunchConfig.color;
		}
		if (this.shellLaunchConfig?.attachPersistentProcess?.color) {
			return this.shellLaunchConfig.attachPersistentProcess.color;
		}
		if (this._processManager.processState >= ProcessState.Launching) {
			return undefined;
		}
		return undefined;
	}

	private _registerQuickFixProvider(quickFixAddon: ITerminalQuickFixAddon, ...options: ITerminalQuickFixOptions[]): void {
		for (const actionOption of options) {
			quickFixAddon.registerCommandFinishedListener(actionOption);
		}
	}

	private _initDimensions(): void {
		// The terminal panel needs to have been created to get the real view dimensions
		if (!this._container) {
			// Set the fallback dimensions if not
			this._cols = Constants.DefaultCols;
			this._rows = Constants.DefaultRows;
			return;
		}

		const computedStyle = window.getComputedStyle(this._container);
		const width = parseInt(computedStyle.width);
		const height = parseInt(computedStyle.height);

		this._evaluateColsAndRows(width, height);
	}

	/**
	 * Evaluates and sets the cols and rows of the terminal if possible.
	 * @param width The width of the container.
	 * @param height The height of the container.
	 * @return The terminal's width if it requires a layout.
	 */
	private _evaluateColsAndRows(width: number, height: number): number | null {
		// Ignore if dimensions are undefined or 0
		if (!width || !height) {
			this._setLastKnownColsAndRows();
			return null;
		}

		const dimension = this._getDimension(width, height);
		if (!dimension) {
			this._setLastKnownColsAndRows();
			return null;
		}

		const font = this.xterm ? this.xterm.getFont() : this._configHelper.getFont();
		if (!font.charWidth || !font.charHeight) {
			this._setLastKnownColsAndRows();
			return null;
		}

		// Because xterm.js converts from CSS pixels to actual pixels through
		// the use of canvas, window.devicePixelRatio needs to be used here in
		// order to be precise. font.charWidth/charHeight alone as insufficient
		// when window.devicePixelRatio changes.
		const scaledWidthAvailable = dimension.width * window.devicePixelRatio;

		const scaledCharWidth = font.charWidth * window.devicePixelRatio + font.letterSpacing;
		const newCols = Math.max(Math.floor(scaledWidthAvailable / scaledCharWidth), 1);

		const scaledHeightAvailable = dimension.height * window.devicePixelRatio;
		const scaledCharHeight = Math.ceil(font.charHeight * window.devicePixelRatio);
		const scaledLineHeight = Math.floor(scaledCharHeight * font.lineHeight);
		const newRows = Math.max(Math.floor(scaledHeightAvailable / scaledLineHeight), 1);

		if (this._cols !== newCols || this._rows !== newRows) {
			this._cols = newCols;
			this._rows = newRows;
			this._fireMaximumDimensionsChanged();
		}

		return dimension.width;
	}

	private _setLastKnownColsAndRows(): void {
		if (TerminalInstance._lastKnownGridDimensions) {
			this._cols = TerminalInstance._lastKnownGridDimensions.cols;
			this._rows = TerminalInstance._lastKnownGridDimensions.rows;
		}
	}

	@debounce(50)
	private _fireMaximumDimensionsChanged(): void {
		this._onMaximumDimensionsChanged.fire();
	}

	private _getDimension(width: number, height: number): ICanvasDimensions | undefined {
		// The font needs to have been initialized
		const font = this.xterm ? this.xterm.getFont() : this._configHelper.getFont();
		if (!font || !font.charWidth || !font.charHeight) {
			return undefined;
		}

		if (!this.xterm?.raw.element) {
			return undefined;
		}
		const computedStyle = window.getComputedStyle(this.xterm.raw.element);
		const horizontalPadding = parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight);
		const verticalPadding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
		TerminalInstance._lastKnownCanvasDimensions = new dom.Dimension(
			Math.min(Constants.MaxCanvasWidth, width - horizontalPadding),
			height + (this._hasScrollBar && !this._horizontalScrollbar ? -5/* scroll bar height */ : 0) - 2/* bottom padding */ - verticalPadding);
		return TerminalInstance._lastKnownCanvasDimensions;
	}

	get persistentProcessId(): number | undefined { return this._processManager.persistentProcessId; }
	get shouldPersist(): boolean { return this._processManager.shouldPersist && !this.shellLaunchConfig.isTransient && (!this.reconnectionProperties || this._configurationService.getValue(TaskSettingId.Reconnection) === true); }

	/**
	 * Create xterm.js instance and attach data listeners.
	 */
	protected async _createXterm(): Promise<XtermTerminal> {
		const Terminal = await getXtermConstructor();
		if (this._isDisposed) {
			throw new ErrorNoTelemetry('Terminal disposed of during xterm.js creation');
		}

		const xterm = this._scopedInstantiationService.createInstance(XtermTerminal, Terminal, this._configHelper, this._cols, this._rows, this.target || TerminalLocation.Panel, this.capabilities, this._terminalSuggestWidgetVisibleContextKey, this.disableShellIntegrationReporting);
		this.xterm = xterm;
		this._quickFixAddon = this._scopedInstantiationService.createInstance(TerminalQuickFixAddon, this._aliases, this.capabilities);
		this.xterm?.raw.loadAddon(this._quickFixAddon);
		this._registerQuickFixProvider(this._quickFixAddon, gitTwoDashes(), freePort(this), gitSimilar(), gitPushSetUpstream(), gitCreatePr(), pwshUnixCommandNotFoundError(), pwshGeneralError());
		this._register(this._quickFixAddon.onDidRequestRerunCommand(async (e) => await this.runCommand(e.command, e.addNewLine || false)));
		this.updateAccessibilitySupport();
		this.xterm.onDidRequestRunCommand(e => {
			if (e.copyAsHtml) {
				this.copySelection(true, e.command);
			} else {
				this.sendText(e.command.command, e.noNewLine ? false : true);
			}
		});
		this.xterm.onDidRequestFocus(() => this.focus());
		this.xterm.onDidRequestSendText(e => this.sendText(e, false));
		// Write initial text, deferring onLineFeed listener when applicable to avoid firing
		// onLineData events containing initialText
		const initialTextWrittenPromise = this._shellLaunchConfig.initialText ? new Promise<void>(r => this._writeInitialText(xterm, r)) : undefined;
		const lineDataEventAddon = new LineDataEventAddon(initialTextWrittenPromise);
		lineDataEventAddon.onLineData(e => this._onLineData.fire(e));
		this._lineDataEventAddon = lineDataEventAddon;
		// Delay the creation of the bell listener to avoid showing the bell when the terminal
		// starts up or reconnects
		setTimeout(() => {
			xterm.raw.onBell(() => {
				if (this._configHelper.config.enableBell) {
					this.statusList.add({
						id: TerminalStatus.Bell,
						severity: Severity.Warning,
						icon: Codicon.bell,
						tooltip: nls.localize('bellStatus', "Bell")
					}, this._configHelper.config.bellDuration);
					this._audioCueService.playSound(AudioCue.terminalBell.sound);
				}
			});
		}, 1000);
		this._xtermOnKey = xterm.raw.onKey(e => this._onKey(e.key, e.domEvent));
		xterm.raw.onSelectionChange(async () => this._onSelectionChange());
		xterm.raw.buffer.onBufferChange(() => this._refreshAltBufferContextKey());

		this._processManager.onProcessData(e => this._onProcessData(e));
		xterm.raw.onData(async data => {
			await this._processManager.write(data);
			this._onDidInputData.fire(this);
		});
		xterm.raw.onBinary(data => this._processManager.processBinary(data));
		// Init winpty compat and link handler after process creation as they rely on the
		// underlying process OS
		this._processManager.onProcessReady(async (processTraits) => {
			// If links are ready, do not re-create the manager.
			if (this._areLinksReady) {
				return;
			}

			if (this._processManager.os) {
				lineDataEventAddon.setOperatingSystem(this._processManager.os);
			}
			if (this._processManager.os === OperatingSystem.Windows) {
				xterm.raw.options.windowsMode = processTraits.requiresWindowsMode || false;
			}
			this._linkManager = this._scopedInstantiationService.createInstance(TerminalLinkManager, xterm.raw, this._processManager!, this.capabilities);
			this._areLinksReady = true;
			this._onLinksReady.fire(this);
		});
		this._processManager.onRestoreCommands(e => this.xterm?.shellIntegration.deserialize(e));

		this._loadTypeAheadAddon(xterm);

		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(TerminalSettingId.LocalEchoEnabled)) {
				this._loadTypeAheadAddon(xterm);
			}
		}));

		this._pathService.userHome().then(userHome => {
			this._userHome = userHome.fsPath;
		});

		if (this._isVisible) {
			this._open();
		}

		return xterm;
	}

	private async _onLineDataSetup(): Promise<void> {
		const xterm = this.xterm || await this._xtermReadyPromise;
		xterm.raw.loadAddon(this._lineDataEventAddon!);
	}

	async runCommand(commandLine: string, addNewLine: boolean): Promise<void> {
		// Determine whether to send ETX (ctrl+c) before running the command. This should always
		// happen unless command detection can reliably say that a command is being entered and
		// there is no content in the prompt
		if (this.capabilities.get(TerminalCapability.CommandDetection)?.hasInput !== false) {
			await this.sendText('\x03', false);
			// Wait a little before running the command to avoid the sequences being echoed while the ^C
			// is being evaluated
			await timeout(100);
		}
		// Use bracketed paste mode only when not running the command
		await this.sendText(commandLine, addNewLine, !addNewLine);
	}


	private _loadTypeAheadAddon(xterm: XtermTerminal): void {
		const enabled = this._configHelper.config.localEchoEnabled;
		const isRemote = !!this.remoteAuthority;
		if (enabled === 'off' || enabled === 'auto' && !isRemote) {
			return this._xtermTypeAheadAddon?.dispose();
		}
		if (this._xtermTypeAheadAddon) {
			return;
		}
		if (enabled === 'on' || (enabled === 'auto' && isRemote)) {
			this._xtermTypeAheadAddon = this._register(this._scopedInstantiationService.createInstance(TypeAheadAddon, this._processManager, this._configHelper));
			xterm.raw.loadAddon(this._xtermTypeAheadAddon);
		}
	}

	async showLinkQuickpick(extended?: boolean): Promise<void> {
		if (!this._terminalLinkQuickpick) {
			this._terminalLinkQuickpick = this._scopedInstantiationService.createInstance(TerminalLinkQuickpick);
			this._terminalLinkQuickpick.onDidRequestMoreLinks(() => {
				this.showLinkQuickpick(true);
			});
		}
		const links = await this._getLinks(extended);
		if (!links) {
			return;
		}
		return await this._terminalLinkQuickpick.show(links);
	}

	private async _getLinks(extended?: boolean): Promise<IDetectedLinks | undefined> {
		if (!this.areLinksReady || !this._linkManager) {
			throw new Error('terminal links are not ready, cannot generate link quick pick');
		}
		if (!this.xterm) {
			throw new Error('no xterm');
		}
		return this._linkManager.getLinks(extended);
	}

	async openRecentLink(type: 'localFile' | 'url'): Promise<void> {
		if (!this.areLinksReady || !this._linkManager) {
			throw new Error('terminal links are not ready, cannot open a link');
		}
		if (!this.xterm) {
			throw new Error('no xterm');
		}
		this._linkManager.openRecentLink(type);
	}

	async runRecent(type: 'command' | 'cwd', filterMode?: 'fuzzy' | 'contiguous', value?: string): Promise<void> {
		return this._scopedInstantiationService.invokeFunction(
			showRunRecentQuickPick, this, this._terminalInRunCommandPicker, type, filterMode, value
		);
	}

	detachFromElement(): void {
		this._wrapperElement.remove();
		this._container = undefined;
	}

	attachToElement(container: HTMLElement): void {
		// The container did not change, do nothing
		if (this._container === container) {
			return;
		}

		this._attachBarrier.open();

		// The container changed, reattach
		this._container = container;
		this._container.appendChild(this._wrapperElement);
		if (this.findWidget.hasValue) {
			this._container.appendChild(this.findWidget.value.getDomNode());
		}
		setTimeout(() => this._initDragAndDrop(container));
	}

	/**
	 * Opens the the terminal instance inside the parent DOM element previously set with
	 * `attachToElement`, you must ensure the parent DOM element is explicitly visible before
	 * invoking this function as it performs some DOM calculations internally
	 */
	private _open(): void {
		if (!this.xterm || this.xterm.raw.element) {
			return;
		}

		if (!this._container || !this._container.isConnected) {
			throw new Error('A container element needs to be set with `attachToElement` and be part of the DOM before calling `_open`');
		}

		const xtermElement = document.createElement('div');
		this._wrapperElement.appendChild(xtermElement);

		this._container.appendChild(this._wrapperElement);
		if (this.findWidget.hasValue) {
			this._container.appendChild(this.findWidget.value.getDomNode());
		}

		const xterm = this.xterm;

		// Attach the xterm object to the DOM, exposing it to the smoke tests
		this._wrapperElement.xterm = xterm.raw;

		const screenElement = xterm.attachToElement(xtermElement);

		this._register(xterm.onDidChangeFindResults(() => this.findWidget.value.updateResultCount()));
		this._register(xterm.shellIntegration.onDidChangeStatus(() => {
			if (this.hasFocus) {
				this._setShellIntegrationContextKey();
			} else {
				this._terminalShellIntegrationEnabledContextKey.reset();
			}
		}));

		if (!xterm.raw.element || !xterm.raw.textarea) {
			throw new Error('xterm elements not set after open');
		}

		this._setAriaLabel(xterm.raw, this._instanceId, this._title);

		xterm.raw.attachCustomKeyEventHandler((event: KeyboardEvent): boolean => {
			// Disable all input if the terminal is exiting
			if (this._isExiting) {
				return false;
			}

			const standardKeyboardEvent = new StandardKeyboardEvent(event);
			const resolveResult = this._keybindingService.softDispatch(standardKeyboardEvent, standardKeyboardEvent.target);

			// Respect chords if the allowChords setting is set and it's not Escape. Escape is
			// handled specially for Zen Mode's Escape, Escape chord, plus it's important in
			// terminals generally
			const isValidChord = resolveResult?.enterMultiChord && this._configHelper.config.allowChords && event.key !== 'Escape';
			if (this._keybindingService.inChordMode || isValidChord) {
				event.preventDefault();
				return false;
			}

			const SHOW_TERMINAL_CONFIG_PROMPT_KEY = 'terminal.integrated.showTerminalConfigPrompt';
			const EXCLUDED_KEYS = ['RightArrow', 'LeftArrow', 'UpArrow', 'DownArrow', 'Space', 'Meta', 'Control', 'Shift', 'Alt', '', 'Delete', 'Backspace', 'Tab'];

			// only keep track of input if prompt hasn't already been shown
			if (this._storageService.getBoolean(SHOW_TERMINAL_CONFIG_PROMPT_KEY, StorageScope.APPLICATION, true) &&
				!EXCLUDED_KEYS.includes(event.key) &&
				!event.ctrlKey &&
				!event.shiftKey &&
				!event.altKey) {
				this._hasHadInput = true;
			}

			// for keyboard events that resolve to commands described
			// within commandsToSkipShell, either alert or skip processing by xterm.js
			if (resolveResult && resolveResult.commandId && this._skipTerminalCommands.some(k => k === resolveResult.commandId) && !this._configHelper.config.sendKeybindingsToShell) {
				// don't alert when terminal is opened or closed
				if (this._storageService.getBoolean(SHOW_TERMINAL_CONFIG_PROMPT_KEY, StorageScope.APPLICATION, true) &&
					this._hasHadInput &&
					!TERMINAL_CREATION_COMMANDS.includes(resolveResult.commandId)) {
					this._notificationService.prompt(
						Severity.Info,
						nls.localize('keybindingHandling', "Some keybindings don't go to the terminal by default and are handled by {0} instead.", this._productService.nameLong),
						[
							{
								label: nls.localize('configureTerminalSettings', "Configure Terminal Settings"),
								run: () => {
									this._preferencesService.openSettings({ jsonEditor: false, query: `@id:${TerminalSettingId.CommandsToSkipShell},${TerminalSettingId.SendKeybindingsToShell},${TerminalSettingId.AllowChords}` });
								}
							} as IPromptChoice
						]
					);
					this._storageService.store(SHOW_TERMINAL_CONFIG_PROMPT_KEY, false, StorageScope.APPLICATION, StorageTarget.USER);
				}
				event.preventDefault();
				return false;
			}

			// Skip processing by xterm.js of keyboard events that match menu bar mnemonics
			if (this._configHelper.config.allowMnemonics && !isMacintosh && event.altKey) {
				return false;
			}

			// If tab focus mode is on, tab is not passed to the terminal
			if (TabFocus.getTabFocusMode(TabFocusContext.Terminal) && event.keyCode === 9) {
				return false;
			}

			// Always have alt+F4 skip the terminal on Windows and allow it to be handled by the
			// system
			if (isWindows && event.altKey && event.key === 'F4' && !event.ctrlKey) {
				return false;
			}

			// Fallback to force ctrl+v to paste on browsers that do not support
			// navigator.clipboard.readText
			if (!BrowserFeatures.clipboard.readText && event.key === 'v' && event.ctrlKey) {
				return false;
			}

			return true;
		});
		this._register(dom.addDisposableListener(xterm.raw.element, 'mousedown', () => {
			// We need to listen to the mouseup event on the document since the user may release
			// the mouse button anywhere outside of _xterm.element.
			const listener = dom.addDisposableListener(document, 'mouseup', () => {
				// Delay with a setTimeout to allow the mouseup to propagate through the DOM
				// before evaluating the new selection state.
				setTimeout(() => this._refreshSelectionContextKey(), 0);
				listener.dispose();
			});
		}));
		this._register(dom.addDisposableListener(xterm.raw.element, 'touchstart', () => {
			xterm.raw.focus();
		}));

		// xterm.js currently drops selection on keyup as we need to handle this case.
		this._register(dom.addDisposableListener(xterm.raw.element, 'keyup', () => {
			// Wait until keyup has propagated through the DOM before evaluating
			// the new selection state.
			setTimeout(() => this._refreshSelectionContextKey(), 0);
		}));

		this._register(dom.addDisposableListener(xterm.raw.textarea, 'focus', () => this._setFocus(true)));
		this._register(dom.addDisposableListener(xterm.raw.textarea, 'blur', () => this._setFocus(false)));
		this._register(dom.addDisposableListener(xterm.raw.textarea, 'focusout', () => this._setFocus(false)));

		this._initDragAndDrop(this._container);

		this._widgetManager.attachToElement(screenElement);
		this._processManager.onProcessReady((e) => {
			this._linkManager?.setWidgetManager(this._widgetManager);
		});

		if (this._lastLayoutDimensions) {
			this.layout(this._lastLayoutDimensions);
		}
		this.updateConfig();

		// If IShellLaunchConfig.waitOnExit was true and the process finished before the terminal
		// panel was initialized.
		if (xterm.raw.options.disableStdin) {
			this._attachPressAnyKeyToCloseListener(xterm.raw);
		}
	}

	private _setFocus(focused?: boolean): void {
		if (focused) {
			this._terminalFocusContextKey.set(true);
			this._setShellIntegrationContextKey();
			this._onDidFocus.fire(this);
		} else {
			this.resetFocusContextKey();
			this._onDidBlur.fire(this);
			this._refreshSelectionContextKey();
		}
	}

	private _setShellIntegrationContextKey(): void {
		if (this.xterm) {
			this._terminalShellIntegrationEnabledContextKey.set(this.xterm.shellIntegration.status === ShellIntegrationStatus.VSCode);
		}
	}

	resetFocusContextKey(): void {
		this._terminalFocusContextKey.reset();
		this._terminalShellIntegrationEnabledContextKey.reset();
	}

	private _initDragAndDrop(container: HTMLElement) {
		this._dndObserver?.dispose();
		const dndController = this._scopedInstantiationService.createInstance(TerminalInstanceDragAndDropController, container);
		dndController.onDropTerminal(e => this._onRequestAddInstanceToGroup.fire(e));
		dndController.onDropFile(async path => {
			this.focus();
			await this.sendPath(path, false);
		});
		this._dndObserver = new dom.DragAndDropObserver(container, dndController);
	}

	hasSelection(): boolean {
		return this.xterm ? this.xterm.raw.hasSelection() : false;
	}

	showAccessibilityHelp(): void {
		if (!this.xterm?.raw.buffer || !this._container) {
			return;
		}
		this._scopedInstantiationService.createInstance(AccessibilityHelpWidget, this).attach(this._wrapperElement);
	}

	async copySelection(asHtml?: boolean, command?: ITerminalCommand): Promise<void> {
		const xterm = await this._xtermReadyPromise;
		if (this.hasSelection() || (asHtml && command)) {
			if (asHtml) {
				const textAsHtml = await xterm.getSelectionAsHtml(command);
				function listener(e: any) {
					if (!e.clipboardData.types.includes('text/plain')) {
						e.clipboardData.setData('text/plain', command?.getOutput() ?? '');
					}
					e.clipboardData.setData('text/html', textAsHtml);
					e.preventDefault();
				}
				document.addEventListener('copy', listener);
				document.execCommand('copy');
				document.removeEventListener('copy', listener);
			} else {
				await this._clipboardService.writeText(xterm.raw.getSelection());
			}
		} else {
			this._notificationService.warn(nls.localize('terminal.integrated.copySelection.noSelection', 'The terminal has no selection to copy'));
		}
	}

	get selection(): string | undefined {
		return this.xterm && this.hasSelection() ? this.xterm.raw.getSelection() : undefined;
	}

	clearSelection(): void {
		this.xterm?.raw.clearSelection();
	}

	selectAll(): void {
		// Focus here to ensure the terminal context key is set
		this.xterm?.raw.focus();
		this.xterm?.raw.selectAll();
	}

	private _refreshAltBufferContextKey() {
		this._terminalAltBufferActiveContextKey.set(!!(this.xterm && this.xterm.raw.buffer.active === this.xterm.raw.buffer.alternate));
	}

	private async _shouldPasteText(text: string): Promise<boolean> {
		// Ignore check if the shell is in bracketed paste mode (ie. the shell can handle multi-line
		// text).
		if (this.xterm?.raw.modes.bracketedPasteMode) {
			return true;
		}

		const textForLines = text.split(/\r?\n/);
		// Ignore check when a command is copied with a trailing new line
		if (textForLines.length === 2 && textForLines[1].trim().length === 0) {
			return true;
		}

		// If the clipboard has only one line, no prompt will be triggered
		if (textForLines.length === 1 || !this._configurationService.getValue<boolean>(TerminalSettingId.EnableMultiLinePasteWarning)) {
			return true;
		}

		const displayItemsCount = 3;
		const maxPreviewLineLength = 30;

		let detail = nls.localize('preview', "Preview:");
		for (let i = 0; i < Math.min(textForLines.length, displayItemsCount); i++) {
			const line = textForLines[i];
			const cleanedLine = line.length > maxPreviewLineLength ? `${line.slice(0, maxPreviewLineLength)}…` : line;
			detail += `\n${cleanedLine}`;
		}

		if (textForLines.length > displayItemsCount) {
			detail += `\n…`;
		}

		const { confirmed, checkboxChecked } = await this._dialogService.confirm({
			message: nls.localize('confirmMoveTrashMessageFilesAndDirectories', "Are you sure you want to paste {0} lines of text into the terminal?", textForLines.length),
			detail,
			primaryButton: nls.localize({ key: 'multiLinePasteButton', comment: ['&& denotes a mnemonic'] }, "&&Paste"),
			checkbox: {
				label: nls.localize('doNotAskAgain', "Do not ask me again")
			}
		});

		if (confirmed && checkboxChecked) {
			await this._configurationService.updateValue(TerminalSettingId.EnableMultiLinePasteWarning, false);
		}

		return confirmed;
	}

	override dispose(reason?: TerminalExitReason): void {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		this._logService.trace(`terminalInstance#dispose (instanceId: ${this.instanceId})`);
		dispose(this._linkManager);
		this._linkManager = undefined;
		dispose(this._widgetManager);
		dispose(this.findWidget.rawValue);

		if (this.xterm?.raw.element) {
			this._hadFocusOnExit = this.hasFocus;
		}
		if (this._wrapperElement.xterm) {
			this._wrapperElement.xterm = undefined;
		}
		if (this._horizontalScrollbar) {
			this._horizontalScrollbar.dispose();
			this._horizontalScrollbar = undefined;
		}

		try {
			this.xterm?.dispose();
		} catch (err: unknown) {
			// See https://github.com/microsoft/vscode/issues/153486
			this._logService.error('Exception occurred during xterm disposal', err);
		}

		// HACK: Workaround for Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=559561,
		// as 'blur' event in xterm.raw.textarea is not triggered on xterm.dispose()
		// See https://github.com/microsoft/vscode/issues/138358
		if (isFirefox) {
			this.resetFocusContextKey();
			this._terminalHasTextContextKey.reset();
			this._onDidBlur.fire(this);
		}

		if (this._pressAnyKeyToCloseListener) {
			this._pressAnyKeyToCloseListener.dispose();
			this._pressAnyKeyToCloseListener = undefined;
		}

		if (this._exitReason === undefined) {
			this._exitReason = reason ?? TerminalExitReason.Unknown;
		}

		this._processManager.dispose();
		// Process manager dispose/shutdown doesn't fire process exit, trigger with undefined if it
		// hasn't happened yet
		this._onProcessExit(undefined);

		this._onDisposed.fire(this);

		super.dispose();
	}

	async detachProcessAndDispose(reason: TerminalExitReason): Promise<void> {
		// Detach the process and dispose the instance, without the instance dispose the terminal
		// won't go away. Force persist if the detach was requested by the user (not shutdown).
		await this._processManager.detachFromProcess(reason === TerminalExitReason.User);
		this.dispose(reason);
	}

	focus(force?: boolean): void {
		this._refreshAltBufferContextKey();
		if (!this.xterm) {
			return;
		}
		if (force || !window.getSelection()?.toString()) {
			this.xterm.raw.focus();
		}
	}

	async focusWhenReady(force?: boolean): Promise<void> {
		await this._xtermReadyPromise;
		await this._attachBarrier.wait();
		this.focus(force);
	}

	async paste(): Promise<void> {
		if (!this.xterm) {
			return;
		}

		const currentText: string = await this._clipboardService.readText();
		if (!await this._shouldPasteText(currentText)) {
			return;
		}

		this.focus();
		this.xterm.raw.paste(currentText);
	}

	async pasteSelection(): Promise<void> {
		if (!this.xterm) {
			return;
		}

		const currentText: string = await this._clipboardService.readText('selection');
		if (!await this._shouldPasteText(currentText)) {
			return;
		}

		this.focus();
		this.xterm.raw.paste(currentText);
	}

	async sendText(text: string, addNewLine: boolean, bracketedPasteMode?: boolean): Promise<void> {
		// Apply bracketed paste sequences if the terminal has the mode enabled, this will prevent
		// the text from triggering keybindings and ensure new lines are handled properly
		if (bracketedPasteMode && this.xterm?.raw.modes.bracketedPasteMode) {
			text = `\x1b[200~${text}\x1b[201~`;
		}

		// Normalize line endings to 'enter' press.
		text = text.replace(/\r?\n/g, '\r');
		if (addNewLine && !text.endsWith('\r')) {
			text += '\r';
		}

		// Send it to the process
		await this._processManager.write(text);
		this._onDidInputData.fire(this);
		this.xterm?.suggestController?.handleNonXtermData(text);
		this.xterm?.scrollToBottom();
	}

	async sendPath(originalPath: string | URI, addNewLine: boolean): Promise<void> {
		return this.sendText(await this.preparePathForShell(originalPath), addNewLine);
	}

	async preparePathForShell(originalPath: string | URI): Promise<string> {
		// Wait for shell type to be ready
		await this.processReady;
		return preparePathForShell(originalPath, this.shellLaunchConfig.executable, this.title, this.shellType, this._processManager.backend, this._processManager.os);
	}

	setVisible(visible: boolean): void {
		this._isVisible = visible;
		this._wrapperElement.classList.toggle('active', visible);
		if (visible && this.xterm) {
			this._open();
			// Resize to re-evaluate dimensions, this will ensure when switching to a terminal it is
			// using the most up to date dimensions (eg. when terminal is created in the background
			// using cached dimensions of a split terminal).
			this._resize();
			// Trigger a forced refresh of the viewport to sync the viewport and scroll bar. This is
			// necessary if the number of rows in the terminal has decreased while it was in the
			// background since scrollTop changes take no effect but the terminal's position does
			// change since the number of visible rows decreases.
			// This can likely be removed after https://github.com/xtermjs/xterm.js/issues/291 is
			// fixed upstream.
			this.xterm.forceRefresh();
		}
	}

	scrollDownLine(): void {
		this.xterm?.scrollDownLine();
	}

	scrollDownPage(): void {
		this.xterm?.scrollDownPage();
	}

	scrollToBottom(): void {
		this.xterm?.scrollToBottom();
	}

	scrollUpLine(): void {
		this.xterm?.scrollUpLine();
	}

	scrollUpPage(): void {
		this.xterm?.scrollUpPage();
	}

	scrollToTop(): void {
		this.xterm?.scrollToTop();
	}

	clearBuffer(): void {
		this.xterm?.clearBuffer();
	}

	private _refreshSelectionContextKey() {
		const isActive = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
		let isEditorActive = false;
		const editor = this._editorService.activeEditor;
		if (editor) {
			isEditorActive = editor instanceof TerminalEditorInput;
		}
		this._terminalHasTextContextKey.set((isActive || isEditorActive) && this.hasSelection());
	}

	protected _createProcessManager(): TerminalProcessManager {
		let deserializedCollections: ReadonlyMap<string, IEnvironmentVariableCollection> | undefined;
		if (this.shellLaunchConfig.attachPersistentProcess?.environmentVariableCollections) {
			deserializedCollections = deserializeEnvironmentVariableCollections(this.shellLaunchConfig.attachPersistentProcess.environmentVariableCollections);
		}
		const processManager = this._scopedInstantiationService.createInstance(TerminalProcessManager, this._instanceId, this._configHelper, this.shellLaunchConfig?.cwd, deserializedCollections);
		this.capabilities.add(processManager.capabilities);
		processManager.onProcessReady(async (e) => {
			this._onProcessIdReady.fire(this);
			this._initialCwd = await this.getInitialCwd();
			// Set the initial name based on the _resolved_ shell launch config, this will also
			// ensure the resolved icon gets shown
			if (!this._labelComputer) {
				this._labelComputer = this._register(this._scopedInstantiationService.createInstance(TerminalLabelComputer, this._configHelper, this));
				this._labelComputer.onDidChangeLabel(e => {
					this._title = e.title;
					this._description = e.description;
					this._onTitleChanged.fire(this);
				});
			}
			if (this._shellLaunchConfig.name) {
				this._setTitle(this._shellLaunchConfig.name, TitleEventSource.Api);
			} else {
				// Listen to xterm.js' sequence title change event, trigger this async to ensure
				// _xtermReadyPromise is ready constructed since this is called from the ctor
				setTimeout(() => {
					this._xtermReadyPromise.then(xterm => {
						this._messageTitleDisposable = xterm.raw.onTitleChange(e => this._onTitleChange(e));
					});
				});
				this._setTitle(this._shellLaunchConfig.executable, TitleEventSource.Process);
			}
		});
		processManager.onProcessExit(exitCode => this._onProcessExit(exitCode));
		processManager.onDidChangeProperty(({ type, value }) => {
			switch (type) {
				case ProcessPropertyType.Cwd:
					this._cwd = value;
					this._labelComputer?.refreshLabel();
					break;
				case ProcessPropertyType.InitialCwd:
					this._initialCwd = value;
					this._cwd = this._initialCwd;
					this._setTitle(this.title, TitleEventSource.Config);
					break;
				case ProcessPropertyType.Title:
					this._setTitle(value ?? '', TitleEventSource.Process);
					break;
				case ProcessPropertyType.OverrideDimensions:
					this.setOverrideDimensions(value, true);
					break;
				case ProcessPropertyType.ResolvedShellLaunchConfig:
					this._setResolvedShellLaunchConfig(value);
					break;
				case ProcessPropertyType.ShellType:
					this.setShellType(value);
					break;
				case ProcessPropertyType.HasChildProcesses:
					this._onDidChangeHasChildProcesses.fire(value);
					break;
				case ProcessPropertyType.UsedShellIntegrationInjection:
					this._usedShellIntegrationInjection = true;
					break;
			}
		});

		processManager.onProcessData(ev => {
			this._initialDataEvents?.push(ev.data);
			this._onData.fire(ev.data);
		});
		processManager.onEnvironmentVariableInfoChanged(e => this._onEnvironmentVariableInfoChanged(e));
		processManager.onPtyDisconnect(() => {
			if (this.xterm) {
				this.xterm.raw.options.disableStdin = true;
			}
			this.statusList.add({
				id: TerminalStatus.Disconnected,
				severity: Severity.Error,
				icon: Codicon.debugDisconnect,
				tooltip: nls.localize('disconnectStatus', "Lost connection to process")
			});
		});
		processManager.onPtyReconnect(() => {
			if (this.xterm) {
				this.xterm.raw.options.disableStdin = false;
			}
			this.statusList.remove(TerminalStatus.Disconnected);
		});

		return processManager;
	}

	private async _createProcess(): Promise<void> {
		if (this._isDisposed) {
			return;
		}
		const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);
		if (activeWorkspaceRootUri) {
			const trusted = await this._trust();
			if (!trusted) {
				this._onProcessExit({ message: nls.localize('workspaceNotTrustedCreateTerminal', "Cannot launch a terminal process in an untrusted workspace") });
			}
		} else if (this._cwd && this._userHome && this._cwd !== this._userHome) {
			// something strange is going on if cwd is not userHome in an empty workspace
			this._onProcessExit({
				message: nls.localize('workspaceNotTrustedCreateTerminalCwd', "Cannot launch a terminal process in an untrusted workspace with cwd {0} and userHome {1}", this._cwd, this._userHome)
			});
		}

		// Re-evaluate dimensions if the container has been set since the xterm instance was created
		if (this._container && this._cols === 0 && this._rows === 0) {
			this._initDimensions();
			this.xterm?.raw.resize(this._cols || Constants.DefaultCols, this._rows || Constants.DefaultRows);
		}
		const originalIcon = this.shellLaunchConfig.icon;
		await this._processManager.createProcess(this._shellLaunchConfig, this._cols || Constants.DefaultCols, this._rows || Constants.DefaultRows).then(error => {
			if (error) {
				this._onProcessExit(error);
			}
		});
		if (this.xterm?.shellIntegration) {
			this.capabilities.add(this.xterm?.shellIntegration.capabilities);
		}
		if (originalIcon !== this.shellLaunchConfig.icon || this.shellLaunchConfig.color) {
			this._icon = this._shellLaunchConfig.attachPersistentProcess?.icon || this._shellLaunchConfig.icon;
			this._onIconChanged.fire({ instance: this, userInitiated: false });
		}
	}

	public registerMarker(): IMarker | undefined {
		return this.xterm?.raw.registerMarker();
	}

	public addBufferMarker(properties: IMarkProperties): void {
		this.capabilities.get(TerminalCapability.BufferMarkDetection)?.addMark(properties);
	}

	public scrollToMark(startMarkId: string, endMarkId?: string, highlight?: boolean): void {
		this.xterm?.markTracker.scrollToClosestMarker(startMarkId, endMarkId, highlight);
	}

	public async freePortKillProcess(port: string, command: string): Promise<void> {
		await this._processManager?.freePortKillProcess(port);
		this.runCommand(command, false);
	}

	private _onProcessData(ev: IProcessDataEvent): void {
		const messageId = ++this._latestXtermWriteData;
		if (ev.trackCommit) {
			ev.writePromise = new Promise<void>(r => {
				this.xterm?.raw.write(ev.data, () => {
					this._latestXtermParseData = messageId;
					this._processManager.acknowledgeDataEvent(ev.data.length);
					r();
				});
			});
		} else {
			this.xterm?.raw.write(ev.data, () => {
				this._latestXtermParseData = messageId;
				this._processManager.acknowledgeDataEvent(ev.data.length);
			});
		}
	}

	/**
	 * Called when either a process tied to a terminal has exited or when a terminal renderer
	 * simulates a process exiting (e.g. custom execution task).
	 * @param exitCode The exit code of the process, this is undefined when the terminal was exited
	 * through user action.
	 */
	private async _onProcessExit(exitCodeOrError?: number | ITerminalLaunchError): Promise<void> {
		// Prevent dispose functions being triggered multiple times
		if (this._isExiting) {
			return;
		}
		const parsedExitResult = parseExitResult(exitCodeOrError, this.shellLaunchConfig, this._processManager.processState, this._initialCwd);

		if (this._usedShellIntegrationInjection && this._processManager.processState === ProcessState.KilledDuringLaunch && parsedExitResult?.code !== 0) {
			this._relaunchWithShellIntegrationDisabled(parsedExitResult?.message);
			this._onExit.fire(exitCodeOrError);
			return;
		}

		this._isExiting = true;

		await this._flushXtermData();
		this._logService.debug(`Terminal process exit (instanceId: ${this.instanceId}) with code ${this._exitCode}`);

		this._exitCode = parsedExitResult?.code;
		const exitMessage = parsedExitResult?.message;

		this._logService.debug(`Terminal process exit (instanceId: ${this.instanceId}) state ${this._processManager.processState}`);

		// Only trigger wait on exit when the exit was *not* triggered by the
		// user (via the `workbench.action.terminal.kill` command).
		const waitOnExit = this.waitOnExit;
		if (waitOnExit && this._processManager.processState !== ProcessState.KilledByUser) {
			this._xtermReadyPromise.then(xterm => {
				if (exitMessage) {
					xterm.raw.write(formatMessageForTerminal(exitMessage));
				}
				switch (typeof waitOnExit) {
					case 'string':
						xterm.raw.write(formatMessageForTerminal(waitOnExit, { excludeLeadingNewLine: true }));
						break;
					case 'function':
						if (this.exitCode !== undefined) {
							xterm.raw.write(formatMessageForTerminal(waitOnExit(this.exitCode), { excludeLeadingNewLine: true }));
						}
						break;
				}
				// Disable all input if the terminal is exiting and listen for next keypress
				xterm.raw.options.disableStdin = true;
				if (xterm.raw.textarea) {
					this._attachPressAnyKeyToCloseListener(xterm.raw);
				}
			});
		} else {
			this.dispose(TerminalExitReason.Process);
			if (exitMessage) {
				const failedDuringLaunch = this._processManager.processState === ProcessState.KilledDuringLaunch;
				if (failedDuringLaunch || this._configHelper.config.showExitAlert) {
					// Always show launch failures
					this._notificationService.notify({
						message: exitMessage,
						severity: Severity.Error,
						actions: { primary: [this._scopedInstantiationService.createInstance(TerminalLaunchHelpAction)] }
					});
				} else {
					// Log to help surface the error in case users report issues with showExitAlert
					// disabled
					this._logService.warn(exitMessage);
				}
			}
		}

		// First onExit to consumers, this can happen after the terminal has already been disposed.
		this._onExit.fire(exitCodeOrError);

		// Dispose of the onExit event if the terminal will not be reused again
		if (this._isDisposed) {
			this._onExit.dispose();
		}
	}

	private _relaunchWithShellIntegrationDisabled(exitMessage: string | undefined): void {
		this._shellLaunchConfig.ignoreShellIntegration = true;
		this.relaunch();
		this.statusList.add({
			id: TerminalStatus.ShellIntegrationAttentionNeeded,
			severity: Severity.Warning,
			icon: Codicon.warning,
			tooltip: (`${exitMessage} ` ?? '') + nls.localize('launchFailed.exitCodeOnlyShellIntegration', 'Disabling shell integration in user settings might help.'),
			hoverActions: [{
				commandId: TerminalCommandId.ShellIntegrationLearnMore,
				label: nls.localize('shellIntegration.learnMore', "Learn more about shell integration"),
				run: () => {
					this._openerService.open('https://code.visualstudio.com/docs/editor/integrated-terminal#_shell-integration');
				}
			}, {
				commandId: 'workbench.action.openSettings',
				label: nls.localize('shellIntegration.openSettings', "Open user settings"),
				run: () => {
					this._commandService.executeCommand('workbench.action.openSettings', 'terminal.integrated.shellIntegration.enabled');
				}
			}]
		});
		this._telemetryService.publicLog2<{}, { owner: 'meganrogge'; comment: 'Indicates the process exited when created with shell integration args' }>('terminal/shellIntegrationFailureProcessExit');
	}

	/**
	 * Ensure write calls to xterm.js have finished before resolving.
	 */
	private _flushXtermData(): Promise<void> {
		if (this._latestXtermWriteData === this._latestXtermParseData) {
			return Promise.resolve();
		}
		let retries = 0;
		return new Promise<void>(r => {
			const interval = setInterval(() => {
				if (this._latestXtermWriteData === this._latestXtermParseData || ++retries === 5) {
					clearInterval(interval);
					r();
				}
			}, 20);
		});
	}

	private _attachPressAnyKeyToCloseListener(xterm: XTermTerminal) {
		if (xterm.textarea && !this._pressAnyKeyToCloseListener) {
			this._pressAnyKeyToCloseListener = dom.addDisposableListener(xterm.textarea, 'keypress', (event: KeyboardEvent) => {
				if (this._pressAnyKeyToCloseListener) {
					this._pressAnyKeyToCloseListener.dispose();
					this._pressAnyKeyToCloseListener = undefined;
					this.dispose(TerminalExitReason.Process);
					event.preventDefault();
				}
			});
		}
	}

	private _writeInitialText(xterm: XtermTerminal, callback?: () => void): void {
		if (!this._shellLaunchConfig.initialText) {
			callback?.();
			return;
		}
		const text = typeof this._shellLaunchConfig.initialText === 'string'
			? this._shellLaunchConfig.initialText
			: this._shellLaunchConfig.initialText?.text;
		if (typeof this._shellLaunchConfig.initialText === 'string') {
			xterm.raw.writeln(text, callback);
		} else {
			if (this._shellLaunchConfig.initialText.trailingNewLine) {
				xterm.raw.writeln(text, callback);
			} else {
				xterm.raw.write(text, callback);
			}
		}
	}

	async reuseTerminal(shell: IShellLaunchConfig, reset: boolean = false): Promise<void> {
		// Unsubscribe any key listener we may have.
		this._pressAnyKeyToCloseListener?.dispose();
		this._pressAnyKeyToCloseListener = undefined;

		const xterm = this.xterm;
		if (xterm) {
			if (!reset) {
				// Ensure new processes' output starts at start of new line
				await new Promise<void>(r => xterm.raw.write('\n\x1b[G', r));
			}

			// Print initialText if specified
			if (shell.initialText) {
				this._shellLaunchConfig.initialText = shell.initialText;
				await new Promise<void>(r => this._writeInitialText(xterm, r));
			}

			// Clean up waitOnExit state
			if (this._isExiting && this._shellLaunchConfig.waitOnExit) {
				xterm.raw.options.disableStdin = false;
				this._isExiting = false;
			}
			if (reset) {
				xterm.clearDecorations();
			}
		}

		// Dispose the environment info widget if it exists
		this.statusList.remove(TerminalStatus.RelaunchNeeded);
		this._environmentInfo?.disposable.dispose();
		this._environmentInfo = undefined;

		if (!reset) {
			// HACK: Force initialText to be non-falsy for reused terminals such that the
			// conptyInheritCursor flag is passed to the node-pty, this flag can cause a Window to stop
			// responding in Windows 10 1903 so we only want to use it when something is definitely written
			// to the terminal.
			shell.initialText = ' ';
		}

		// Set the new shell launch config
		this._shellLaunchConfig = shell; // Must be done before calling _createProcess()
		await this._processManager.relaunch(this._shellLaunchConfig, this._cols || Constants.DefaultCols, this._rows || Constants.DefaultRows, reset).then(error => {
			if (error) {
				this._onProcessExit(error);
			}
		});

		this._xtermTypeAheadAddon?.reset();
	}

	async setEscapeSequenceLogging(enable: boolean): Promise<void> {
		const xterm = await this._xtermReadyPromise;
		xterm.raw.options.logLevel = enable ? 'debug' : 'info';
	}

	@debounce(1000)
	relaunch(): void {
		this.reuseTerminal(this._shellLaunchConfig, true);
	}

	private _onTitleChange(title: string): void {
		if (this.isTitleSetByProcess) {
			this._setTitle(title, TitleEventSource.Sequence);
		}
	}

	private async _trust(): Promise<boolean> {
		return (await this._workspaceTrustRequestService.requestWorkspaceTrust(
			{
				message: nls.localize('terminal.requestTrust', "Creating a terminal process requires executing code")
			})) === true;
	}

	private _onKey(key: string, ev: KeyboardEvent): void {
		const event = new StandardKeyboardEvent(ev);

		if (event.equals(KeyCode.Enter)) {
			this._updateProcessCwd();
		}
	}

	private async _onSelectionChange(): Promise<void> {
		if (this._configurationService.getValue(TerminalSettingId.CopyOnSelection)) {
			if (this.hasSelection()) {
				await this.copySelection();
			}
		}
	}

	@debounce(2000)
	private async _updateProcessCwd(): Promise<void> {
		if (this._isDisposed || this.shellLaunchConfig.customPtyImplementation) {
			return;
		}
		// reset cwd if it has changed, so file based url paths can be resolved
		try {
			const cwd = await this._refreshProperty(ProcessPropertyType.Cwd);
			if (typeof cwd !== 'string') {
				throw new Error(`cwd is not a string ${cwd}`);
			}
		} catch (e: unknown) {
			// Swallow this as it means the process has been killed
			if (e instanceof Error && e.message === 'Cannot refresh property when process is not set') {
				return;
			}
			throw e;
		}
	}

	updateConfig(): void {
		this._setCommandsToSkipShell(this._configHelper.config.commandsToSkipShell);
		this._refreshEnvironmentVariableInfoWidgetState(this._processManager.environmentVariableInfo);
	}

	private async _updateUnicodeVersion(): Promise<void> {
		this._processManager.setUnicodeVersion(this._configHelper.config.unicodeVersion);
	}

	updateAccessibilitySupport(): void {
		this.xterm!.raw.options.screenReaderMode = this._accessibilityService.isScreenReaderOptimized();
	}

	private _setCommandsToSkipShell(commands: string[]): void {
		const excludeCommands = commands.filter(command => command[0] === '-').map(command => command.slice(1));
		this._skipTerminalCommands = DEFAULT_COMMANDS_TO_SKIP_SHELL.filter(defaultCommand => {
			return !excludeCommands.includes(defaultCommand);
		}).concat(commands);
	}

	layout(dimension: dom.Dimension): void {
		this._lastLayoutDimensions = dimension;
		if (this.disableLayout) {
			return;
		}

		// Don't layout if dimensions are invalid (eg. the container is not attached to the DOM or
		// if display: none
		if (dimension.width <= 0 || dimension.height <= 0) {
			return;
		}

		// Evaluate columns and rows, exclude the wrapper element's margin
		const terminalWidth = this._evaluateColsAndRows(dimension.width, dimension.height);
		if (!terminalWidth) {
			return;
		}

		this._resize();
		this.findWidget.rawValue?.layout(dimension.width);

		// Signal the container is ready
		this._containerReadyBarrier.open();
	}

	@debounce(50)
	private async _resize(): Promise<void> {
		this._resizeNow(false);
	}

	private async _resizeNow(immediate: boolean): Promise<void> {
		let cols = this.cols;
		let rows = this.rows;

		if (this.xterm) {
			// Only apply these settings when the terminal is visible so that
			// the characters are measured correctly.
			if (this._isVisible && this._layoutSettingsChanged) {
				const font = this.xterm.getFont();
				const config = this._configHelper.config;
				this.xterm.raw.options.letterSpacing = font.letterSpacing;
				this.xterm.raw.options.lineHeight = font.lineHeight;
				this.xterm.raw.options.fontSize = font.fontSize;
				this.xterm.raw.options.fontFamily = font.fontFamily;
				this.xterm.raw.options.fontWeight = config.fontWeight;
				this.xterm.raw.options.fontWeightBold = config.fontWeightBold;

				// Any of the above setting changes could have changed the dimensions of the
				// terminal, re-evaluate now.
				this._initDimensions();
				cols = this.cols;
				rows = this.rows;

				this._layoutSettingsChanged = false;
			}

			if (isNaN(cols) || isNaN(rows)) {
				return;
			}

			if (cols !== this.xterm.raw.cols || rows !== this.xterm.raw.rows) {
				if (this._fixedRows || this._fixedCols) {
					await this._updateProperty(ProcessPropertyType.FixedDimensions, { cols: this._fixedCols, rows: this._fixedRows });
				}
				this._onDimensionsChanged.fire();
			}

			this.xterm.raw.resize(cols, rows);
			TerminalInstance._lastKnownGridDimensions = { cols, rows };

			if (this._isVisible) {
				this.xterm.forceUnpause();
			}
		}

		if (immediate) {
			// do not await, call setDimensions synchronously
			this._processManager.setDimensions(cols, rows, true);
		} else {
			await this._processManager.setDimensions(cols, rows);
		}
	}

	setShellType(shellType: TerminalShellType | undefined) {
		this._shellType = shellType;
		if (shellType) {
			this._terminalShellTypeContextKey.set(shellType?.toString());
		}
	}

	private _setAriaLabel(xterm: XTermTerminal | undefined, terminalId: number, title: string | undefined): void {
		const labelParts: string[] = [];
		if (xterm && xterm.textarea) {
			if (title && title.length > 0) {
				labelParts.push(nls.localize('terminalTextBoxAriaLabelNumberAndTitle', "Terminal {0}, {1}", terminalId, title));
			} else {
				labelParts.push(nls.localize('terminalTextBoxAriaLabel', "Terminal {0}", terminalId));
			}
			const screenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
			if (!screenReaderOptimized) {
				labelParts.push(nls.localize('terminalScreenReaderMode', "Run the command: Toggle Screen Reader Accessibility Mode for an optimized screen reader experience"));
			}
			const accessibilityHelpKeybinding = this._keybindingService.lookupKeybinding(TerminalCommandId.ShowTerminalAccessibilityHelp)?.getLabel();
			if (accessibilityHelpKeybinding) {
				labelParts.push(nls.localize('terminalHelpAriaLabel', "Use {0} for terminal accessibility help", accessibilityHelpKeybinding));
			}
			xterm.textarea.setAttribute('aria-label', labelParts.join('\n'));
		}
	}

	private _updateTitleProperties(title: string | undefined, eventSource: TitleEventSource): string {
		if (!title) {
			return this._processName;
		}
		switch (eventSource) {
			case TitleEventSource.Process:
				if (this._processManager.os === OperatingSystem.Windows) {
					// Extract the file name without extension
					title = path.win32.parse(title).name;
				} else {
					const firstSpaceIndex = title.indexOf(' ');
					if (title.startsWith('/')) {
						title = path.basename(title);
					} else if (firstSpaceIndex > -1) {
						title = title.substring(0, firstSpaceIndex);
					}
				}
				this._processName = title;
				break;
			case TitleEventSource.Api:
				// If the title has not been set by the API or the rename command, unregister the handler that
				// automatically updates the terminal name
				this._staticTitle = title;
				dispose(this._messageTitleDisposable);
				this._messageTitleDisposable = undefined;
				break;
			case TitleEventSource.Sequence:
				// On Windows, some shells will fire this with the full path which we want to trim
				// to show just the file name. This should only happen if the title looks like an
				// absolute Windows file path
				this._sequence = title;
				if (this._processManager.os === OperatingSystem.Windows) {
					if (title.match(/^[a-zA-Z]:\\.+\.[a-zA-Z]{1,3}/)) {
						title = path.win32.parse(title).name;
						this._sequence = title;
					} else {
						this._sequence = undefined;
					}
				}
				break;
		}
		this._titleSource = eventSource;
		return title;
	}

	setOverrideDimensions(dimensions: ITerminalDimensionsOverride | undefined, immediate: boolean = false): void {
		if (this._dimensionsOverride && this._dimensionsOverride.forceExactSize && !dimensions && this._rows === 0 && this._cols === 0) {
			// this terminal never had a real size => keep the last dimensions override exact size
			this._cols = this._dimensionsOverride.cols;
			this._rows = this._dimensionsOverride.rows;
		}
		this._dimensionsOverride = dimensions;
		if (immediate) {
			this._resizeNow(true);
		} else {
			this._resize();
		}
	}

	async setFixedDimensions(): Promise<void> {
		const cols = await this._quickInputService.input({
			title: nls.localize('setTerminalDimensionsColumn', "Set Fixed Dimensions: Column"),
			placeHolder: 'Enter a number of columns or leave empty for automatic width',
			validateInput: async (text) => text.length > 0 && !text.match(/^\d+$/) ? { content: 'Enter a number or leave empty size automatically', severity: Severity.Error } : undefined
		});
		if (cols === undefined) {
			return;
		}
		this._fixedCols = this._parseFixedDimension(cols);
		this._labelComputer?.refreshLabel();
		this._terminalHasFixedWidth.set(!!this._fixedCols);
		const rows = await this._quickInputService.input({
			title: nls.localize('setTerminalDimensionsRow', "Set Fixed Dimensions: Row"),
			placeHolder: 'Enter a number of rows or leave empty for automatic height',
			validateInput: async (text) => text.length > 0 && !text.match(/^\d+$/) ? { content: 'Enter a number or leave empty size automatically', severity: Severity.Error } : undefined
		});
		if (rows === undefined) {
			return;
		}
		this._fixedRows = this._parseFixedDimension(rows);
		this._labelComputer?.refreshLabel();
		await this._refreshScrollbar();
		this._resize();
		this.focus();
	}

	private _parseFixedDimension(value: string): number | undefined {
		if (value === '') {
			return undefined;
		}
		const parsed = parseInt(value);
		if (parsed <= 0) {
			throw new Error(`Could not parse dimension "${value}"`);
		}
		return parsed;
	}

	async toggleSizeToContentWidth(): Promise<void> {
		if (!this.xterm?.raw.buffer.active) {
			return;
		}
		if (this._hasScrollBar) {
			this._terminalHasFixedWidth.set(false);
			this._fixedCols = undefined;
			this._fixedRows = undefined;
			this._hasScrollBar = false;
			this._initDimensions();
			await this._resize();
		} else {
			// Fixed columns should be at least xterm.js' regular column count
			const proposedCols = Math.max(this.maxCols, Math.min(this.xterm.getLongestViewportWrappedLineLength(), Constants.MaxSupportedCols));
			// Don't switch to fixed dimensions if the content already fits as it makes the scroll
			// bar look bad being off the edge
			if (proposedCols > this.xterm.raw.cols) {
				this._fixedCols = proposedCols;
			}
		}
		await this._refreshScrollbar();
		this._labelComputer?.refreshLabel();
		this.focus();
	}

	private _refreshScrollbar(): Promise<void> {
		if (this._fixedCols || this._fixedRows) {
			return this._addScrollbar();
		}
		return this._removeScrollbar();
	}

	private async _addScrollbar(): Promise<void> {
		const charWidth = (this.xterm ? this.xterm.getFont() : this._configHelper.getFont()).charWidth;
		if (!this.xterm?.raw.element || !this._container || !charWidth || !this._fixedCols) {
			return;
		}
		this._wrapperElement.classList.add('fixed-dims');
		this._hasScrollBar = true;
		this._initDimensions();
		// Always remove a row to make room for the scroll bar
		this._fixedRows = this._rows - 1;
		await this._resize();
		this._terminalHasFixedWidth.set(true);
		if (!this._horizontalScrollbar) {
			this._horizontalScrollbar = this._register(new DomScrollableElement(this._wrapperElement, {
				vertical: ScrollbarVisibility.Hidden,
				horizontal: ScrollbarVisibility.Auto,
				useShadows: false,
				scrollYToX: false,
				consumeMouseWheelIfScrollbarIsNeeded: false
			}));
			this._container.appendChild(this._horizontalScrollbar.getDomNode());
		}
		this._horizontalScrollbar.setScrollDimensions({
			width: this.xterm.raw.element.clientWidth,
			scrollWidth: this._fixedCols * charWidth + 40 // Padding + scroll bar
		});
		this._horizontalScrollbar.getDomNode().style.paddingBottom = '16px';

		// work around for https://github.com/xtermjs/xterm.js/issues/3482
		if (isWindows) {
			for (let i = this.xterm.raw.buffer.active.viewportY; i < this.xterm.raw.buffer.active.length; i++) {
				const line = this.xterm.raw.buffer.active.getLine(i);
				(line as any)._line.isWrapped = false;
			}
		}
	}

	private async _removeScrollbar(): Promise<void> {
		if (!this._container || !this._horizontalScrollbar) {
			return;
		}
		this._horizontalScrollbar.getDomNode().remove();
		this._horizontalScrollbar.dispose();
		this._horizontalScrollbar = undefined;
		this._wrapperElement.remove();
		this._wrapperElement.classList.remove('fixed-dims');
		this._container.appendChild(this._wrapperElement);
	}

	private _setResolvedShellLaunchConfig(shellLaunchConfig: IShellLaunchConfig): void {
		this._shellLaunchConfig.args = shellLaunchConfig.args;
		this._shellLaunchConfig.cwd = shellLaunchConfig.cwd;
		this._shellLaunchConfig.executable = shellLaunchConfig.executable;
		this._shellLaunchConfig.env = shellLaunchConfig.env;
	}

	showEnvironmentInfoHover(): void {
		if (this._environmentInfo) {
			this._environmentInfo.widget.focus();
		}
	}

	private _onEnvironmentVariableInfoChanged(info: IEnvironmentVariableInfo): void {
		if (info.requiresAction) {
			this.xterm?.raw.textarea?.setAttribute('aria-label', nls.localize('terminalStaleTextBoxAriaLabel', "Terminal {0} environment is stale, run the 'Show Environment Information' command for more information", this._instanceId));
		}
		this._refreshEnvironmentVariableInfoWidgetState(info);
	}

	private _refreshEnvironmentVariableInfoWidgetState(info?: IEnvironmentVariableInfo): void {
		// Check if the widget should not exist
		if (
			!info ||
			this._configHelper.config.environmentChangesIndicator === 'off' ||
			this._configHelper.config.environmentChangesIndicator === 'warnonly' && !info.requiresAction ||
			this._configHelper.config.environmentChangesIndicator === 'on' && !info.requiresAction
		) {
			this.statusList.remove(TerminalStatus.RelaunchNeeded);
			this._environmentInfo?.disposable.dispose();
			this._environmentInfo = undefined;
			return;
		}

		// Recreate the process if the terminal has not yet been interacted with and it's not a
		// special terminal (eg. extension terminal)
		if (
			info.requiresAction &&
			this._configHelper.config.environmentChangesRelaunch &&
			!this._processManager.hasWrittenData &&
			(!this._shellLaunchConfig.isFeatureTerminal || (this.reconnectionProperties && this._configurationService.getValue(TaskSettingId.Reconnection) === true)) &&
			!this._shellLaunchConfig.customPtyImplementation
			&& !this._shellLaunchConfig.isExtensionOwnedTerminal &&
			!this._shellLaunchConfig.attachPersistentProcess
		) {
			this.relaunch();
			return;
		}

		// (Re-)create the widget
		this._environmentInfo?.disposable.dispose();
		const widget = this._scopedInstantiationService.createInstance(EnvironmentVariableInfoWidget, info);
		const disposable = this._widgetManager.attachWidget(widget);
		if (info.requiresAction) {
			this.statusList.add({
				id: TerminalStatus.RelaunchNeeded,
				severity: Severity.Warning,
				icon: Codicon.warning,
				tooltip: info.getInfo(),
				hoverActions: info.getActions ? info.getActions() : undefined
			});
		}
		if (disposable) {
			this._environmentInfo = { widget, disposable };
		}
	}

	async toggleEscapeSequenceLogging(): Promise<boolean> {
		const xterm = await this._xtermReadyPromise;
		xterm.raw.options.logLevel = xterm.raw.options.logLevel === 'debug' ? 'info' : 'debug';
		return xterm.raw.options.logLevel === 'debug';
	}

	async getInitialCwd(): Promise<string> {
		if (!this._initialCwd) {
			this._initialCwd = this._processManager.initialCwd;
		}
		return this._initialCwd;
	}

	async getCwd(): Promise<string> {
		if (this.capabilities.has(TerminalCapability.CwdDetection)) {
			return this.capabilities.get(TerminalCapability.CwdDetection)!.getCwd();
		} else if (this.capabilities.has(TerminalCapability.NaiveCwdDetection)) {
			return this.capabilities.get(TerminalCapability.NaiveCwdDetection)!.getCwd();
		}
		return this._processManager.initialCwd;
	}

	private async _refreshProperty<T extends ProcessPropertyType>(type: T): Promise<IProcessPropertyMap[T]> {
		await this.processReady;
		return this._processManager.refreshProperty(type);
	}

	private async _updateProperty<T extends ProcessPropertyType>(type: T, value: IProcessPropertyMap[T]): Promise<void> {
		return this._processManager.updateProperty(type, value);
	}

	registerLinkProvider(provider: ITerminalExternalLinkProvider): IDisposable {
		if (!this._linkManager) {
			throw new Error('TerminalInstance.registerLinkProvider before link manager was ready');
		}
		// Avoid a circular dependency by binding the terminal instances to the external link provider
		return this._linkManager.registerExternalLinkProvider(provider.provideLinks.bind(provider, this));
	}

	async rename(title?: string) {
		this._setTitle(title, TitleEventSource.Api);
	}

	private _setTitle(title: string | undefined, eventSource: TitleEventSource): void {
		const reset = !title;
		title = this._updateTitleProperties(title, eventSource);
		const titleChanged = title !== this._title;
		this._title = title;
		this._labelComputer?.refreshLabel(reset);
		this._setAriaLabel(this.xterm?.raw, this._instanceId, this._title);

		if (titleChanged) {
			this._onTitleChanged.fire(this);
		}
	}

	async changeIcon() {
		type Item = IQuickPickItem & { icon: TerminalIcon };
		const items: Item[] = [];
		for (const icon of getAllCodicons()) {
			items.push({ label: `$(${icon.id})`, description: `${icon.id}`, icon });
		}
		const result = await this._quickInputService.pick(items, {
			matchOnDescription: true
		});
		if (result) {
			this._icon = result.icon;
			this._onIconChanged.fire({ instance: this, userInitiated: true });
		}
	}

	async changeColor() {
		const icon = this._getIcon();
		if (!icon) {
			return;
		}
		const colorTheme = this._themeService.getColorTheme();
		const standardColors: string[] = getStandardColors(colorTheme);
		const styleElement = getColorStyleElement(colorTheme);
		const items: QuickPickItem[] = [];
		for (const colorKey of standardColors) {
			const colorClass = getColorClass(colorKey);
			items.push({
				label: `$(${Codicon.circleFilled.id}) ${colorKey.replace('terminal.ansi', '')}`, id: colorKey, description: colorKey, iconClasses: [colorClass]
			});
		}
		items.push({ type: 'separator' });
		const showAllColorsItem = { label: 'Reset to default' };
		items.push(showAllColorsItem);
		document.body.appendChild(styleElement);

		const quickPick = this._quickInputService.createQuickPick();
		quickPick.items = items;
		quickPick.matchOnDescription = true;
		quickPick.show();
		const disposables: IDisposable[] = [];
		const result = await new Promise<IQuickPickItem | undefined>(r => {
			disposables.push(quickPick.onDidHide(() => r(undefined)));
			disposables.push(quickPick.onDidAccept(() => r(quickPick.selectedItems[0])));
		});
		dispose(disposables);

		if (result) {
			this.shellLaunchConfig.color = result.id;
			this._onIconChanged.fire({ instance: this, userInitiated: true });
		}

		quickPick.hide();
		document.body.removeChild(styleElement);
	}

	selectPreviousSuggestion(): void {
		this.xterm?.suggestController?.selectPreviousSuggestion();
	}

	selectPreviousPageSuggestion(): void {
		this.xterm?.suggestController?.selectPreviousPageSuggestion();
	}

	selectNextSuggestion(): void {
		this.xterm?.suggestController?.selectNextSuggestion();
	}

	selectNextPageSuggestion(): void {
		this.xterm?.suggestController?.selectNextPageSuggestion();
	}

	async acceptSelectedSuggestion(suggestion?: Pick<ISimpleSelectedSuggestion, 'item' | 'model'>): Promise<void> {
		this.xterm?.suggestController?.acceptSelectedSuggestion(suggestion);
	}

	hideSuggestWidget(): void {
		this.xterm?.suggestController?.hideSuggestWidget();
	}
}

class TerminalInstanceDragAndDropController extends Disposable implements dom.IDragAndDropObserverCallbacks {
	private _dropOverlay?: HTMLElement;

	private readonly _onDropFile = new Emitter<string | URI>();
	get onDropFile(): Event<string | URI> { return this._onDropFile.event; }
	private readonly _onDropTerminal = new Emitter<IRequestAddInstanceToGroupEvent>();
	get onDropTerminal(): Event<IRequestAddInstanceToGroupEvent> { return this._onDropTerminal.event; }

	constructor(
		private readonly _container: HTMLElement,
		@IWorkbenchLayoutService private readonly _layoutService: IWorkbenchLayoutService,
		@IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
	) {
		super();
		this._register(toDisposable(() => this._clearDropOverlay()));
	}

	private _clearDropOverlay() {
		if (this._dropOverlay && this._dropOverlay.parentElement) {
			this._dropOverlay.parentElement.removeChild(this._dropOverlay);
		}
		this._dropOverlay = undefined;
	}

	onDragEnter(e: DragEvent) {
		if (!containsDragType(e, DataTransfers.FILES, DataTransfers.RESOURCES, TerminalDataTransfers.Terminals, CodeDataTransfers.FILES)) {
			return;
		}

		if (!this._dropOverlay) {
			this._dropOverlay = document.createElement('div');
			this._dropOverlay.classList.add('terminal-drop-overlay');
		}

		// Dragging terminals
		if (containsDragType(e, TerminalDataTransfers.Terminals)) {
			const side = this._getDropSide(e);
			this._dropOverlay.classList.toggle('drop-before', side === 'before');
			this._dropOverlay.classList.toggle('drop-after', side === 'after');
		}

		if (!this._dropOverlay.parentElement) {
			this._container.appendChild(this._dropOverlay);
		}
	}
	onDragLeave(e: DragEvent) {
		this._clearDropOverlay();
	}

	onDragEnd(e: DragEvent) {
		this._clearDropOverlay();
	}

	onDragOver(e: DragEvent) {
		if (!e.dataTransfer || !this._dropOverlay) {
			return;
		}

		// Dragging terminals
		if (containsDragType(e, TerminalDataTransfers.Terminals)) {
			const side = this._getDropSide(e);
			this._dropOverlay.classList.toggle('drop-before', side === 'before');
			this._dropOverlay.classList.toggle('drop-after', side === 'after');
		}

		this._dropOverlay.style.opacity = '1';
	}

	async onDrop(e: DragEvent) {
		this._clearDropOverlay();

		if (!e.dataTransfer) {
			return;
		}

		const terminalResources = getTerminalResourcesFromDragEvent(e);
		if (terminalResources) {
			for (const uri of terminalResources) {
				const side = this._getDropSide(e);
				this._onDropTerminal.fire({ uri, side });
			}
			return;
		}

		// Check if files were dragged from the tree explorer
		let path: URI | undefined;
		const rawResources = e.dataTransfer.getData(DataTransfers.RESOURCES);
		if (rawResources) {
			path = URI.parse(JSON.parse(rawResources)[0]);
		}

		const rawCodeFiles = e.dataTransfer.getData(CodeDataTransfers.FILES);
		if (!path && rawCodeFiles) {
			path = URI.file(JSON.parse(rawCodeFiles)[0]);
		}

		if (!path && e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].path /* Electron only */) {
			// Check if the file was dragged from the filesystem
			path = URI.file(e.dataTransfer.files[0].path);
		}

		if (!path) {
			return;
		}

		this._onDropFile.fire(path);
	}

	private _getDropSide(e: DragEvent): 'before' | 'after' {
		const target = this._container;
		if (!target) {
			return 'after';
		}

		const rect = target.getBoundingClientRect();
		return this._getViewOrientation() === Orientation.HORIZONTAL
			? (e.clientX - rect.left < rect.width / 2 ? 'before' : 'after')
			: (e.clientY - rect.top < rect.height / 2 ? 'before' : 'after');
	}

	private _getViewOrientation(): Orientation {
		const panelPosition = this._layoutService.getPanelPosition();
		const terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
		return terminalLocation === ViewContainerLocation.Panel && panelPosition === Position.BOTTOM
			? Orientation.HORIZONTAL
			: Orientation.VERTICAL;
	}
}

interface ITerminalLabelTemplateProperties {
	cwd?: string | null | undefined;
	cwdFolder?: string | null | undefined;
	workspaceFolder?: string | null | undefined;
	local?: string | null | undefined;
	process?: string | null | undefined;
	sequence?: string | null | undefined;
	task?: string | null | undefined;
	fixedDimensions?: string | null | undefined;
	separator?: string | ISeparator | null | undefined;
}

const enum TerminalLabelType {
	Title = 'title',
	Description = 'description'
}

export class TerminalLabelComputer extends Disposable {
	private _title: string = '';
	private _description: string = '';
	get title(): string | undefined { return this._title; }
	get description(): string { return this._description; }

	private readonly _onDidChangeLabel = this._register(new Emitter<{ title: string; description: string }>());
	readonly onDidChangeLabel = this._onDidChangeLabel.event;

	constructor(
		private readonly _configHelper: TerminalConfigHelper,
		private readonly _instance: Pick<ITerminalInstance, 'shellLaunchConfig' | 'cwd' | 'fixedCols' | 'fixedRows' | 'initialCwd' | 'processName' | 'sequence' | 'userHome' | 'workspaceFolder' | 'staticTitle' | 'capabilities' | 'title' | 'description'>,
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService
	) {
		super();
	}

	refreshLabel(reset?: boolean): void {
		this._title = this.computeLabel(this._configHelper.config.tabs.title, TerminalLabelType.Title, reset);
		this._description = this.computeLabel(this._configHelper.config.tabs.description, TerminalLabelType.Description);
		if (this._title !== this._instance.title || this._description !== this._instance.description || reset) {
			this._onDidChangeLabel.fire({ title: this._title, description: this._description });
		}
	}

	computeLabel(
		labelTemplate: string,
		labelType: TerminalLabelType,
		reset?: boolean
	) {
		const type = this._instance.shellLaunchConfig.attachPersistentProcess?.type || this._instance.shellLaunchConfig.type;
		const templateProperties: ITerminalLabelTemplateProperties = {
			cwd: this._instance.cwd || this._instance.initialCwd || '',
			cwdFolder: '',
			workspaceFolder: this._instance.workspaceFolder ? path.basename(this._instance.workspaceFolder.uri.fsPath) : undefined,
			local: type === 'Local' ? type : undefined,
			process: this._instance.processName,
			sequence: this._instance.sequence,
			task: type === 'Task' ? type : undefined,
			fixedDimensions: this._instance.fixedCols
				? (this._instance.fixedRows ? `\u2194${this._instance.fixedCols} \u2195${this._instance.fixedRows}` : `\u2194${this._instance.fixedCols}`)
				: (this._instance.fixedRows ? `\u2195${this._instance.fixedRows}` : ''),
			separator: { label: this._configHelper.config.tabs.separator }
		};
		labelTemplate = labelTemplate.trim();
		if (!labelTemplate) {
			return labelType === TerminalLabelType.Title ? (this._instance.processName || '') : '';
		}
		if (!reset && this._instance.staticTitle && labelType === TerminalLabelType.Title) {
			return this._instance.staticTitle.replace(/[\n\r\t]/g, '') || templateProperties.process?.replace(/[\n\r\t]/g, '') || '';
		}
		const detection = this._instance.capabilities.has(TerminalCapability.CwdDetection) || this._instance.capabilities.has(TerminalCapability.NaiveCwdDetection);
		const folders = this._workspaceContextService.getWorkspace().folders;
		const multiRootWorkspace = folders.length > 1;

		// Only set cwdFolder if detection is on
		if (templateProperties.cwd && detection && (!this._instance.shellLaunchConfig.isFeatureTerminal || labelType === TerminalLabelType.Title)) {
			const cwdUri = URI.from({
				scheme: this._instance.workspaceFolder?.uri.scheme || Schemas.file,
				path: this._instance.cwd ? path.resolve(this._instance.cwd) : undefined
			});
			// Multi-root workspaces always show cwdFolder to disambiguate them, otherwise only show
			// when it differs from the workspace folder in which it was launched from
			let showCwd = false;
			if (multiRootWorkspace) {
				showCwd = true;
			} else if (this._instance.workspaceFolder?.uri) {
				const caseSensitive = this._fileService.hasCapability(this._instance.workspaceFolder.uri, FileSystemProviderCapabilities.PathCaseSensitive);
				showCwd = cwdUri.fsPath.localeCompare(this._instance.workspaceFolder.uri.fsPath, undefined, { sensitivity: caseSensitive ? 'case' : 'base' }) !== 0;
			}
			if (showCwd) {

				templateProperties.cwdFolder = path.basename(templateProperties.cwd);
			}
		}

		// Remove special characters that could mess with rendering
		const label = template(labelTemplate, (templateProperties as unknown) as { [key: string]: string | ISeparator | undefined | null }).replace(/[\n\r\t]/g, '').trim();
		return label === '' && labelType === TerminalLabelType.Title ? (this._instance.processName || '') : label;
	}
}

export function parseExitResult(
	exitCodeOrError: ITerminalLaunchError | number | undefined,
	shellLaunchConfig: IShellLaunchConfig,
	processState: ProcessState,
	initialCwd: string | undefined
): { code: number | undefined; message: string | undefined } | undefined {
	// Only return a message if the exit code is non-zero
	if (exitCodeOrError === undefined || exitCodeOrError === 0) {
		return { code: exitCodeOrError, message: undefined };
	}

	const code = typeof exitCodeOrError === 'number' ? exitCodeOrError : exitCodeOrError.code;

	// Create exit code message
	let message: string | undefined = undefined;
	switch (typeof exitCodeOrError) {
		case 'number': {
			let commandLine: string | undefined = undefined;
			if (shellLaunchConfig.executable) {
				commandLine = shellLaunchConfig.executable;
				if (typeof shellLaunchConfig.args === 'string') {
					commandLine += ` ${shellLaunchConfig.args}`;
				} else if (shellLaunchConfig.args && shellLaunchConfig.args.length) {
					commandLine += shellLaunchConfig.args.map(a => ` '${a}'`).join();
				}
			}
			if (processState === ProcessState.KilledDuringLaunch) {
				if (commandLine) {
					message = nls.localize('launchFailed.exitCodeAndCommandLine', "The terminal process \"{0}\" failed to launch (exit code: {1}).", commandLine, code);
				} else {
					message = nls.localize('launchFailed.exitCodeOnly', "The terminal process failed to launch (exit code: {0}).", code);
				}
			} else {
				if (commandLine) {
					message = nls.localize('terminated.exitCodeAndCommandLine', "The terminal process \"{0}\" terminated with exit code: {1}.", commandLine, code);
				} else {
					message = nls.localize('terminated.exitCodeOnly', "The terminal process terminated with exit code: {0}.", code);
				}
			}
			break;
		}
		case 'object': {
			// Ignore internal errors
			if (exitCodeOrError.message.toString().includes('Could not find pty with id')) {
				break;
			}
			// Convert conpty code-based failures into human friendly messages
			let innerMessage = exitCodeOrError.message;
			const conptyError = exitCodeOrError.message.match(/.*error code:\s*(\d+).*$/);
			if (conptyError) {
				const errorCode = conptyError.length > 1 ? parseInt(conptyError[1]) : undefined;
				switch (errorCode) {
					case 5:
						innerMessage = `Access was denied to the path containing your executable "${shellLaunchConfig.executable}". Manage and change your permissions to get this to work`;
						break;
					case 267:
						innerMessage = `Invalid starting directory "${initialCwd}", review your terminal.integrated.cwd setting`;
						break;
					case 1260:
						innerMessage = `Windows cannot open this program because it has been prevented by a software restriction policy. For more information, open Event Viewer or contact your system Administrator`;
						break;
				}
			}
			message = nls.localize('launchFailed.errorMessage', "The terminal process failed to launch: {0}.", innerMessage);
			break;
		}
	}

	return { code, message };
}

const introMessage = nls.localize('introMsg', "Welcome to Terminal Accessibility Help");
const focusAccessibleBufferNls = nls.localize('focusAccessibleBuffer', 'The Focus Accessible Buffer ({0}) command enables screen readers to read terminal contents.');
const focusAccessibleBufferNoKb = nls.localize('focusAccessibleBufferNoKb', 'The Focus Accessible Buffer command enables screen readers to read terminal contents and is currently not triggerable by a keybinding.');
const shellIntegration = nls.localize('shellIntegration', "The terminal has a feature called shell integration that offers an enhanced experience and provides useful commands for screen readers such as:");
const runRecentCommand = nls.localize('runRecentCommand', 'Run Recent Command ({0})');
const runRecentCommandNoKb = nls.localize('runRecentCommandNoKb', 'Run Recent Command is currently not triggerable by a keybinding.');
const goToRecentNoShellIntegration = nls.localize('goToRecentDirectoryNoShellIntegration', 'The Go to Recent Directory command ({0}) enables screen readers to easily navigate to a directory that has been used in the terminal.');
const goToRecentNoKbNoShellIntegration = nls.localize('goToRecentDirectoryNoKbNoShellIntegration', 'The Go to Recent Directory command enables screen readers to easily navigate to a directory that has been used in the terminal and is currently not triggerable by a keybinding.');
const goToRecent = nls.localize('goToRecentDirectory', 'Go to Recent Directory ({0})');
const goToRecentNoKb = nls.localize('goToRecentDirectoryNoKb', 'Go to Recent Directory is currently not triggerable by a keybinding.');
const readMoreLink = nls.localize('readMore', '[Read more about terminal accessibility](https://code.visualstudio.com/docs/editor/accessibility#_terminal-accessibility)');
const dismiss = nls.localize('dismiss', "You can dismiss this dialog by pressing Escape or focusing elsewhere.");
const openDetectedLink = nls.localize('openDetectedLink', 'The Open Detected Link ({0}) command enables screen readers to easily open links found in the terminal.');
const openDetectedLinkNoKb = nls.localize('openDetectedLinkNoKb', 'The Open Detected Link command enables screen readers to easily open links found in the terminal and is currently not triggerable by a keybinding.');
const newWithProfile = nls.localize('newWithProfile', 'The Create New Terminal (With Profile) ({0}) command allows for easy terminal creation using a specific profile.');
const newWithProfileNoKb = nls.localize('newWithProfileNoKb', 'The Create New Terminal (With Profile) command allows for easy terminal creation using a specific profile and is currently not triggerable by a keybinding.');
const accessibilitySettings = nls.localize('accessibilitySettings', 'Access accessibility settings such as `terminal.integrated.tabFocusMode` via the Preferences: Open Accessibility Settings command.');

class AccessibilityHelpWidget extends Widget implements ITerminalWidget {
	readonly id = 'help';
	private _container: HTMLElement | undefined;
	private _domNode: FastDomNode<HTMLElement>;
	private _contentDomNode: FastDomNode<HTMLElement>;
	private readonly _hasShellIntegration: boolean;
	private readonly _markdownRenderer: MarkdownRenderer;

	constructor(
		instance: ITerminalInstance,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService private readonly _openerService: IOpenerService
	) {
		super();
		this._hasShellIntegration = instance.xterm?.shellIntegration.status === ShellIntegrationStatus.VSCode;
		this._domNode = createFastDomNode(document.createElement('div'));
		this._contentDomNode = createFastDomNode(document.createElement('div'));
		this._contentDomNode.setClassName('terminal-accessibility-help');
		this._contentDomNode.setAttribute('role', 'document');
		this._domNode.setDisplay('none');
		this._domNode.setAttribute('role', 'dialog');
		this._domNode.setAttribute('aria-hidden', 'true');
		this._domNode.appendChild(this._contentDomNode);
		this._register(dom.addStandardDisposableListener(this._contentDomNode.domNode, 'keydown', (e) => {
			if (e.keyCode === KeyCode.Escape) {
				this.hide();
				instance.focus();
			}
		}));
		this._register(instance.onDidFocus(() => this.hide()));
		this._markdownRenderer = this._register(instantiationService.createInstance(MarkdownRenderer, {}));
	}

	public hide(): void {
		if (!this._container) {
			return;
		}
		this._domNode.setDisplay('none');
		this._contentDomNode.setDisplay('none');
		this._domNode.setAttribute('aria-hidden', 'true');
	}

	attach(container: HTMLElement): void {
		this._container = container;
		this._domNode.setDisplay('block');
		this._domNode.setAttribute('aria-hidden', 'false');
		this._contentDomNode.domNode.tabIndex = 0;
		this._buildContent();
		container.appendChild(this._contentDomNode.domNode);
		this._contentDomNode.domNode.focus();
	}

	private _descriptionForCommand(commandId: string, msg: string, noKbMsg: string): string {
		const kb = this._keybindingService.lookupKeybinding(commandId);
		if (kb) {
			return strings.format(msg, kb.getAriaLabel());
		}
		return strings.format(noKbMsg, commandId);
	}

	private _buildContent(): void {
		const content = [];
		content.push(this._descriptionForCommand(TerminalCommandId.FocusAccessibleBuffer, focusAccessibleBufferNls, focusAccessibleBufferNoKb));
		if (this._hasShellIntegration) {
			content.push(shellIntegration);
			content.push('- ' + this._descriptionForCommand(TerminalCommandId.RunRecentCommand, runRecentCommand, runRecentCommandNoKb) + '\n- ' + this._descriptionForCommand(TerminalCommandId.GoToRecentDirectory, goToRecent, goToRecentNoKb));
		} else {
			content.push(this._descriptionForCommand(TerminalCommandId.GoToRecentDirectory, goToRecentNoShellIntegration, goToRecentNoKbNoShellIntegration));
		}
		content.push(this._descriptionForCommand(TerminalCommandId.OpenDetectedLink, openDetectedLink, openDetectedLinkNoKb));
		content.push(this._descriptionForCommand(TerminalCommandId.NewWithProfile, newWithProfile, newWithProfileNoKb));
		content.push(accessibilitySettings);
		content.push(readMoreLink, dismiss);
		const element = renderElementAsMarkdown(this._markdownRenderer, this._openerService, content.join('\n\n'), this._register(new DisposableStore()));
		const anchorElements = element.querySelectorAll('a');
		for (const a of anchorElements) {
			a.tabIndex = 0;
		}
		this._contentDomNode.domNode.appendChild(element);
		this._contentDomNode.domNode.setAttribute('aria-label', introMessage);
	}
}
function renderElementAsMarkdown(markdownRenderer: MarkdownRenderer, openerSerivce: IOpenerService, text: string, disposables: DisposableStore): HTMLElement {
	const result = markdownRenderer.render({ value: text, isTrusted: true }, {
		actionHandler: {
			callback: (content: string) => openerSerivce.open(content),
			disposables
		}
	});
	return result.element;
}
