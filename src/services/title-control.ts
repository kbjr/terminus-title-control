
import { Injectable } from '@angular/core';
import { ConfigService, AppService, BaseTabComponent, Logger, LogService, SplitTabComponent } from 'terminus-core';
import { BaseTerminalTabComponent, TerminalTabComponent } from 'terminus-terminal'
import { getChildProcesses, IChildProcess } from '../helpers/processes';

const patternRegex = /(\\t|\\d|\\i|\\scmd|\\sname|\\spid|\\pid|\\cmd|\\cwd|\\e[^\s]+)/g;

@Injectable()
export class TitleControlService {
	private logger: Logger;
	private knownTabs: WeakMap<BaseTabComponent, TabState>;
	private lastUsedReplacePattern: string;
	private compiledReplacePattern: Function;

	constructor(
		private app: AppService,
		private config: ConfigService,
        log: LogService,
	) {
		this.logger = log.create('title-controls');
	}

	init() : void {
		this.logger.debug('title-controls plugin starting up');

		this.knownTabs = new WeakMap<BaseTabComponent, TabState>();

		this.onTabsChange();

		this.app.tabsChanged$.subscribe(() => {
			this.onTabsChange();
		});
	}

	onTabsChange() : void {
		this.app.tabs.forEach((topLevelTab) => {
			let subTabs = (topLevelTab instanceof SplitTabComponent) ? topLevelTab.getAllTabs() : [topLevelTab];
			for (const tab of subTabs) {
				if (tab instanceof BaseTerminalTabComponent) {
					if (! this.knownTabs.has(tab)) {
						this.logger.debug(`New tab discovered: ${tab}`)

						this.knownTabs.set(tab, new TabState(tab));

						this.processTabTitle(tab);

						tab.titleChange$.subscribe(() => {
							this.processTabTitle(tab);
						});
					}
				}
			}
		});
	}

	async processTabTitle(tab: BaseTerminalTabComponent) : Promise<void> {
		const tabState = this.knownTabs.get(tab);

		if (tabState.ignoreNext && tabState.processedTitle === tab.title) {
			tabState.ignoreNext = false;
			return
		}

		let { title: newTitle } = tab;
		const { prefix, suffix, removePattern } = this.config.store.titleControl;

		this.logger.debug(`Processing title ${tab}: "${newTitle}"`);

		tabState.actualTitle = newTitle;

		const replacePattern = this.getCompiledReplacePattern();

		if (replacePattern) {
			newTitle = await replacePattern(tab);
		}

		if (removePattern) {
			const toRemove = removePattern.split(',');

			toRemove.forEach((toRemove: string) => {
				while (newTitle.indexOf(toRemove) >= 0) {
					newTitle = newTitle.replace(toRemove, '');
				}
			});
		}

		if (prefix) {
			newTitle = prefix + newTitle;
		}

		if (suffix) {
			newTitle = newTitle + suffix;
		}

		if (! newTitle.trim()) {
			newTitle = 'Terminal';
		}

		tabState.ignoreNext = true;
		tabState.processedTitle = newTitle;

		this.logger.debug(`Title processed: ${tab} "${newTitle}"`);

		tab.setTitle(newTitle);
	}

	getCompiledReplacePattern() : Function | null {
		const { replacePattern } = this.config.store.titleControl;

		if (! replacePattern) {
			return null;
		}

		if (this.lastUsedReplacePattern !== replacePattern) {
			this.compiledReplacePattern = compileReplacePattern(replacePattern);
			this.lastUsedReplacePattern = replacePattern;
		}

		return this.compiledReplacePattern;
	}
}

class TabState {
	ignoreNext: boolean = false;
	actualTitle: string;
	processedTitle: string;

	constructor(tab: BaseTabComponent) {
		this.actualTitle = tab.title;
	}
}

const compileReplacePattern = (replacePattern : string) : Function => {
	const valueGetters = [ ];
	const rawChunks = replacePattern
		.split(patternRegex)
		.filter((chunk) => ! patternRegex.test(chunk));

	patternRegex.lastIndex = 0;

	let match;

	while (match = patternRegex.exec(replacePattern)) {
		const code = match[0].slice(1);

		if (code[0] === 'e') {
			valueGetters.push(getTabEnvVar(code.slice(1)));
		}

		else {
			switch (code) {
				case 't':
					valueGetters.push(getTabTitle);
					break;

				// case 'd':
				// 	valueGetters.push(getTabDirectoryName);
				// 	break;

				case 'scmd':
					valueGetters.push(getShellCommand);
					break;

				case 'sname':
					valueGetters.push(getShellName);
					break;

				case 'spid':
					valueGetters.push(getShellPid);
					break;

				case 'pid':
					valueGetters.push(getPid);
					break;

				case 'cmd':
					valueGetters.push(getCommand);
					break;

				case 'cwd':
					valueGetters.push(getCwd);
					break;

				default:
					valueGetters.push(() => match[0]);
			}
		}
	}

	patternRegex.lastIndex = 0;

	return async (tab: BaseTabComponent) : Promise<string> => {
		const title = [ ];

		for (let i = 0; i < rawChunks.length; i++) {
			title.push(rawChunks[i]);

			if (valueGetters[i]) {
				const nextValue = valueGetters[i](tab);

				if (nextValue) {
					title.push(nextValue.then ? await nextValue || '' : nextValue);
				}
			}
		}

		return title.join('');
	};
};

const getTabTitle = (tab: BaseTabComponent) : string => {
	return tab.title;
};

const getTabEnvVar = (name: string) : Function => {
	return (tab: BaseTerminalTabComponent) : string => {
		return (tab instanceof TerminalTabComponent) ? tab.sessionOptions.env[name] : '';
	};
};

// const getTabDirectoryName = (tab: BaseTabComponent) : string => {
// 	// TODO
// 	return '';
// };

const getShellCommand = (tab: BaseTabComponent) : string => {
	return (tab instanceof TerminalTabComponent) ? tab.sessionOptions.command : '';
};

const getShellName = (tab: BaseTabComponent) : string => {
	return (tab instanceof TerminalTabComponent) ? tab.sessionOptions.name : '';
};

const getShellPid = (tab: BaseTabComponent) : string => {
	return (tab instanceof TerminalTabComponent) ? (tab.session.truePID || 0).toString() : '';
};

const getLowestChildProcess = async (pid: number) : Promise<IChildProcess> => {
	let current = { pid } as IChildProcess;
	let next;

	do {
		[ next ] = await getChildProcesses(current.pid);

		if (next) {
			current = next;
		}
	}
	while (next);

	return current;
};

const getCommand = async (tab: BaseTabComponent) : Promise<string> => {
	// @ts-ignore: This property does, in fact, exist
	const pid = tab.session ? tab.session.truePID : null;

	if (pid) {
		const child = await getLowestChildProcess(pid);

		if (child && child.pid !== pid) {
			return child.command;
		}
	}

	return '';
};

const getPid = async (tab: BaseTabComponent) : Promise<string> => {
	// @ts-ignore: This property does, in fact, exist
	const pid = tab.session ? tab.session.truePID : null;

	if (pid) {
		const child = await getLowestChildProcess(pid);

		if (child && child.pid !== pid) {
			return String(child.pid);
		}
	}

	return '';
};

const getCwd = async (tab: BaseTerminalTabComponent) : Promise<string> => {
	const cwd = await tab.session.getWorkingDirectory();

	if (cwd) {
		return cwd;
	}

	return '';
};
