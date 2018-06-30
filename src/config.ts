
import { ConfigProvider } from 'terminus-core';

export class TitleControlConfigProvider extends ConfigProvider {
	defaults = {
		prefix: null,
		suffix: null,
		replacePattern: null,
		removePattern: null
	}
}
