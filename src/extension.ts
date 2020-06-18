/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import { WebviewContentProvider } from './features/WebviewContentProvider';
import { WebviewPreviewManager } from './features/WebviewPreviewManager';
import { MyDocEngine } from './features/docEngine';


export function activate(context: vscode.ExtensionContext) {


  const engine = new MyDocEngine();
  console.log('Extenstion Activated');

  const contentProvider = new WebviewContentProvider(engine, context);
  const previewManager = new WebviewPreviewManager(contentProvider);
  context.subscriptions.push(previewManager);

  const commandManager = new CommandManager();
  context.subscriptions.push(commandManager);
  commandManager.register(new commands.ShowPreviewToSideCommand(previewManager));

}
