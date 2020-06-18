/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { Command } from '../commandManager';
import { WebviewPreviewManager } from '../features/WebviewPreviewManager';


async function showPreview(
  WebviewPreviewManager: WebviewPreviewManager,
  uri: vscode.Uri | undefined
): Promise<any> {
  let resource = uri;
  if (!(resource instanceof vscode.Uri)) {
    if (vscode.window.activeTextEditor) {
      // we are relaxed and don't check for MyDoc files
      resource = vscode.window.activeTextEditor.document.uri;
    }
  }

  const resourceColumn = (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn) || vscode.ViewColumn.One;
  WebviewPreviewManager.preview(resource, {
    resourceColumn: resourceColumn,
    previewColumn: resourceColumn + 1,
  });

}

export class ShowPreviewToSideCommand implements Command {
	public readonly id = 'MyDoc.showPreviewToSide';

	public constructor(
		private readonly WebviewPreviewManager: WebviewPreviewManager
	) { }

	public execute(uri?: vscode.Uri) {
	  showPreview(this.WebviewPreviewManager, uri);
	}
}
