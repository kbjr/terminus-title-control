
import { Injectable } from '@angular/core';
import { ConfigService, AppService, BaseTabComponent } from 'terminus-core';

@Injectable()
export class TitleControlService {
	private knownTabs: WeakMap<BaseTabComponent, string>;

	constructor(
		private app: AppService,
		private config: ConfigService,
	) {
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

		if (removePattern != null) {
			const toRemove = removePattern.split(/\s*,\s*/);

			toRemove.forEach((toRemove: string) => {
				while (title.indexOf(toRemove) >= 0) {
					title = title.replace(toRemove, '');
				}
			});
		}

		if (prefix != null) {
			title = prefix + title;
		}

		if (suffix != null) {
			title = title + suffix;
		}

		this.knownTabs.set(tab, title);

		tab.setTitle(title);
	}
}
