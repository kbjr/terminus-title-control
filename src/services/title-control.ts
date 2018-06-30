
import { Injectable } from '@angular/core';
import { ConfigService, AppService, BaseTabComponent } from 'terminus-core';

@Injectable()
export class TitleControlService {
	private knownTabs: WeakMap<BaseTabComponent, string>;

	constructor(
		private app: AppService,
		private config: ConfigService,
	) { }

	init() {
		this.knownTabs = new WeakMap<BaseTabComponent, string>();

		this.onTabsChange();

		this.app.tabsChanged$.subscribe(() => {
			this.onTabsChange();
		});
	}

	onTabsChange() {
		this.app.tabs.forEach((tab) => {
			if (! this.knownTabs.has(tab)) {
				this.onTabChange(tab);

				// @ts-ignore: This property does, in fact, exist
				tab.titleChange$.subscribe(() => {
					this.onTabChange(tab);
				});
			}
		});
	}

	onTabChange(tab: BaseTabComponent) {
		if (this.knownTabs.get(tab) !== tab.title) {
			this.processTabTitle(tab);
		}
	}

	processTabTitle(tab: BaseTabComponent) {
		let { title } = tab;
		const { prefix, suffix, removePattern } = this.config.store.titleControl;

		if (removePattern) {
			const toRemove = removePattern.split(',');

			toRemove.forEach((toRemove: string) => {
				while (title.indexOf(toRemove) >= 0) {
					title = title.replace(toRemove, '');
				}
			});
		}

		if (prefix) {
			title = prefix + title;
		}

		if (suffix) {
			title = title + suffix;
		}

		if (! title.trim()) {
			title = 'Terminal';
		}

		this.knownTabs.set(tab, title);

		// @ts-ignore: This property does, in fact, exist
		tab.setTitle(title);
	}
}
