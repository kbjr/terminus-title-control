
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsTabProvider } from 'terminus-settings';
import { ConfigProvider } from 'terminus-core';

import { TitleControlService } from './services/title-control';
import { TitleControlConfigProvider } from './config';
import { TitleControlSettingsTabProvider } from './settings';
import { TitleControlSettingsTabComponent } from './components/settings-tab';

debugger;

@NgModule({
	imports: [
		CommonModule,
		FormsModule
	],
	providers: [
		TitleControlService,
		{ provide: ConfigProvider, useClass: TitleControlConfigProvider },
		{ provide: SettingsTabProvider, useClass: TitleControlSettingsTabProvider },
	],
	entryComponents: [
		TitleControlSettingsTabComponent
	],
	declarations: [
		TitleControlSettingsTabComponent
	],
})
export default class TitleControlModule { }
