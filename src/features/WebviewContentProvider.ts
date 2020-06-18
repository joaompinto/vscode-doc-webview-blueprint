/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { MyDocEngine } from './docEngine';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


/**
 * Strings used inside the MyDoc preview.
 *
 * Stored here and then injected in the preview so that they
 * can be localized using our normal localization process.
 */
const previewStrings = {
  cspAlertMessageText: localize(
    'preview.securityMessage.text',
    'Some content has been disabled in this document'),

  cspAlertMessageTitle: localize(
    'preview.securityMessage.title',
    'Potentially unsafe or insecure content has been disabled in the MyDoc preview. Change the MyDoc preview security setting to allow insecure content or enable scripts'),

  cspAlertMessageLabel: localize(
    'preview.securityMessage.label',
    'Content Disabled Security Warning'),
};

export class WebviewContentProvider {
  constructor(
		private readonly engine: MyDocEngine,
		private readonly context: vscode.ExtensionContext
  ) { }

  public async providePreviewHTML(
    MyDocDocument: vscode.TextDocument,
    initialLine: number | undefined = undefined,
    state?: any
  ): Promise<string> {
    const sourceUri = MyDocDocument.uri;
    const initialData = {
      source: sourceUri.toString(),
      line: initialLine,
      lineCount: MyDocDocument.lineCount,
    };

    // Content Security Policy
    const nonce = new Date().getTime() + '' + new Date().getMilliseconds();
    const body = await this.engine.render(sourceUri, MyDocDocument.getText());

    return `<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta id="vscode-mydoc-preview-data"
					data-settings="${JSON.stringify(initialData).replace(/"/g, '&quot;')}"
					data-strings="${JSON.stringify(previewStrings).replace(/"/g, '&quot;')}"
					data-state="${JSON.stringify(state || {}).replace(/"/g, '&quot;')}">
				<script src="${this.extensionScriptPath('pre.js')}" nonce="${nonce}"></script>
				<base href="${MyDocDocument.uri.with({ scheme: 'vscode-resource' }).toString(true)}">
			</head>
			<body vscode-body>
				${body}
				<div class="code-line" data-line="${MyDocDocument.lineCount}"></div>
				<script async src="${this.extensionScriptPath('index.js')}" nonce="${nonce}" charset="UTF-8"></script>
			</body>
			</html>`;
  }

  private extensionScriptPath(mediaFile: string): string {
    return vscode.Uri.file(this.context.asAbsolutePath(path.join('dist', 'src-preview', mediaFile)))
      .with({ scheme: 'vscode-resource' })
      .toString();
  }

}
