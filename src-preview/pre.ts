/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StyleLoadingMonitor } from './loading';

declare global {
	interface Window {
		styleLoadingMonitor: StyleLoadingMonitor;
	}
}

window.styleLoadingMonitor = new StyleLoadingMonitor();